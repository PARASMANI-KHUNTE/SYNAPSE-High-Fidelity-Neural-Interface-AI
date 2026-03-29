import MemoryEpisode from "../models/MemoryEpisode.js";
import { getSessionWindow } from "./sessionMemory.js";
import { generateResponse } from "../services/llm.js";
import logger from "../utils/logger.js";

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "been", "from", "have", "into", "just", "more",
  "that", "their", "them", "they", "this", "with", "would", "your", "what", "when",
  "where", "which", "while", "there", "were", "will", "shall", "could", "should"
]);

const startOfDay = (date = new Date()) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const compact = (values = []) => values.filter(Boolean);
const pendingEpisodeRefreshes = new Map();

const summarizeMessages = (messages = []) => {
  const userMessages = messages.filter((message) => message.role === "user" && message.content).slice(-4);
  if (userMessages.length === 0) {
    return "No major session summary available yet.";
  }

  const fragments = userMessages.map((message) => message.content.trim().replace(/\s+/g, " ").substring(0, 120));
  return `Recent session focus: ${fragments.join(" | ")}`;
};

const buildEpisodePrompt = (messages = []) => {
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${String(message.content || "").trim().substring(0, 300)}`)
    .join("\n");

  return [
    "You are summarizing a local AI assistant session.",
    "Return strict JSON with keys: summary, topics, decisions, actions.",
    "summary must be one concise paragraph.",
    "topics, decisions, and actions must each be arrays of short strings.",
    "If an array has no items, return an empty array.",
    "",
    transcript
  ].join("\n");
};

const safeJsonParse = (text = "") => {
  const trimmed = String(text || "").trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in summarizer response");
  }
  return JSON.parse(jsonMatch[0]);
};

const normalizeSummaryPayload = (payload, fallback) => ({
  summary: String(payload?.summary || fallback.summary || "No major session summary available yet.").trim().substring(0, 5000),
  topics: compact((payload?.topics || fallback.topics || []).map((item) => String(item).trim().substring(0, 120))).slice(0, 6),
  decisions: compact((payload?.decisions || fallback.decisions || []).map((item) => String(item).trim().substring(0, 160))).slice(0, 5),
  actions: compact((payload?.actions || fallback.actions || []).map((item) => String(item).trim().substring(0, 160))).slice(0, 5)
});

const extractTopics = (messages = []) => {
  const counts = new Map();
  for (const message of messages) {
    for (const token of tokenize(message.content)) {
      if (token.length < 4 || STOP_WORDS.has(token)) continue;
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([token]) => token);
};

const extractDecisions = (messages = []) =>
  messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .filter((content) => /\b(i will|i want to|let's|we should|i'm going to)\b/i.test(content))
    .slice(-3)
    .map((content) => content.trim().substring(0, 160));

const extractActions = (messages = []) => {
  const actions = [];
  for (const message of messages.filter((entry) => entry.role === "assistant")) {
    const toolMatch = message.content.match(/I handled that with the `([^`]+)` tool/i);
    if (toolMatch) {
      actions.push(`Used ${toolMatch[1]} tool`);
    }
    if (/PDF report generated/i.test(message.content)) {
      actions.push("Generated PDF report");
    }
  }
  return Array.from(new Set(actions)).slice(-4);
};

const createHeuristicEpisode = (messages = []) => ({
  summary: summarizeMessages(messages),
  topics: extractTopics(messages),
  decisions: extractDecisions(messages),
  actions: extractActions(messages)
});

const scoreEpisode = (episode, queryTerms) => {
  const haystack = [
    episode.summary,
    ...(episode.topics || []),
    ...(episode.decisions || []),
    ...(episode.actions || [])
  ].join(" ").toLowerCase();

  let score = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) score += 1;
  }
  return score;
};

export const getRelevantEpisodes = async ({ userId, query = "", limit = 3 }) => {
  if (!userId) return [];

  try {
    const episodes = await MemoryEpisode.find({ userId })
      .sort({ date: -1, updatedAt: -1 })
      .limit(Math.max(limit * 3, 6));

    if (episodes.length === 0) return [];

    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) {
      return episodes.slice(0, limit);
    }

    return episodes
      .map((episode) => ({ episode, score: scoreEpisode(episode, queryTerms) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || right.episode.date - left.episode.date)
      .slice(0, limit)
      .map(({ episode }) => episode);
  } catch (err) {
    logger.warn({ err, userId }, "Failed to fetch episodic memory");
    return [];
  }
};

export const refreshEpisodeSummaryInBackground = async ({ episodeId, messages = [] }) => {
  if (!episodeId || messages.length === 0) return;
  if (pendingEpisodeRefreshes.has(episodeId)) return pendingEpisodeRefreshes.get(episodeId);

  const fallback = createHeuristicEpisode(messages);
  const task = (async () => {
    try {
      const response = await generateResponse([
        { role: "system", content: "You produce strict JSON only." },
        { role: "user", content: buildEpisodePrompt(messages) }
      ]);

      const parsed = safeJsonParse(response);
      const normalized = normalizeSummaryPayload(parsed, fallback);

      await MemoryEpisode.findByIdAndUpdate(episodeId, {
        $set: normalized
      });
    } catch (err) {
      logger.warn({ err, episodeId }, "Background episode summarization failed");
    } finally {
      pendingEpisodeRefreshes.delete(episodeId);
    }
  })();

  pendingEpisodeRefreshes.set(episodeId, task);
  return task;
};

export const upsertEpisodeFromChat = async ({ chat }) => {
  if (!chat?.userId || !chat?._id) return null;

  const window = getSessionWindow(chat, 12);
  if (window.length === 0) return null;

  const date = startOfDay(new Date());
  const sessionId = String(chat._id);
  const heuristic = createHeuristicEpisode(window);

  try {
    const existing = await MemoryEpisode.findOne({
      userId: chat.userId,
      date,
      sessionIds: sessionId,
      kind: "session"
    });

    if (existing) {
      existing.summary = heuristic.summary;
      existing.topics = heuristic.topics;
      existing.decisions = heuristic.decisions;
      existing.actions = heuristic.actions;
      await existing.save();
      void refreshEpisodeSummaryInBackground({ episodeId: String(existing._id), messages: window });
      return existing;
    }

    const created = await MemoryEpisode.create({
      userId: chat.userId,
      date,
      sessionIds: [sessionId],
      kind: "session",
      label: "Session Episode",
      summary: heuristic.summary,
      topics: heuristic.topics,
      decisions: heuristic.decisions,
      actions: heuristic.actions
    });
    void refreshEpisodeSummaryInBackground({ episodeId: String(created._id), messages: window });
    return created;
  } catch (err) {
    logger.warn({ err, userId: chat.userId, sessionId }, "Failed to upsert episodic memory");
    return null;
  }
};

export default {
  getRelevantEpisodes,
  refreshEpisodeSummaryInBackground,
  upsertEpisodeFromChat
};
