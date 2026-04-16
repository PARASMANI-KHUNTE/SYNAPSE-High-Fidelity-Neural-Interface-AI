import path from "path";
import fs from "fs";
import Chat from "../models/Chat.js";
import { generateResponseStream } from "./llm.js";
import { getRelevantDocs } from "../rag/retriever.js";
import { addChatJob } from "../queues/chatQueue.js";
import { transcribeAudio, generateTTS } from "./voice.js";
import { buildChatMessages } from "./chatContext.js";
import { parsePDF } from "./pdf.js";
import { generatePDF } from "./pdfGen.js";
import { executeTool } from "../agent/toolExecutor.js";
import { extractFactsFromExchange } from "../memory/factExtractor.js";
import { upsertEpisodeFromChat } from "../memory/episodicMemory.js";
import { rememberFacts, syncProfileFacts } from "../memory/profileMemory.js";
import { queryMemoryContext } from "../memory/memoryRouter.js";
import { classifyQuery, shouldUseRAG, resolveModelPreference } from "./chatRouter.js";
import { generalCache, searchCache, getCacheKey } from "./cache.js";
import config from "../config/env.js";

const SEARCH_HINT_PATTERNS = [
  /\bsearch\b/i, /\blatest\b/i, /\btoday\b/i, /\bcurrent\b/i, /\bnews\b/i, /\bnow\b/i,
  /\blink\b/i, /\burl\b/i, /\bvideo\b/i, /\btutorial\b/i, /\brecommend\b/i, /\bbest\b/i
];
const CURRENT_DATA_PATTERNS = [
  /\b(weather|forecast|temperature|rain|storm)\b/i,
  /\b(stock|price|market|crypto|bitcoin|ethereum)\b/i,
  /\b(election|president|prime minister|ceo|minister|government)\b/i,
  /\b(score|match|game|standing|schedule|transfer)\b/i,
  /\b(release date|launch|version|update|updated)\b/i,
  /\b(hotspot|hotspots|war|conflict|geopolitics|geopolitical)\b/i
];

const shouldSearchInternet = ({ message, queryType, actualFileType, hasImages = false }) => {
  const text = String(message || "");

  if (actualFileType === "image" || actualFileType === "file" || hasImages) {
    return false;
  }

  if (SEARCH_HINT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (CURRENT_DATA_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  return queryType === "KNOWLEDGE";
};

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
const STREAM_TTS_MIN_CHARS_INITIAL = 30;
const STREAM_TTS_MIN_CHARS = 65;
const STREAM_TTS_MAX_BUFFER = 420;

const imageUrlToBase64 = (imageUrl) => {
  const filepath = resolveUploadedFilePath(imageUrl);
  if (!fileExists(filepath)) {
    return null;
  }
  return fs.readFileSync(filepath).toString("base64");
};

const localImagePathToBase64 = (localPath) => {
  if (!fileExists(localPath)) {
    return null;
  }

  return fs.readFileSync(localPath).toString("base64");
};

const extractSpeakableSegments = (buffer = "", minChars = STREAM_TTS_MIN_CHARS) => {
  const segments = [];
  let remaining = String(buffer || "");

  while (true) {
    const regex = /[\s\S]*?(?:[.!?]+(?:\s|$)|\n{2,})/g;
    let match;
    let foundChunk = "";
    
    while ((match = regex.exec(remaining)) !== null) {
      foundChunk += match[0];
      if (foundChunk.trim().length >= minChars) {
        break;
      }
    }
    
    if (foundChunk.trim().length >= minChars) {
      const segment = foundChunk.replace(/\s+/g, " ").trim();
      segments.push(segment);
      remaining = remaining.slice(foundChunk.length);
    } else {
      break;
    }
  }

  if (remaining.length > STREAM_TTS_MAX_BUFFER) {
    let sliceLen = STREAM_TTS_MAX_BUFFER;
    const lastSpace = remaining.lastIndexOf(" ", STREAM_TTS_MAX_BUFFER);
    if (lastSpace > 0) sliceLen = lastSpace;
    
    const fallback = remaining.slice(0, sliceLen).trim();
    remaining = remaining.slice(sliceLen);
    if (fallback.length >= 1) {
      const safeFallback = fallback + (/[.!?,;:]$/.test(fallback) ? "" : ",");
      segments.push(safeFallback);
    }
  }

  return { segments, remaining };
};

const createStreamingTts = ({ socket, voice, abortSignal }) => {
  let buffer = "";
  let queue = Promise.resolve();
  let emittedAny = false;
  let queuedAny = false;

  const enqueue = (text) => {
    queuedAny = true;
    const ttsPromise = generateTTS(text, voice).catch((err) => {
      console.warn("Streaming TTS chunk failed:", err.message);
      return null;
    });

    queue = queue.then(async () => {
      if (abortSignal?.aborted) return;
      const audioUrl = await ttsPromise;
      if (audioUrl) {
        emittedAny = true;
        socket.emit("audio:ready", { url: audioUrl });
      }
    });
  };

  return {
    onChunk(chunk = "") {
      if (abortSignal?.aborted) return;
      buffer += chunk;
      const minChars = queuedAny ? STREAM_TTS_MIN_CHARS : STREAM_TTS_MIN_CHARS_INITIAL;
      const { segments, remaining } = extractSpeakableSegments(buffer, minChars);
      buffer = remaining;
      for (const segment of segments) {
        enqueue(segment);
      }
    },
    async flush() {
      if (!abortSignal?.aborted) {
        const tail = buffer.replace(/\s+/g, " ").trim();
        if (tail.length >= 2) {
          enqueue(tail);
        }
      }
      await queue;
      return emittedAny;
    }
  };
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

const formatAgentOutput = (toolName, result) => {
  const output = result?.output;

  if (typeof output === "string") {
    return output;
  }

  if (toolName === "filesystem" && Array.isArray(output)) {
    return output.map((entry) => `- ${entry.name} (${entry.type})`).join("\n");
  }

  if (output && typeof output === "object") {
    return Object.entries(output).map(([key, value]) => `- ${key}: ${value}`).join("\n");
  }

  return "Tool completed without output.";
};

export const getOrCreateChatSession = async ({ userId, chatId, title = "New Chat", socket }) => {
  let currentChatId = chatId;
  let chat;

  if (!currentChatId) {
    chat = new Chat({ userId, title, messages: [] });
    await chat.save();
    currentChatId = chat._id;
    socket.emit("chat:created", { chatId: currentChatId, title: chat.title });
  } else {
    chat = await Chat.findOne({ _id: currentChatId, userId });
    if (!chat) {
      chat = new Chat({ userId, title, messages: [] });
      await chat.save();
      currentChatId = chat._id;
      socket.emit("chat:created", { chatId: currentChatId, title: chat.title });
    }
  }

  if (!chat) {
    throw new Error("Chat not found");
  }

  return { chat, chatId: currentChatId };
};

export const normalizeIncomingMessage = async ({
  socket,
  message,
  fileUrl,
  fileType,
  images = []
}) => {
  const uploadedImageUrls = Array.isArray(images) ? images.filter(Boolean) : [];
  const actualFileType = fileType || (fileUrl && (fileUrl.match(/\.(webm|mp3|wav|ogg)$/i)
    ? "audio"
    : fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ? "image"
      : fileUrl.match(/\.pdf($|\?)/i)
        ? "file"
        : null));

  let normalizedMessage = message;

  if (actualFileType === "audio" && fileUrl) {
    socket.emit("chat:reply:chunk", { chunk: "Transcribing audio..." });
    const localPath = resolveUploadedFilePath(fileUrl);
    const transcription = await transcribeAudio(localPath);
    deleteUploadedFile(fileUrl);

    if (transcription && !transcription.startsWith("[")) {
      normalizedMessage = transcription;
    } else if (!normalizedMessage || normalizedMessage.trim().length === 0) {
      normalizedMessage = "I've processed your voice input, but didn't catch clear text. How can I help?";
    }
  }

  let trimmedMessage = String(normalizedMessage || "").trim();
  if (!trimmedMessage) {
    if (actualFileType === "image") {
      trimmedMessage = "Please analyze the attached image in detail.";
    } else if (actualFileType === "file") {
      trimmedMessage = "Please analyze the attached document and summarize the important details.";
    } else if (actualFileType === "audio") {
      trimmedMessage = "I've processed your voice input, but didn't catch clear text. How can I help?";
    } else {
      throw new Error("SYNAPSE received an empty signal. Please provide more input.");
    }
  }

  return {
    trimmedMessage,
    uploadedImageUrls,
    actualFileType
  };
};

export const appendUserMessageToChat = async ({
  chat,
  message,
  uploadedImageUrls = [],
  actualFileType,
  fileUrl
}) => {
  chat.addMessage("user", message, {
    imageUrls: uploadedImageUrls,
    audioUrl: actualFileType === "audio" ? fileUrl : undefined
  });

  if (!chat.title || chat.title === "New Chat") {
    chat.title = message.substring(0, 50) || "New Chat";
  }

  await chat.save();
};

export const persistExchangeMemory = async ({
  userId,
  sessionId,
  userMessage
}) => {
  const facts = extractFactsFromExchange({ userMessage });
  if (facts.length === 0) {
    return [];
  }

  await rememberFacts({
    userId,
    sessionId,
    facts
  });
  await syncProfileFacts({ userId });
  return facts;
};

export const processAgentChatTurn = async ({
  io,
  socket,
  plan,
  chat,
  chatId,
  userId,
  modelPreference,
  customModel,
  abortSignal
}) => {
  const task = plan.tasks[0];
  const runId = `chat_agent_${Date.now()}`;

  socket.emit("chat:reply:start");
  socket.emit("agent:thinking", {
    runId,
    step: "plan",
    message: plan.summary || `Preparing ${task.tool}`
  });
  socket.emit("agent:tool:start", {
    runId,
    tool: task.tool,
    params: task.params
  });

  const execution = await executeTool({
    toolName: task.tool,
    params: task.params,
    context: {
      io,
      socket,
      userId,
      sessionId: String(chatId),
      projectRoot: process.cwd(),
      userContext: {}
    }
  });

  if (execution.status === "needs_confirmation") {
    socket.emit("agent:confirm:req", {
      runId,
      tool: task.tool,
      params: task.params,
      risk: execution.tool?.risk || "high"
    });
    const confirmMessage = `This action needs confirmation before I can continue: ${task.tool}.`;
    socket.emit("chat:reply:chunk", { chunk: confirmMessage });
    socket.emit("chat:reply:end");
    chat.addMessage("assistant", confirmMessage);
    await chat.save();
    return;
  }

  if (execution.status === "denied") {
    socket.emit("agent:tool:error", {
      runId,
      tool: task.tool,
      error: execution.policy.reason
    });
    socket.emit("chat:reply:chunk", { chunk: execution.policy.reason });
    socket.emit("chat:reply:end");
    chat.addMessage("assistant", execution.policy.reason, { isError: true });
    await chat.save();
    return;
  }

  socket.emit("agent:tool:result", {
    runId,
    tool: task.tool,
    output: execution.result?.output ?? execution.result
  });
  if (execution.result?.metadata?.imageUrl) {
    socket.emit("chat:reply:file", {
      type: "image",
      url: execution.result.metadata.imageUrl,
      name: execution.result.metadata.fileName || "screenshot.png"
    });
  }

  if (task.tool === "screenshot" && plan.analysisMode === "vision" && execution.result?.metadata?.filePath) {
    const screenshotBase64 = localImagePathToBase64(execution.result.metadata.filePath);
    if (!screenshotBase64) {
      throw new Error("Screenshot was captured but could not be read for analysis");
    }

    socket.emit("chat:reply:chunk", { chunk: "Captured your screen. Analyzing it now...\n\n" });

    const memoryContext = await queryMemoryContext({
      userId,
      query: plan.originalMessage || "Analyze my screen"
    });
    const visionMessages = buildChatMessages({
      chatMessages: chat.messages.slice(0, -1),
      userMessage: plan.originalMessage || "Analyze my screen",
      memoryContext,
      currentUserMessage: {
        content: `${plan.originalMessage || "Analyze this captured screen."}\nFocus on visible UI, text, code, warnings, and likely issues if any.`,
        images: [screenshotBase64]
      },
      operatorName: process.env.OPERATOR_NAME || "Operator",
      queryType: "KNOWLEDGE",
      voiceGender: voice || "male"
    });
    const visionModel = resolveModelPreference({
      preference: modelPreference,
      queryType: "KNOWLEDGE",
      hasImages: true,
      customModel
    });

    const analysisReply = await generateResponseStream(
      visionMessages,
      (chunk) => {
        socket.emit("chat:reply:chunk", { chunk });
      },
      abortSignal,
      visionModel
    );

    socket.emit("agent:done", {
      runId,
      success: true,
      tool: task.tool,
      result: execution.result,
      analysis: true
    });
    socket.emit("chat:reply:end");

    chat.addMessage(
      "assistant",
      `${analysisReply}\n\nCaptured image: ${execution.result.metadata.imageUrl}`
    );
    await chat.save();
    await upsertEpisodeFromChat({ chat });
    return;
  }

  const formattedOutput = formatAgentOutput(task.tool, execution.result);
  const reply = `I handled that with the \`${task.tool}\` tool.\n\n${formattedOutput}`;

  socket.emit("chat:reply:chunk", { chunk: reply });
  socket.emit("agent:done", {
    runId,
    success: true,
    tool: task.tool,
    result: execution.result
  });
  socket.emit("chat:reply:end");

  chat.addMessage("assistant", reply);
  await chat.save();
  await upsertEpisodeFromChat({ chat });
};

export const processStandardChatTurn = async ({
  socket,
  chat,
  chatId,
  userId,
  trimmedMessage,
  uploadedImageUrls = [],
  actualFileType,
  fileUrl,
  modelPreference,
  customModel,
  voice,
  abortSignal
}) => {
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
    const ragKey = getCacheKey("rag", trimmedMessage);
    if (generalCache.has(ragKey)) {
      ragContext = generalCache.get(ragKey);
    } else {
      try {
        ragContext = await getRelevantDocs(trimmedMessage);
        if (ragContext) generalCache.set(ragKey, ragContext);
      } catch (ragErr) {
        console.warn("RAG retrieval failed during socket chat:", ragErr.message);
      }
    }
  }

  const attachmentContext = await buildAttachmentContext(actualFileType, fileUrl);

  let searchContext = "";
  if (shouldSearchInternet({
    message: trimmedMessage,
    queryType,
    actualFileType,
    hasImages
  })) {
    const searchKey = getCacheKey("search", trimmedMessage);
    if (searchCache.has(searchKey)) {
      searchContext = searchCache.get(searchKey);
    } else {
      socket.emit("chat:reply:chunk", { chunk: "Searching the web for real-time info..." });
      const searchJob = await addChatJob({ type: "web-search", payload: { query: trimmedMessage } });
      const results = await searchJob.waitUntilFinished();
      if (results && results.length > 0) {
        searchContext = results.map((result) => `${result.title}: ${result.snippet}`).join("\n\n");
        searchCache.set(searchKey, searchContext);
      }
    }
  }

  const memoryContext = await queryMemoryContext({
    userId,
    query: trimmedMessage
  });
  const priorMessages = chat.messages.slice(0, -1);
  const llmMessages = buildChatMessages({
    chatMessages: priorMessages,
    userMessage: trimmedMessage,
    memoryContext,
    currentUserMessage: {
      content: trimmedMessage,
      ...(imagePayload.length > 0 ? { images: imagePayload } : {})
    },
    operatorName: process.env.OPERATOR_NAME || "Operator",
    ragContext,
    searchContext,
    attachmentContext,
    queryType,
    voiceGender: voice || "male"
  });

  socket.emit("chat:reply:start");
  socket.emit("chat:model", { preference: modelPreference || "auto", model: selectedModel, queryType });

  const streamingTts = config.tts.enabled ? createStreamingTts({
    socket,
    voice,
    abortSignal
  }) : null;

  let fullReply = await generateResponseStream(
    llmMessages,
    (chunk) => {
      socket.emit("chat:reply:chunk", { chunk });
      streamingTts?.onChunk(chunk);
    },
    abortSignal,
    selectedModel
  );

  const streamedAudio = streamingTts ? await streamingTts.flush() : false;

  if (fullReply.trim()) {
    chat.addMessage("assistant", fullReply);
    await chat.save();
    await upsertEpisodeFromChat({ chat });
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

      const updatedChat = await Chat.findById(chatId);
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

      const updatedChat = await Chat.findById(chatId);
      if (updatedChat && updatedChat.messages.length > 0) {
        const lastMsg = updatedChat.messages[updatedChat.messages.length - 1];
        if (lastMsg.role === "assistant") {
          lastMsg.imageUrls = [...(lastMsg.imageUrls || []), ...imageUrls];
          await updatedChat.save();
        }
      }
    }
  }

  if (config.tts.enabled && !streamedAudio) {
    const audioUrl = await generateTTS(fullReply, voice);
    if (audioUrl) {
      socket.emit("audio:ready", { url: audioUrl });
    }
  }
};

export default {
  appendUserMessageToChat,
  getOrCreateChatSession,
  normalizeIncomingMessage,
  persistExchangeMemory,
  processAgentChatTurn,
  processStandardChatTurn
};
