import express from "express";
import Chat from "../models/Chat.js";
import { getRelevantDocs } from "../rag/retriever.js";
import { generateResponse } from "../services/llm.js";
import { buildChatMessages } from "../services/chatContext.js";
import { classifyQuery, resolveModelPreference } from "../services/chatRouter.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { userId, chatId, message, modelPreference, customModel } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: "Missing 'userId' or 'message' in request body" });
    }

    let chat = null;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, userId });
    }

    if (!chat) {
      chat = await Chat.findOne({ userId }).sort({ updatedAt: -1 });
    }

    if (!chat) {
      chat = await Chat.create({
        userId,
        title: message.substring(0, 50) || "New Chat",
        messages: []
      });
    }

    const queryType = classifyQuery(message);
    const selectedModel = resolveModelPreference({
      preference: modelPreference,
      queryType,
      customModel
    });

    let ragContext = "";
    try {
      ragContext = await getRelevantDocs(message);
    } catch (ragErr) {
      console.warn("RAG retrieval failed, continuing without context:", ragErr.message);
    }

    chat.addMessage("user", message);
    if (!chat.title || chat.title === "New Chat") {
      chat.title = message.substring(0, 50) || "New Chat";
    }
    await chat.save();

    const messages = buildChatMessages({
      chatMessages: chat.messages,
      userMessage: message,
      operatorName: process.env.OPERATOR_NAME || "Operator",
      ragContext,
      queryType
    });

    const reply = await generateResponse(messages, selectedModel);

    chat.addMessage("assistant", reply);
    await chat.save();

    res.json({ reply, chatId: chat._id, model: selectedModel });
  } catch (err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({
      error: "Failed to generate response",
      details: err.message
    });
  }
});

export default router;
