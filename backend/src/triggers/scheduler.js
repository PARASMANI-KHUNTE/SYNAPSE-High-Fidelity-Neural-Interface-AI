import Chat from "../models/Chat.js";
import MemoryEpisode from "../models/MemoryEpisode.js";
import { generateResponse } from "../services/llm.js";
import { ensureBuiltinTriggers, listTriggerRules } from "./registry.js";
import { publishTriggerEvent } from "./eventBus.js";
import { syncClipboardWatchers } from "./handlers/clipboardWatch.js";
import { syncFileWatchers } from "./handlers/fileWatcher.js";
import { syncSystemMonitors } from "./handlers/systemMonitor.js";
import logger from "../utils/logger.js";

const DEFAULT_TICK_MS = 60_000;
let schedulerHandle = null;
let schedulerRunning = false;

const startOfDay = (date = new Date()) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const endOfDay = (date = new Date()) => {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
};

const shouldFireCronRule = (rule, now = new Date()) => {
  const hour = Number(rule?.condition?.hour);
  const minute = Number(rule?.condition?.minute);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return false;
  }

  if (now.getHours() !== hour || now.getMinutes() !== minute) {
    return false;
  }

  if (!rule.lastFired) {
    return true;
  }

  const last = new Date(rule.lastFired);
  return last.toDateString() !== now.toDateString();
};

const heuristicDailySummary = (episodes = []) => {
  if (episodes.length === 0) {
    return {
      summary: "No significant activity captured for today.",
      topics: [],
      decisions: [],
      actions: []
    };
  }

  const topics = Array.from(new Set(episodes.flatMap((episode) => episode.topics || []))).slice(0, 8);
  const decisions = Array.from(new Set(episodes.flatMap((episode) => episode.decisions || []))).slice(0, 6);
  const actions = Array.from(new Set(episodes.flatMap((episode) => episode.actions || []))).slice(0, 6);
  const summary = `Daily consolidation: ${episodes.map((episode) => episode.summary).slice(0, 3).join(" | ")}`.substring(0, 5000);

  return { summary, topics, decisions, actions };
};

const refineDailySummary = async ({ episodes, fallback }) => {
  if (episodes.length === 0) return fallback;

  const prompt = [
    "Return strict JSON with keys: summary, topics, decisions, actions.",
    "Summarize this day's activity for a local AI assistant.",
    "summary must be one concise paragraph.",
    "topics, decisions, and actions must be arrays of short strings.",
    "",
    ...episodes.map((episode, index) => `Episode ${index + 1}: ${episode.summary}`)
  ].join("\n");

  try {
    const response = await generateResponse([
      { role: "system", content: "You return strict JSON only." },
      { role: "user", content: prompt }
    ]);
    const jsonMatch = String(response || "").match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallback;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: String(parsed.summary || fallback.summary).substring(0, 5000),
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String).slice(0, 8) : fallback.topics,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String).slice(0, 6) : fallback.decisions,
      actions: Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 6) : fallback.actions
    };
  } catch (err) {
    logger.warn({ err }, "Failed to refine daily memory consolidation");
    return fallback;
  }
};

const runDailyMemoryConsolidation = async () => {
  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());
  const userIds = await Chat.distinct("userId", {
    updatedAt: { $gte: dayStart, $lte: dayEnd }
  });

  for (const userId of userIds) {
    try {
      const episodes = await MemoryEpisode.find({
        userId,
        date: dayStart,
        kind: { $ne: "daily" }
      }).sort({ updatedAt: -1 });

      const fallback = heuristicDailySummary(episodes);
      const refined = await refineDailySummary({ episodes, fallback });

      await MemoryEpisode.findOneAndUpdate(
        {
          userId,
          date: dayStart,
          kind: "daily"
        },
        {
          $set: {
            summary: refined.summary,
            topics: refined.topics,
            decisions: refined.decisions,
            actions: refined.actions,
            sessionIds: Array.from(new Set(episodes.flatMap((episode) => episode.sessionIds || []))),
            label: "Daily Consolidation"
          },
          $setOnInsert: {
            userId,
            date: dayStart,
            kind: "daily"
          }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn({ err, userId }, "Daily memory consolidation failed for user");
    }
  }
};

const runTriggerAction = async (rule) => {
  if (rule.action === "daily_memory_consolidation") {
    await runDailyMemoryConsolidation();
    publishTriggerEvent({
      kind: "cron",
      ruleId: String(rule._id),
      ruleName: rule.name,
      action: rule.action,
      message: "Daily memory consolidation completed."
    });
    return;
  }

  logger.info({ rule: rule.name, action: rule.action }, "No handler registered for trigger action");
};

const tickScheduler = async () => {
  if (schedulerRunning) return;
  schedulerRunning = true;

  try {
    const rules = await listTriggerRules();
    const now = new Date();

    await syncClipboardWatchers();
    await syncFileWatchers();
    await syncSystemMonitors();

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.type === "cron" && shouldFireCronRule(rule, now)) {
        logger.info({ rule: rule.name, action: rule.action }, "Running scheduled trigger");
        await runTriggerAction(rule);
        rule.lastFired = now;
        await rule.save();
      }
    }
  } catch (err) {
    logger.error({ err }, "Trigger scheduler tick failed");
  } finally {
    schedulerRunning = false;
  }
};

export const initScheduler = async () => {
  await ensureBuiltinTriggers();
  await syncClipboardWatchers();
  await syncFileWatchers();
  await syncSystemMonitors();
  if (schedulerHandle) return schedulerHandle;

  schedulerHandle = setInterval(() => {
    void tickScheduler();
  }, DEFAULT_TICK_MS);

  logger.info({ intervalMs: DEFAULT_TICK_MS }, "Trigger scheduler initialized");
  void tickScheduler();
  return schedulerHandle;
};

export default {
  initScheduler
};
