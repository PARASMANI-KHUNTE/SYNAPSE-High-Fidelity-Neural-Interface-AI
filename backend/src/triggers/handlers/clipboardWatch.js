import { execFile } from "child_process";
import { promisify } from "util";
import TriggerRule from "../../models/TriggerRule.js";
import { publishTriggerEvent } from "../eventBus.js";
import logger from "../../utils/logger.js";

const execFileAsync = promisify(execFile);
const watcherRegistry = new Map();
const lastClipboardByRule = new Map();

const normalizePattern = (value = "") => String(value || "").trim();

const matchesClipboardRule = (rule, content) => {
  const pattern = normalizePattern(rule?.condition?.contains);
  if (!pattern) {
    return Boolean(content);
  }

  try {
    return new RegExp(pattern, "i").test(content);
  } catch {
    return content.toLowerCase().includes(pattern.toLowerCase());
  }
};

const readClipboardText = async () => {
  if (process.platform !== "win32") {
    return "";
  }

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-Clipboard -Raw"
    ], {
      timeout: 3000,
      windowsHide: true,
      maxBuffer: 1024 * 256
    });

    return String(stdout || "").trim();
  } catch (err) {
    logger.debug({ err }, "Clipboard read failed");
    return "";
  }
};

const stopStaleWatchers = (activeRuleIds = new Set()) => {
  for (const [ruleId, intervalId] of watcherRegistry.entries()) {
    if (activeRuleIds.has(ruleId)) {
      continue;
    }

    clearInterval(intervalId);
    watcherRegistry.delete(ruleId);
    lastClipboardByRule.delete(ruleId);
  }
};

const attachClipboardWatcher = (rule) => {
  const ruleId = String(rule._id);
  if (!ruleId || watcherRegistry.has(ruleId)) {
    return;
  }

  const intervalMs = Math.max(2000, Number(rule.condition?.pollMs) || 5000);

  const intervalId = setInterval(async () => {
    const content = await readClipboardText();
    if (!content) {
      return;
    }

    const lastSeen = lastClipboardByRule.get(ruleId);
    if (lastSeen === content) {
      return;
    }

    lastClipboardByRule.set(ruleId, content);

    if (!matchesClipboardRule(rule, content)) {
      return;
    }

    try {
      rule.lastFired = new Date();
      await rule.save();
    } catch (err) {
      logger.warn({ err, rule: rule.name }, "Failed to persist clipboard trigger timestamp");
    }

    const preview = content.length > 160 ? `${content.slice(0, 157)}...` : content;
    publishTriggerEvent({
      kind: "clipboard",
      ruleId,
      ruleName: rule.name,
      action: rule.action,
      message: `${rule.name} noticed matching clipboard content.`,
      details: {
        preview,
        pattern: rule.condition?.contains || "",
        pollMs: intervalMs
      }
    });
  }, intervalMs);

  watcherRegistry.set(ruleId, intervalId);
};

export const syncClipboardWatchers = async () => {
  const rules = await TriggerRule.find({
    enabled: true,
    type: "clipboard"
  }).sort({ createdAt: 1, name: 1 });

  const activeRuleIds = new Set(rules.map((rule) => String(rule._id)));
  stopStaleWatchers(activeRuleIds);

  for (const rule of rules) {
    try {
      attachClipboardWatcher(rule);
    } catch (err) {
      logger.warn({ err, rule: rule.name }, "Failed to attach clipboard watcher");
    }
  }
};

export default {
  syncClipboardWatchers
};
