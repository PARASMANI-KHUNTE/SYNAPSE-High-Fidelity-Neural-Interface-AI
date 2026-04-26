import path from "path";
import fs from "fs";
import fsp from "fs/promises";
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
import perceptionService from "./perceptionService.js";
import { resolveExternalData } from "./externalDataRouter.js";
import { verifyClaims } from "./factVerification.js";

const WEB_SEARCH_HINT_PATTERNS = [
  /\b(search|web|internet)\b/i,
  /\b(latest|today|current|news|now|updated)\b/i,
  /\b(link|url|source|sources|cite|citation|official)\b/i,
  /\b(video|tutorial)\b/i
];
const CURRENT_DATA_PATTERNS = [
  /\b(weather|forecast|temperature|rain|storm)\b/i,
  /\b(stock|price|market|crypto|bitcoin|ethereum)\b/i,
  /\b(election|president|prime minister|ceo|minister|government)\b/i,
  /\b(score|match|game|standing|schedule|transfer)\b/i,
  /\b(release date|launch|version|update|updated)\b/i,
  /\b(hotspot|hotspots|war|conflict|geopolitics|geopolitical)\b/i
];

const REALTIME_NEWS_PATTERNS = [
  /\b(top|latest|breaking|happening|headlines?)\b/i,
  /\b(today|this week|right now|currently|current events?)\b/i,
  /\b(world|global)\b/i
];

const MOVIE_RELEASE_PATTERNS = [
  /\b(movie|movies|film|films|cinema|box office)\b/i,
  /\b(release|released|releases|opening|in theaters|now showing|latest|new)\b/i
];

const DYNAMIC_RELEASE_PATTERNS = [
  /\b(release|released|releases|launch|launched|announce|announced|newly released)\b/i,
  /\b(song|album|game|games|phone|iphone|android|gpu|cpu|series|episode|show|movie|film)\b/i
];

const NEWS_CATEGORY_RULES = [
  { key: "economy", pattern: /\b(economy|economic|inflation|interest rate|gdp|market|stocks?|bond|trade|tariff|oil|energy price)\b/i },
  { key: "technology", pattern: /\b(ai|artificial intelligence|chip|semiconductor|openai|google|microsoft|apple|meta|launch|space|science|research)\b/i },
  { key: "policy", pattern: /\b(policy|law|bill|regulation|court|election|government|parliament|senate|president|prime minister)\b/i },
  { key: "geopolitics", pattern: /\b(war|conflict|sanction|military|ceasefire|attack|border|nato|un)\b/i }
];

const LOCATION_KEYWORDS = [
  "Ukraine", "Russia", "Gaza", "Israel", "Sudan", "Myanmar", "China", "Taiwan", "US", "USA",
  "United States", "Europe", "UK", "India", "Pakistan", "Iran", "Iraq", "Syria", "Yemen",
  "South Korea", "North Korea", "Japan", "Germany", "France", "Brazil", "Mexico", "Canada"
];

const FRESHNESS_INTENT_PATTERNS = [
  /\b(latest|current|today|right now|this week|up[- ]to[- ]date|breaking|live|recent|new)\b/i,
  /\b(news|headlines?|happening|events?|updates?|release|price|weather|score|market)\b/i
];

const LOCAL_OR_STATIC_PATTERNS = [
  /\b(sum|multiply|equation|algebra|integral|differentiate|derivative)\b/i,
  /\b(explain|define|meaning of|what is)\b/i,
  /\b(my memory|my profile|remember|about me)\b/i,
  /\b(code|debug|function|class|algorithm)\b/i
];

const shouldSearchInternet = ({ message, actualFileType, hasImages = false }) => {
  const text = String(message || "");

  if (actualFileType === "image" || actualFileType === "file" || hasImages) {
    return false;
  }

  if (WEB_SEARCH_HINT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (CURRENT_DATA_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  // Default to live verification for general knowledge/reasoning requests unless clearly local/static.
  if (!LOCAL_OR_STATIC_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  return false;
};

const requiresLiveData = (message = "") => {
  const text = String(message || "");
  const isRealtimeIntent = REALTIME_NEWS_PATTERNS.some((pattern) => pattern.test(text));
  const asksForTopList = /\b(top\s*\d+|top\s+five|top\s+5|five\s+things?)\b/i.test(text);
  const asksForNews = /\b(news|headlines?|happening|current events?)\b/i.test(text);
  const asksMovieReleases = MOVIE_RELEASE_PATTERNS.every((pattern) => pattern.test(text));
  const asksDynamicReleases = DYNAMIC_RELEASE_PATTERNS.every((pattern) => pattern.test(text)) && (asksForTopList || /\blatest|new|recent\b/i.test(text));
  return isRealtimeIntent || asksForNews || asksMovieReleases || asksDynamicReleases;
};

const hasFreshnessIntent = (message = "") => {
  const text = String(message || "");
  return FRESHNESS_INTENT_PATTERNS.some((pattern) => pattern.test(text));
};

const buildSearchQuery = (message = "", liveRequired = false) => {
  const base = String(message || "").trim();
  if (!liveRequired) return base;
  if (MOVIE_RELEASE_PATTERNS.every((pattern) => pattern.test(base))) {
    return `${base} latest movie releases this week source imdb rotten tomatoes variety deadline hollywood reporter`;
  }
  return `${base} latest world news today economy markets technology policy science site:reuters.com OR site:apnews.com OR site:bbc.com OR site:ft.com`;
};

const formatSearchContext = (results = []) => {
  const now = new Date().toISOString();
  const rows = Array.isArray(results) ? results.filter(Boolean) : [];
  return rows
    .slice(0, 8)
    .map((result, index) => {
      const title = String(result?.title || "Untitled").trim();
      const snippet = String(result?.snippet || "").replace(/\s+/g, " ").trim();
      const source = String(result?.source || "unknown").trim();
      const url = String(result?.url || "").trim();
      const fetchedAt = String(result?.fetchedAt || now).trim();
      return [
        `${index + 1}. ${title}`,
        `Source: ${source}`,
        `URL: ${url || "N/A"}`,
        `FetchedAt: ${fetchedAt}`,
        `Snippet: ${snippet}`
      ].join("\n");
    })
    .join("\n\n");
};

const classifyNewsCategory = (title = "", snippet = "") => {
  const text = `${title} ${snippet}`;
  for (const rule of NEWS_CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.key;
  }
  return "general";
};

const extractWhere = (title = "", snippet = "") => {
  const text = `${title} ${snippet}`;
  for (const keyword of LOCATION_KEYWORDS) {
    const rx = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i");
    if (rx.test(text)) return keyword;
  }
  return "Global";
};

const buildDeterministicLiveNewsReply = (results = [], asOfIso = new Date().toISOString()) => {
  const items = (Array.isArray(results) ? results : [])
    .filter((r) => r?.title && r?.url)
    .map((r) => {
      const title = String(r.title).trim();
      const snippet = String(r.snippet || "").replace(/\s+/g, " ").trim();
      const source = String(r.source || "unknown").trim();
      const url = String(r.url || "").trim();
      const fetchedAt = String(r.fetchedAt || asOfIso).trim();
      const category = classifyNewsCategory(title, snippet);
      const where = extractWhere(title, snippet);
      const summary = snippet.length > 180 ? `${snippet.slice(0, 177)}...` : snippet;
      const categoryBoost = category === "general" ? 0 : 1;
      const score = (summary.length > 40 ? 1 : 0) + categoryBoost;
      return { title, summary, source, url, fetchedAt, category, where, score };
    })
    .sort((a, b) => b.score - a.score);

  const chosen = [];
  const seenCategories = new Set();

  for (const item of items) {
    if (chosen.length >= 5) break;
    if (item.category !== "general" && !seenCategories.has(item.category)) {
      chosen.push(item);
      seenCategories.add(item.category);
    }
  }

  for (const item of items) {
    if (chosen.length >= 5) break;
    if (!chosen.includes(item)) chosen.push(item);
  }

  if (chosen.length === 0) return "";

  const asOf = asOfIso.slice(0, 19).replace("T", " ");
  const lines = [`As of ${asOf} UTC, here are the latest headline signals:`];

  chosen.forEach((item, idx) => {
    lines.push(
      "",
      `${idx + 1}. ${item.title}`,
      `Where: ${item.where}`,
      `When: ${item.fetchedAt}`,
      `Source: ${item.source} (${item.url})`,
      `Summary: ${item.summary || "No summary available."}`
    );
  });

  return lines.join("\n");
};

const emitPhase = (socket, phase, emoji, detail = "") => {
  socket.emit("chat:phase", { phase, emoji, detail, ts: Date.now() });
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
const STREAM_TTS_MIN_CHARS_INITIAL = parseInt(process.env.TTS_STREAM_MIN_CHARS_INITIAL || "80", 10) || 80;
const STREAM_TTS_MIN_CHARS = parseInt(process.env.TTS_STREAM_MIN_CHARS || "140", 10) || 140;
const STREAM_TTS_MAX_BUFFER = parseInt(process.env.TTS_STREAM_MAX_BUFFER || "520", 10) || 520;
const STREAM_TTS_MAX_INFLIGHT = parseInt(process.env.TTS_STREAM_MAX_INFLIGHT || "2", 10) || 2;

const splitAtWordBoundary = (text, maxLen) => {
  const clean = String(text || "").trim();
  if (clean.length <= maxLen) return [clean];

  const parts = [];
  let remaining = clean;
  while (remaining.length > maxLen) {
    let sliceLen = maxLen;
    const lastSpace = remaining.lastIndexOf(" ", maxLen);
    if (lastSpace > Math.floor(maxLen * 0.6)) {
      sliceLen = lastSpace;
    }
    const head = remaining.slice(0, sliceLen).trim();
    remaining = remaining.slice(sliceLen).trim();
    if (head) parts.push(head);
  }
  if (remaining) parts.push(remaining);
  return parts;
};

let sharpLoaderPromise = null;
const getSharp = async () => {
  if (sharpLoaderPromise) return sharpLoaderPromise;
  sharpLoaderPromise = (async () => {
    try {
      const mod = await import("sharp");
      return mod?.default || mod;
    } catch {
      return null;
    }
  })();
  return sharpLoaderPromise;
};

const VISION_IMAGE_MAX_SIDE = parseInt(process.env.VISION_IMAGE_MAX_SIDE || "1024", 10) || 1024;

const maybeResizeImageBuffer = async (buffer) => {
  const sharp = await getSharp();
  if (!sharp) return buffer;

  try {
    return await sharp(buffer)
      .rotate()
      .resize({
        width: VISION_IMAGE_MAX_SIDE,
        height: VISION_IMAGE_MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return buffer;
  }
};

const fileToVisionBase64 = async (filepath) => {
  if (!fileExists(filepath)) return null;
  const buffer = await fsp.readFile(filepath);
  const resized = await maybeResizeImageBuffer(buffer);
  return resized.toString("base64");
};

const imageUrlToBase64 = async (imageUrl) => {
  const filepath = resolveUploadedFilePath(imageUrl);
  return await fileToVisionBase64(filepath);
};

const localImagePathToBase64 = async (localPath) => {
  if (!localPath) return null;
  return await fileToVisionBase64(localPath);
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
      const split = splitAtWordBoundary(segment, STREAM_TTS_MAX_BUFFER);
      for (const part of split) {
        if (!part) continue;
        const safePart = part + (/[.!?,;:]$/.test(part) ? "" : ",");
        segments.push(safePart);
      }
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

const createStreamingTts = ({ socket, voice, getVoice, abortSignal }) => {
  let buffer = "";
  let emittedAny = false;
  let queuedAny = false;
  let seq = 0;
  let nextToEmit = 0;
  let lastSegmentKey = "";
  const resultsBySeq = new Map();
  let inFlight = 0;
  const waiters = [];

  const acquire = () =>
    new Promise((resolve) => {
      if (inFlight < STREAM_TTS_MAX_INFLIGHT) {
        inFlight += 1;
        resolve();
        return;
      }
      waiters.push(resolve);
    });

  const release = () => {
    inFlight = Math.max(0, inFlight - 1);
    if (waiters.length > 0 && inFlight < STREAM_TTS_MAX_INFLIGHT) {
      inFlight += 1;
      const resolve = waiters.shift();
      resolve?.();
    }
  };

  const tryEmitReady = () => {
    while (resultsBySeq.has(nextToEmit)) {
      const audioUrl = resultsBySeq.get(nextToEmit);
      resultsBySeq.delete(nextToEmit);
      nextToEmit += 1;

      if (abortSignal?.aborted) {
        continue;
      }

      if (audioUrl) {
        emittedAny = true;
        socket.emit("audio:ready", { url: audioUrl });
      }
    }
  };

  const enqueue = (text) => {
    const segment = String(text || "").replace(/\s+/g, " ").trim();
    if (!segment) return;

    const segmentKey = segment.toLowerCase();
    if (segmentKey === lastSegmentKey) {
      return;
    }
    lastSegmentKey = segmentKey;

    queuedAny = true;
    const mySeq = seq++;
    const voiceForChunk = String(getVoice?.() || voice || "male").toLowerCase() === "female" ? "female" : "male";

    void (async () => {
      await acquire();
      try {
        if (abortSignal?.aborted) {
          resultsBySeq.set(mySeq, null);
          tryEmitReady();
          return;
        }

        const audioUrl = await generateTTS(segment, voiceForChunk).catch((err) => {
          console.warn("Streaming TTS chunk failed:", err.message);
          return null;
        });

        resultsBySeq.set(mySeq, audioUrl);
        tryEmitReady();
      } finally {
        release();
      }
    })();
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

      // Wait until all generated (or failed) segments up to `seq` have been emitted/handled.
      const expected = seq;
      while (!abortSignal?.aborted && nextToEmit < expected) {
        await new Promise((r) => setTimeout(r, 40));
      }
      return emittedAny;
    }
  };
};

const buildImagePayload = async (imageUrls = []) => {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 3) : [];
  const payload = [];
  for (const url of urls) {
    const b64 = await imageUrlToBase64(url);
    if (b64) payload.push(b64);
  }
  return payload;
};

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
  voice,
  abortSignal
}) => {
  const task = plan.tasks[0];
  const runId = `chat_agent_${Date.now()}`;



  try {
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
      const screenshotBase64 = await localImagePathToBase64(execution.result.metadata.filePath);
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
        queryType: "VISION",
        voiceGender: voice || "male",
        emotion: perceptionService.getEmotion()
      });
      const visionModel = resolveModelPreference({
        preference: modelPreference,
        queryType: "VISION",
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
  } finally {

  }
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
  try {
    emitPhase(socket, "thinking", "🤔", "Understanding your request");
    const hasUserImages = (Array.isArray(uploadedImageUrls) && uploadedImageUrls.length > 0) || actualFileType === "image";
    const queryType = classifyQuery(trimmedMessage, { hasImages: hasUserImages });

    const shortWordCount = String(trimmedMessage || "").trim().split(/\s+/).filter(Boolean).length;
    const isShortMessage = shortWordCount < 8;
    const isRAGRequired = shouldUseRAG(queryType) && !isShortMessage && !hasUserImages;

    const selectedModel = resolveModelPreference({
      preference: modelPreference,
      queryType,
      hasImages: hasUserImages,
      customModel
    });

    const external = await resolveExternalData(trimmedMessage);

    if (external.requiresLiveData && external.handled && external.reply) {
      emitPhase(socket, "generating", "🧩", "Using external live APIs");
      socket.emit("chat:reply:chunk", { chunk: external.reply });
      socket.emit("chat:reply:end");
      emitPhase(socket, "done", "✅", "Response ready");

      chat.addMessage("assistant", external.reply);
      await chat.save();
      await upsertEpisodeFromChat({ chat });

      if (config.tts.enabled) {
        const audioUrl = await generateTTS(external.reply, voice);
        if (audioUrl) {
          socket.emit("audio:ready", { url: audioUrl });
        }
      }
      return;
    }

    const freshnessIntent = hasFreshnessIntent(trimmedMessage);
    const liveDataRequired = external.requiresLiveData || requiresLiveData(trimmedMessage) || freshnessIntent;



    socket.emit("chat:reply:start");
    socket.emit("chat:model", { preference: modelPreference || "auto", model: selectedModel, queryType });

    const imagePayload = hasUserImages ? await buildImagePayload(uploadedImageUrls) : [];
    const hasImages = imagePayload.length > 0 || actualFileType === "image";

    let ragContext = "";
    if (isRAGRequired) {
      emitPhase(socket, "comparing", "🧠", "Checking internal knowledge context");
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
    let searchResults = [];
    let liveDataAvailable = false;
    if (shouldSearchInternet({
      message: trimmedMessage,
      actualFileType,
      hasImages
    })) {
      emitPhase(socket, "scraping", "🌐", "Checking real-time web data");
      const searchKey = getCacheKey("search", trimmedMessage);
      if (searchCache.has(searchKey)) {
        const cached = searchCache.get(searchKey);
        if (typeof cached === "string") {
          searchContext = cached;
        } else {
          searchContext = String(cached?.context || "");
          searchResults = Array.isArray(cached?.results) ? cached.results : [];
          liveDataAvailable = Boolean(cached?.liveDataAvailable);
        }
      } else {
        const queryForSearch = buildSearchQuery(trimmedMessage, liveDataRequired);
        const searchJob = await addChatJob({ type: "web-search", payload: { query: queryForSearch } });
        const results = await searchJob.waitUntilFinished();
        if (results && results.length > 0) {
          searchResults = Array.isArray(results) ? results : [];
          searchContext = formatSearchContext(results);
          liveDataAvailable = true;
          searchCache.set(searchKey, {
            context: searchContext,
            results: searchResults,
            liveDataAvailable: true,
            ts: Date.now()
          });
        }
      }
    }

    if ((liveDataRequired || freshnessIntent) && !searchContext && !external.liveDataAvailable) {
      console.warn("⚠️ Real-time data requested but search returned no results. Proceeding with internal knowledge.");
    }

    if (liveDataRequired && liveDataAvailable && searchResults.length > 0) {
      emitPhase(socket, "generating", "📰", "Ranking fresh headlines from live sources");
      const deterministicReply = buildDeterministicLiveNewsReply(searchResults, new Date().toISOString());

      if (deterministicReply) {
        socket.emit("chat:reply:chunk", { chunk: deterministicReply });
        socket.emit("chat:reply:end");
        emitPhase(socket, "done", "✅", "Response ready");

        chat.addMessage("assistant", deterministicReply);
        await chat.save();
        await upsertEpisodeFromChat({ chat });

        if (config.tts.enabled) {
          const audioUrl = await generateTTS(deterministicReply, voice);
          if (audioUrl) {
            socket.emit("audio:ready", { url: audioUrl });
          }
        }
        return;
      }
    }

    const memoryContext = await queryMemoryContext({
      userId,
      query: trimmedMessage
    });
    emitPhase(socket, "comparing", "⚖️", "Comparing memory, context, and live data");
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
      requiresLiveData: liveDataRequired,
      liveDataAvailable,
      voiceGender: voice || "male",
      emotion: perceptionService.getEmotion()
    });

    const streamingTts = config.tts.enabled ? createStreamingTts({
      socket,
      voice,
      getVoice: () => socket.data?.voicePreference || voice || "male",
      abortSignal
    }) : null;

    let fullReply = "";
    emitPhase(socket, "generating", "✍️", "Generating your response");
    fullReply = await generateResponseStream(
      llmMessages,
      (chunk) => {
        socket.emit("chat:reply:chunk", { chunk });
        streamingTts?.onChunk(chunk);
      },
      abortSignal,
      selectedModel
    );

    const streamedAudio = streamingTts ? await streamingTts.flush() : false;

    if (liveDataRequired && fullReply.length > 100) {
      emitPhase(socket, "verifying", "🔍", "Verifying facts against live web data");
      const verification = await verifyClaims(fullReply);
      
      if (verification.hasContradictions) {
        const warningMsg = `\n\n⚠️ **Fact Check Warning**: ${verification.summary}\nSome claims in this response may require verification.`;
        socket.emit("chat:reply:chunk", { chunk: warningMsg });
        fullReply += warningMsg;
        socket.emit("chat:verification", { 
          confidence: verification.overallConfidence,
          warning: verification.summary,
          claims: verification.claims.filter(c => c.status === "contradicted").map(c => c.claim)
        });
      } else if (verification.verified && verification.overallConfidence > 0.7) {
        socket.emit("chat:verification", { 
          confidence: verification.overallConfidence,
          verified: true,
          summary: verification.summary
        });
      }
    }

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
    emitPhase(socket, "done", "✅", "Response ready");

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
  } finally {

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
