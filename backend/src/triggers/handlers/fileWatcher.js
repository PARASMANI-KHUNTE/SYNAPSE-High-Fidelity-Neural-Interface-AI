import fs from "fs";
import path from "path";
import TriggerRule from "../../models/TriggerRule.js";
import { publishTriggerEvent } from "../eventBus.js";
import logger from "../../utils/logger.js";

const watcherRegistry = new Map();
const debounceRegistry = new Map();
const PROJECT_ROOT = process.cwd();

const normalizeRulePath = (watchPath = "") => {
  const resolved = path.resolve(PROJECT_ROOT, String(watchPath || ""));
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error("Watch path outside project scope");
  }
  return resolved;
};

const matchesEventType = (expected, actual) => {
  if (!expected || expected === "any") {
    return true;
  }
  return String(expected).toLowerCase() === String(actual).toLowerCase();
};

const clearWatchers = (activeRuleIds = new Set()) => {
  for (const [ruleId, watcher] of watcherRegistry.entries()) {
    if (activeRuleIds.has(ruleId)) {
      continue;
    }

    try {
      watcher.close();
    } catch (err) {
      logger.warn({ err, ruleId }, "Failed to close file watcher");
    }
    watcherRegistry.delete(ruleId);
  }
};

const scheduleFileAlert = ({ rule, eventType, filename }) => {
  const debounceKey = `${rule._id}:${filename || "unknown"}`;
  if (debounceRegistry.has(debounceKey)) {
    clearTimeout(debounceRegistry.get(debounceKey));
  }

  const timeout = setTimeout(async () => {
    debounceRegistry.delete(debounceKey);

    try {
      rule.lastFired = new Date();
      await rule.save();
    } catch (err) {
      logger.warn({ err, rule: rule.name }, "Failed to persist file trigger timestamp");
    }

    publishTriggerEvent({
      kind: "file",
      ruleId: String(rule._id),
      ruleName: rule.name,
      action: rule.action,
      message: `${rule.name} noticed a ${eventType} event${filename ? ` for ${filename}` : ""}.`,
      details: {
        eventType,
        filename: filename || "",
        path: rule.condition?.path || ""
      }
    });
  }, 350);

  debounceRegistry.set(debounceKey, timeout);
};

const attachRuleWatcher = (rule) => {
  if (!rule?._id || watcherRegistry.has(String(rule._id))) {
    return;
  }

  const watchPath = normalizeRulePath(rule.condition?.path || "");
  if (!fs.existsSync(watchPath)) {
    logger.warn({ rule: rule.name, watchPath }, "Skipping file trigger because path does not exist");
    return;
  }

  const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
    if (!matchesEventType(rule.condition?.event, eventType)) {
      return;
    }

    scheduleFileAlert({
      rule,
      eventType,
      filename: filename ? String(filename) : ""
    });
  });

  watcher.on("error", (err) => {
    logger.warn({ err, rule: rule.name }, "File watcher emitted an error");
  });

  watcherRegistry.set(String(rule._id), watcher);
};

export const syncFileWatchers = async () => {
  const rules = await TriggerRule.find({
    enabled: true,
    type: "file"
  }).sort({ createdAt: 1, name: 1 });

  const activeRuleIds = new Set(rules.map((rule) => String(rule._id)));
  clearWatchers(activeRuleIds);

  for (const rule of rules) {
    try {
      attachRuleWatcher(rule);
    } catch (err) {
      logger.warn({ err, rule: rule.name }, "Failed to attach file watcher");
    }
  }
};

export default {
  syncFileWatchers
};
