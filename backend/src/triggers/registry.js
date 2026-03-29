import TriggerRule from "../models/TriggerRule.js";
import logger from "../utils/logger.js";

const BUILTIN_RULES = [
  {
    name: "daily-memory-consolidation",
    type: "cron",
    condition: { hour: 23, minute: 55 },
    action: "daily_memory_consolidation",
    enabled: true
  },
  {
    name: "workspace-source-watch",
    type: "file",
    condition: { path: "frontend/src", event: "change" },
    action: "notify_workspace_change",
    enabled: false
  },
  {
    name: "clipboard-error-watch",
    type: "clipboard",
    condition: { contains: "error|exception|traceback|stack trace", pollMs: 5000 },
    action: "debug_offer",
    enabled: false
  },
  {
    name: "memory-pressure-watch",
    type: "system",
    condition: { metric: "memory", threshold: 85, pollMs: 10000, cooldownMs: 60000 },
    action: "alert_user",
    enabled: false
  }
];

export const ensureBuiltinTriggers = async () => {
  for (const rule of BUILTIN_RULES) {
    try {
      await TriggerRule.findOneAndUpdate(
        { name: rule.name },
        { $setOnInsert: rule },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn({ err, rule: rule.name }, "Failed to ensure builtin trigger");
    }
  }
};

export const listTriggerRules = async () =>
  TriggerRule.find().sort({ createdAt: 1, name: 1 });

export const createTriggerRule = async ({ name, type, condition = {}, action, enabled = true }) =>
  TriggerRule.create({
    name: String(name || "").trim(),
    type: String(type || "").trim(),
    condition,
    action: String(action || "").trim(),
    enabled: Boolean(enabled)
  });

export const setTriggerEnabled = async ({ id, enabled }) =>
  TriggerRule.findByIdAndUpdate(
    id,
    { $set: { enabled: Boolean(enabled) } },
    { new: true }
  );

export default {
  ensureBuiltinTriggers,
  createTriggerRule,
  listTriggerRules,
  setTriggerEnabled
};
