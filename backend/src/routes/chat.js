import express from "express";
import Chat from "../models/Chat.js";
import { getRelevantDocs } from "../rag/retriever.js";
import { generateResponse } from "../services/llm.js";
import { buildChatMessages } from "../services/chatContext.js";
import { classifyQuery, resolveModelPreference } from "../services/chatRouter.js";
import { requireAuth } from "../middleware/auth.js";
import { searchInternetCached } from "../services/search.js";
import { resolveExternalData } from "../services/externalDataRouter.js";

const router = express.Router();

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

router.post("/", requireAuth, async (req, res) => {
  try {
    const { chatId, message, modelPreference, customModel, voice } = req.body;
    const userId = req.auth.userId;

    if (!message) {
      return res.status(400).json({ error: "Missing 'message' in request body" });
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
    const external = await resolveExternalData(message);
    const freshnessIntent = hasFreshnessIntent(message);
    const liveDataRequired = external.requiresLiveData || requiresLiveData(message) || freshnessIntent;
    const selectedModel = resolveModelPreference({
      preference: modelPreference,
      queryType,
      customModel
    });

    let searchContext = "";
    let liveDataAvailable = false;
    let liveResults = [];

    if (external.requiresLiveData && external.handled && external.reply) {
      chat.addMessage("assistant", external.reply);
      await chat.save();
      return res.json({ reply: external.reply, chatId: chat._id, model: selectedModel });
    }

    if (liveDataRequired) {
      const results = await searchInternetCached(buildSearchQuery(message, true));
      liveResults = Array.isArray(results) ? results : [];
      if (liveResults.length > 0) {
        liveDataAvailable = true;
        searchContext = formatSearchContext(liveResults);
      }
    }

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

    if ((liveDataRequired || freshnessIntent) && !liveDataAvailable && !external.liveDataAvailable) {
      const fallback = "I don't have real-time access for that request right now. I could not fetch live sources. Please retry in a moment or ask for a non-live summary.";
      chat.addMessage("assistant", fallback, { isError: true });
      await chat.save();
      return res.json({ reply: fallback, chatId: chat._id, model: selectedModel });
    }

    if (liveDataRequired && liveDataAvailable && liveResults.length > 0) {
      const deterministicReply = buildDeterministicLiveNewsReply(liveResults, new Date().toISOString());
      if (deterministicReply) {
        chat.addMessage("assistant", deterministicReply);
        await chat.save();
        return res.json({ reply: deterministicReply, chatId: chat._id, model: selectedModel });
      }
    }

    const messages = buildChatMessages({
      chatMessages: chat.messages,
      userMessage: message,
      operatorName: process.env.OPERATOR_NAME || "Operator",
      ragContext,
      searchContext,
      queryType,
      requiresLiveData: liveDataRequired,
      liveDataAvailable,
      voiceGender: voice || "male"
    });

    const reply = await generateResponse(messages, selectedModel);

    chat.addMessage("assistant", reply);
    await chat.save();

    res.json({ reply, chatId: chat._id, model: selectedModel });
  } catch (err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({
      error: "Failed to generate response"
    });
  }
});

export default router;
