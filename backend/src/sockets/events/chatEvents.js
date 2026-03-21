import Chat from "../../models/Chat.js";
import { generateResponseStream, generateCompletion } from "../../services/llm.js";
import { getRelevantDocs } from "../../rag/retriever.js";
import { addChatJob } from "../../queues/chatQueue.js";
import { transcribeAudio, generateTTS } from "../../services/voice.js";
import { buildChatMessages } from "../../services/chatContext.js";
import path from "path";
import fs from "fs";

import { classifyQuery, shouldUseRAG, resolveModelPreference } from "../../services/chatRouter.js";

const activeStreams = new Map();

/**
 * Silently deletes a file from the uploads directory after it has been processed.
 * Never throws — failures are just logged.
 */
const deleteUploadedFile = (fileUrl) => {
  if (!fileUrl) return;
  try {
    const filename = path.basename(fileUrl);
    const localPath = path.join(process.cwd(), "uploads", filename);
    fs.unlink(localPath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn(`[Cleanup] Failed to delete ${filename}:`, err.message);
      } else if (!err) {
        console.log(`[Cleanup] 🗑️ Deleted uploaded file: ${filename}`);
      }
    });
  } catch (e) {
    console.warn("[Cleanup] Unexpected error:", e.message);
  }
};
const SEARCH_HINT_PATTERNS = [
  /\bsearch\b/i, /\blatest\b/i, /\btoday\b/i, /\bcurrent\b/i, /\bnews\b/i, /\bnow\b/i, 
  /\blink\b/i, /\burl\b/i, /\bvideo\b/i, /\btutorial\b/i, /\brecommend\b/i, /\bbest\b/i
];

const shouldSearchInternet = (message) => SEARCH_HINT_PATTERNS.some((pattern) => pattern.test(message || ""));

export const chatEvents = (io, socket) => {
  const cleanupClient = (socketId) => {
    if (activeStreams.has(socketId)) {
      activeStreams.get(socketId).abort();
      activeStreams.delete(socketId);
    }
  };

  socket.on("chat:message", async (data) => {
    // 🛑 Stop any existing stream for this user before starting a new one
    cleanupClient(socket.id);

    const { userId, chatId, message: rawMessage = "", voice, fileUrl, fileType, modelPreference, customModel } = data;
    let message = rawMessage;
    let currentChatId = chatId;
    let fullReply = "";
    const abortController = new AbortController();
    activeStreams.set(socket.id, abortController);

    try {
      if (!userId) {
        throw new Error("Missing userId");
      }

      console.log(`[Socket:MESSAGE] userId=${userId} chatId=${currentChatId} fileType=${fileType} fileUrl=${fileUrl ? "present" : "absent"} rawMessage="${rawMessage}"`);

      let chat;
      if (!currentChatId) {
        chat = new Chat({ userId, title: message.substring(0, 50) || "New Chat", messages: [] });
        await chat.save();
        currentChatId = chat._id;
        socket.emit("chat:created", { chatId: currentChatId, title: chat.title });
      } else {
        chat = await Chat.findOne({ _id: currentChatId, userId });
      }

      if (!chat) {
        throw new Error("Chat not found");
      }

      // Robust file type detection (fallback for older clients or missing payload items)
      const actualFileType = fileType || (fileUrl && (fileUrl.match(/\.(webm|mp3|wav|ogg)$/) ? "audio" : fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/) ? "image" : null));

      if (actualFileType === "audio" && fileUrl) {
        socket.emit("chat:reply:chunk", { chunk: "🎙️ Transcribing audio..." });
        const localPath = path.join(process.cwd(), "uploads", path.basename(fileUrl));
        const transcription = await transcribeAudio(localPath);
        
        console.log(`[Socket:AUDIO] Result: "${transcription}"`);

        // ✅ Delete audio file immediately after transcription — no longer needed
        deleteUploadedFile(fileUrl);

        // Use transcription if it worked, otherwise fallback to rawMessage or default
        if (transcription && !transcription.startsWith("[")) {
          message = transcription;
        } else if (!message || message.trim().length === 0) {
          message = "I've processed your voice input, but didn't catch clear text. How can I help?";
        }
      }

      let trimmedMessage = String(message || "").trim();
      if (!trimmedMessage) {
        if (fileType === "audio") {
          message = "I've processed your voice input, but didn't catch clear text. How can I help?";
          trimmedMessage = message;
        } else {
          return socket.emit("chat:error", { message: "SYNAPSE received an empty signal. Please provide more input." });
        }
      }

      // 🧩 Smart Routing & Model Selection
      const queryType = classifyQuery(trimmedMessage);
      const isRAGRequired = shouldUseRAG(queryType);
      const hasImages = actualFileType === "image";
      const selectedModel = resolveModelPreference({
        preference: modelPreference,
        queryType,
        hasImages,
        customModel
      });

      let ragContext = "";
      if (isRAGRequired) {
        try {
          ragContext = await getRelevantDocs(trimmedMessage);
        } catch (ragErr) {
          console.warn("RAG retrieval failed during socket chat:", ragErr.message);
        }
      }

      let searchContext = "";
      if (shouldSearchInternet(trimmedMessage)) {
        socket.emit("chat:reply:chunk", { chunk: "Searching the web for real-time info..." });
        const searchJob = await addChatJob({ type: "web-search", payload: { query: trimmedMessage } });
        const results = await searchJob.waitUntilFinished();
        if (results && results.length > 0) {
          searchContext = results.map((result) => `${result.title}: ${result.snippet}`).join("\n\n");
        }
      }

      chat.addMessage("user", trimmedMessage);
      if (!chat.title || chat.title === "New Chat") {
        chat.title = trimmedMessage.substring(0, 50) || "New Chat";
      }
      await chat.save();

      const llmMessages = buildChatMessages({
        chatMessages: chat.messages,
        userMessage: trimmedMessage,
        operatorName: process.env.OPERATOR_NAME || "Operator",
        ragContext,
        searchContext,
        queryType
      });

      socket.emit("chat:reply:start");
      socket.emit("chat:model", { preference: modelPreference || "auto", model: selectedModel, queryType });

      fullReply = await generateResponseStream(
        llmMessages,
        (chunk) => {
          socket.emit("chat:reply:chunk", { chunk });
        },
        abortController.signal,
        selectedModel
      );

      if (fullReply.trim()) {
        chat.addMessage("assistant", fullReply);
        await chat.save();
      }

      socket.emit("chat:reply:end");

      // ✅ Delete uploaded user file (image/doc) after LLM has processed it
      if (actualFileType !== "audio" && fileUrl) {
        deleteUploadedFile(fileUrl);
      }

      if (/\bimage\b/i.test(trimmedMessage) || /\bshow me\b/i.test(trimmedMessage) || /\bpicture\b/i.test(trimmedMessage) || /\bphoto\b/i.test(trimmedMessage)) {
        const imageJob = await addChatJob({ type: "image-search", payload: { query: trimmedMessage } });
        const imageUrls = await imageJob.waitUntilFinished();
        if (imageUrls && imageUrls.length > 0) {
          socket.emit("chat:reply:images", { images: imageUrls });
          
          // Persist images to DB
          const updatedChat = await Chat.findById(currentChatId);
          if (updatedChat && updatedChat.messages.length > 0) {
            const lastMsg = updatedChat.messages[updatedChat.messages.length - 1];
            if (lastMsg.role === "assistant") {
              lastMsg.imageUrls = [...(lastMsg.imageUrls || []), ...imageUrls];
              await updatedChat.save();
            }
          }
        }
      }

      if (process.env.ENABLE_TTS === "true") {
        const audioUrl = await generateTTS(fullReply, voice);
        if (audioUrl) {
          socket.emit("audio:ready", { url: audioUrl });
        }
      }
    } catch (err) {
      console.error("Chat Error:", err.message, err.stack);
      socket.emit("chat:error", { message: err.message });
    } finally {
      cleanupClient(socket.id);
    }
  });

  socket.on("chat:stop", () => {
    cleanupClient(socket.id);
    socket.emit("chat:stopped");
  });

  socket.on("chat:feedback", async ({ userId, chatId, messageId, feedback }) => {
    try {
      const chatQuery = userId ? { _id: chatId, userId } : { _id: chatId };
      const chat = await Chat.findOne(chatQuery);
      if (chat) {
        const msg = chat.messages.id(messageId);
        if (msg) {
          msg.feedback = feedback;
          await chat.save();
        }
      }
    } catch (err) {
      console.error("Feedback failed:", err.message);
    }
  });

  socket.on("chat:suggest", async ({ input }) => {
    try {
      if (input && input.length > 10) {
        const suggestion = await generateCompletion(`Give a 3-word autocomplete completion for: "${input}"`);
        socket.emit("chat:suggestion", { suggestion });
      }
    } catch {
      // Ignore suggestion errors
    }
  });
};
