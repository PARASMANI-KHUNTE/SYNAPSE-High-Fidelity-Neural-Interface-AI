import Chat from "../../models/Chat.js";
import { generateResponseStream, generateCompletion } from "../../services/llm.js";
import { getRelevantDocs } from "../../rag/retriever.js";
import { addChatJob } from "../../queues/chatQueue.js";
import { transcribeAudio, generateTTS } from "../../services/voice.js";
import { buildChatMessages } from "../../services/chatContext.js";
import { parsePDF } from "../../services/pdf.js";
import { generatePDF } from "../../services/pdfGen.js";
import path from "path";
import fs from "fs";
import { classifyQuery, shouldUseRAG, resolveModelPreference } from "../../services/chatRouter.js";

const activeStreams = new Map();
const SEARCH_HINT_PATTERNS = [
  /\bsearch\b/i, /\blatest\b/i, /\btoday\b/i, /\bcurrent\b/i, /\bnews\b/i, /\bnow\b/i,
  /\blink\b/i, /\burl\b/i, /\bvideo\b/i, /\btutorial\b/i, /\brecommend\b/i, /\bbest\b/i
];

const shouldSearchInternet = (message) => SEARCH_HINT_PATTERNS.some((pattern) => pattern.test(message || ""));

const shouldGeneratePdfReport = (message) => {
  const text = String(message || "").toLowerCase();
  return (
    /\bcreate\b.*\bpdf\b/.test(text) ||
    /\bgenerate\b.*\bpdf\b/.test(text) ||
    /\bpdf report\b/.test(text) ||
    /\bmake\b.*\bpdf\b/.test(text) ||
    (/\bpdf\b/.test(text) && /\b(report|document|summary|export|download|save|convert)\b/.test(text))
  );
};

const shouldFetchReferenceImages = (message, hasUserImage = false) => {
  if (hasUserImage) {
    return false;
  }

  const text = String(message || "").toLowerCase();
  const wantsVisuals = /\b(image|images|picture|pictures|photo|photos|pic|pics)\b/.test(text);
  const intentVerb = /\b(show|show me|send|find|search|give|bring|display)\b/.test(text);
  const speechVariant = /\b(saw me|shoe me|so me|showmee)\b/.test(text);

  return (
    /\bshow me\b/.test(text) ||
    /\bgenerate an image\b/.test(text) ||
    /\bfind images of\b/.test(text) ||
    /\breference images for\b/.test(text) ||
    /\bpicture of\b/.test(text) ||
    /\bphoto of\b/.test(text) ||
    ((intentVerb || speechVariant) && wantsVisuals)
  );
};

const deleteUploadedFile = (fileUrl) => {
  if (!fileUrl) return;
  try {
    const filename = path.basename(fileUrl);
    const localPath = path.join(process.cwd(), "uploads", filename);
    fs.unlink(localPath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn(`[Cleanup] Failed to delete ${filename}:`, err.message);
      }
    });
  } catch (err) {
    console.warn("[Cleanup] Unexpected error:", err.message);
  }
};

const resolveUploadedFilePath = (fileUrl) => {
  if (!fileUrl) return null;
  const filename = path.basename(fileUrl);
  return path.join(process.cwd(), "uploads", filename);
};

const fileExists = (filepath) => Boolean(filepath && fs.existsSync(filepath));

const imageUrlToBase64 = (imageUrl) => {
  const filepath = resolveUploadedFilePath(imageUrl);
  if (!fileExists(filepath)) {
    return null;
  }
  return fs.readFileSync(filepath).toString("base64");
};

const buildImagePayload = (imageUrls = []) =>
  imageUrls
    .map((imageUrl) => imageUrlToBase64(imageUrl))
    .filter(Boolean)
    .slice(0, 3);

const buildAttachmentContext = async (actualFileType, fileUrl) => {
  if (!fileUrl) return "";

  if (actualFileType === "file" && /\.pdf($|\?)/i.test(fileUrl)) {
    const filepath = resolveUploadedFilePath(fileUrl);
    if (fileExists(filepath)) {
      try {
        const pdfText = await parsePDF(filepath);
        if (pdfText.trim()) {
          return `PDF document content:\n${pdfText.substring(0, 6000)}`;
        }
      } catch (err) {
        console.warn("PDF parse failed during socket chat:", err.message);
      }
    }
  }

  return "";
};

export const chatEvents = (io, socket) => {
  const cleanupClient = (socketId) => {
    if (activeStreams.has(socketId)) {
      activeStreams.get(socketId).abort();
      activeStreams.delete(socketId);
    }
  };

  socket.on("chat:message", async (data) => {
    cleanupClient(socket.id);

    const {
      userId,
      chatId,
      message: rawMessage = "",
      voice,
      fileUrl,
      fileType,
      images = [],
      modelPreference,
      customModel
    } = data;

    let message = rawMessage;
    let currentChatId = chatId;
    let fullReply = "";
    const abortController = new AbortController();
    activeStreams.set(socket.id, abortController);

    try {
      if (!userId) {
        throw new Error("Missing userId");
      }

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

      const uploadedImageUrls = Array.isArray(images) ? images.filter(Boolean) : [];
      const actualFileType = fileType || (fileUrl && (fileUrl.match(/\.(webm|mp3|wav|ogg)$/i)
        ? "audio"
        : fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          ? "image"
          : fileUrl.match(/\.pdf($|\?)/i)
            ? "file"
            : null));

      if (actualFileType === "audio" && fileUrl) {
        socket.emit("chat:reply:chunk", { chunk: "Transcribing audio..." });
        const localPath = resolveUploadedFilePath(fileUrl);
        const transcription = await transcribeAudio(localPath);
        deleteUploadedFile(fileUrl);

        if (transcription && !transcription.startsWith("[")) {
          message = transcription;
        } else if (!message || message.trim().length === 0) {
          message = "I've processed your voice input, but didn't catch clear text. How can I help?";
        }
      }

      let trimmedMessage = String(message || "").trim();
      if (!trimmedMessage) {
        if (actualFileType === "image") {
          trimmedMessage = "Please analyze the attached image in detail.";
        } else if (actualFileType === "file") {
          trimmedMessage = "Please analyze the attached document and summarize the important details.";
        } else if (actualFileType === "audio") {
          trimmedMessage = "I've processed your voice input, but didn't catch clear text. How can I help?";
        } else {
          return socket.emit("chat:error", { message: "SYNAPSE received an empty signal. Please provide more input." });
        }
      }

      const queryType = classifyQuery(trimmedMessage);
      const isRAGRequired = shouldUseRAG(queryType);
      const imagePayload = buildImagePayload(uploadedImageUrls);
      const hasImages = imagePayload.length > 0 || actualFileType === "image";
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

      const attachmentContext = await buildAttachmentContext(actualFileType, fileUrl);

      let searchContext = "";
      if (shouldSearchInternet(trimmedMessage)) {
        socket.emit("chat:reply:chunk", { chunk: "Searching the web for real-time info..." });
        const searchJob = await addChatJob({ type: "web-search", payload: { query: trimmedMessage } });
        const results = await searchJob.waitUntilFinished();
        if (results && results.length > 0) {
          searchContext = results.map((result) => `${result.title}: ${result.snippet}`).join("\n\n");
        }
      }

      chat.addMessage("user", trimmedMessage, {
        imageUrls: uploadedImageUrls,
        audioUrl: actualFileType === "audio" ? fileUrl : undefined
      });
      if (!chat.title || chat.title === "New Chat") {
        chat.title = trimmedMessage.substring(0, 50) || "New Chat";
      }
      await chat.save();

      const priorMessages = chat.messages.slice(0, -1);
      const llmMessages = buildChatMessages({
        chatMessages: priorMessages,
        userMessage: trimmedMessage,
        currentUserMessage: {
          content: trimmedMessage,
          ...(imagePayload.length > 0 ? { images: imagePayload } : {})
        },
        operatorName: process.env.OPERATOR_NAME || "Operator",
        ragContext,
        searchContext,
        attachmentContext,
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

      if (shouldGeneratePdfReport(trimmedMessage) && fullReply.trim()) {
        try {
          const pdfPath = await generatePDF(fullReply, trimmedMessage.substring(0, 60) || "synapse_report");
          const baseUrl = process.env.BASE_URL || "http://localhost:3001";
          const pdfUrl = `${baseUrl}/${pdfPath.replace(/\\/g, "/")}`;
          const pdfMessage = `\n\nPDF report generated: [Download PDF report](${pdfUrl})`;

          socket.emit("chat:reply:chunk", { chunk: pdfMessage });
          socket.emit("chat:reply:file", { type: "pdf", url: pdfUrl, name: path.basename(pdfPath) });
          fullReply += pdfMessage;

          const updatedChat = await Chat.findById(currentChatId);
          if (updatedChat && updatedChat.messages.length > 0) {
            const lastMsg = updatedChat.messages[updatedChat.messages.length - 1];
            if (lastMsg.role === "assistant") {
              lastMsg.content = `${lastMsg.content}${pdfMessage}`;
              await updatedChat.save();
            }
          }
        } catch (pdfErr) {
          console.error("PDF generation failed:", pdfErr.message);
          socket.emit("chat:reply:chunk", { chunk: "\n\nPDF generation failed." });
        }
      }

      socket.emit("chat:reply:end");

      if (actualFileType !== "audio" && fileUrl) {
        deleteUploadedFile(fileUrl);
      }

      if (shouldFetchReferenceImages(trimmedMessage, imagePayload.length > 0)) {
        const imageJob = await addChatJob({ type: "image-search", payload: { query: trimmedMessage } });
        const imageUrls = await imageJob.waitUntilFinished();
        if (imageUrls && imageUrls.length > 0) {
          socket.emit("chat:reply:images", { images: imageUrls });

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
