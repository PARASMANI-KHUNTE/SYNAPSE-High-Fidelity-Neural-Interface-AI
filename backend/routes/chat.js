import express from "express";
import Chat from "../models/Chat.js";
import { getRelevantDocs } from "../rag/retriever.js";
import { generateResponse } from "../services/llm.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: "Missing 'userId' or 'message' in request body" });
    }

    // 🧠 1. Load Memory
    let chat = await Chat.findOne({ userId });
    if (!chat) {
      chat = await Chat.create({ userId, messages: [] });
    }

    // 🔍 2. RAG Retrieval
    let ragContext = "";
    try {
      ragContext = await getRelevantDocs(message);
    } catch (ragErr) {
      console.warn("⚠️ RAG retrieval failed, continuing without context:", ragErr.message);
    }

    // 🧠 3. Context Window
    const windowSize = parseInt(process.env.CONTEXT_WINDOW_SIZE) || 6;
    const recentMessages = chat.messages.slice(-windowSize).map(m => ({
      role: m.role,
      content: m.content
    }));

    // 🔥 4. Build prompt
    const messages = [
      {
        role: "system",
        content: `You are a precise AI assistant.

Rules:
- Answer using the provided context when relevant
- If not found in context, use your knowledge
- Keep answers structured and concise
- Do NOT hallucinate

Context:
${ragContext}`
      },
      ...recentMessages,
      { role: "user", content: message }
    ];

    // 🤖 5. Generate
    const reply = await generateResponse(messages);

    // 💾 6. Save Memory
    chat.messages.push(
      { role: "user", content: message },
      { role: "assistant", content: reply }
    );
    await chat.save();

    res.json({ reply });

  } catch (err) {
    console.error("❌ Chat route error:", err.message);
    res.status(500).json({
      error: "Failed to generate response",
      details: err.message
    });
  }
});

export default router;