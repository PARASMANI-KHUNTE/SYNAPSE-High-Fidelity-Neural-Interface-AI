import Chat from "../../models/Chat.js";
import { generateCompletion } from "../../services/llm.js";
import { decompose } from "../../agent/planner.js";
import {
  appendUserMessageToChat,
  getOrCreateChatSession,
  normalizeIncomingMessage,
  persistExchangeMemory,
  processAgentChatTurn,
  processStandardChatTurn
} from "../../services/chatPipeline.js";
import { cleanupClient } from "../index.js";

export const chatEvents = (io, socket, activeStreams) => {
  socket.on("chat:message", async (data) => {
    cleanupClient(socket.id, activeStreams);

    const {
      chatId,
      message: rawMessage = "",
      voice,
      voicePreference,
      fileUrl,
      fileType,
      images = [],
      modelPreference,
      customModel
    } = data;

    const resolvedVoice = String(voicePreference || voice || socket.data?.voicePreference || "male").toLowerCase() === "female"
      ? "female"
      : "male";
    socket.data.voicePreference = resolvedVoice;

    const abortController = new AbortController();
    activeStreams.set(socket.id, abortController);
    const safeCleanup = () => cleanupClient(socket.id, activeStreams);
    const userId = socket.auth.userId;

    try {
      const { chat, chatId: currentChatId } = await getOrCreateChatSession({
        userId,
        chatId,
        title: rawMessage.substring(0, 50) || "New Chat",
        socket
      });

      const {
        trimmedMessage,
        uploadedImageUrls,
        actualFileType
      } = await normalizeIncomingMessage({
        socket,
        message: rawMessage,
        fileUrl,
        fileType,
        images
      });

      await appendUserMessageToChat({
        chat,
        message: trimmedMessage,
        uploadedImageUrls,
        actualFileType,
        fileUrl
      });

      await persistExchangeMemory({
        userId,
        sessionId: String(currentChatId),
        userMessage: trimmedMessage
      });

      const agentPlan = await decompose({
        message: trimmedMessage,
        chatId: currentChatId,
        userId
      });

        if (agentPlan.isAgentic) {
          await processAgentChatTurn({
            io,
            socket,
            plan: agentPlan,
            chat,
            chatId: currentChatId,
            userId,
            modelPreference,
            customModel,
            voice: resolvedVoice,
            abortSignal: abortController.signal
          });
          return;
        }

      await processStandardChatTurn({
        socket,
        chat,
        chatId: currentChatId,
        userId,
        trimmedMessage,
        uploadedImageUrls,
        actualFileType,
        fileUrl,
        modelPreference,
        customModel,
        voice: resolvedVoice,
        abortSignal: abortController.signal
      });
    } catch (err) {
      if (abortController.signal.aborted || err?.name === "AbortError" || err?.type === "aborted") {
        return;
      }
      console.error("Chat Error:", err.message);
      socket.emit("chat:error", { message: err.message || "An error occurred while processing your request" });
    } finally {
      safeCleanup();
    }
  });

  socket.on("chat:stop", () => {
    cleanupClient(socket.id, activeStreams);
    socket.emit("chat:stopped");
  });

  socket.on("voice:update", ({ voice } = {}) => {
    const nextVoice = String(voice || "").toLowerCase() === "female" ? "female" : "male";
    socket.data.voicePreference = nextVoice;
  });

  socket.on("chat:feedback", async ({ chatId, messageId, feedback }) => {
    try {
      const userId = socket.auth.userId;
      if (!chatId || !messageId) {
        return socket.emit("chat:error", { message: "Missing required fields" });
      }
      const chat = await Chat.findOne({ _id: chatId, userId });
      if (!chat) {
        return socket.emit("chat:error", { message: "Chat not found" });
      }
      const msg = chat.messages.id(messageId);
      if (msg) {
        msg.feedback = feedback;
        await chat.save();
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
