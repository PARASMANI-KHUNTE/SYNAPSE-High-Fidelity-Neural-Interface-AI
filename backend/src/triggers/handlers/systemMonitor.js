import TriggerRule from "../../models/TriggerRule.js";
import { getSystemStatus } from "../../services/systemStatus.js";
import { publishTriggerEvent } from "../eventBus.js";
import logger from "../../utils/logger.js";

const watcherRegistry = new Map();
const lastAlertAtByRule = new Map();

const stopStaleMonitors = (activeRuleIds = new Set()) => {
  for (const [ruleId, intervalId] of watcherRegistry.entries()) {
    if (activeRuleIds.has(ruleId)) {
      continue;
    }

    clearInterval(intervalId);
    watcherRegistry.delete(ruleId);
    lastAlertAtByRule.delete(ruleId);
  }
};

const shouldAlert = ({ ruleId, cooldownMs }) => {
  const lastAlert = lastAlertAtByRule.get(ruleId);
  if (!lastAlert) {
    return true;
  }

  return Date.now() - lastAlert >= cooldownMs;
};

const attachSystemMonitor = (rule) => {
  const ruleId = String(rule._id);
  if (!ruleId || watcherRegistry.has(ruleId)) {
    return;
  }

  const metric = String(rule.condition?.metric || "memory").toLowerCase();
  const threshold = Number(rule.condition?.threshold);
  const intervalMs = Math.max(5000, Number(rule.condition?.pollMs) || 10000);
  const cooldownMs = Math.max(intervalMs, Number(rule.condition?.cooldownMs) || 60000);

  const intervalId = setInterval(async () => {
    if (metric !== "memory" || !Number.isFinite(threshold)) {
      return;
    }

    const status = await getSystemStatus();
    const value = Number(status.memory?.usedPercent || 0);

    if (value < threshold) {
      return;
    }

    if (!shouldAlert({ ruleId, cooldownMs })) {
      return;
    }

    lastAlertAtByRule.set(ruleId, Date.now());

    try {
      rule.lastFired = new Date();
      await rule.save();
    } catch (err) {
      logger.warn({ err, rule: rule.name }, "Failed to persist system trigger timestamp");
    }

    publishTriggerEvent({
      kind: "system",
      ruleId,
      ruleName: rule.name,
      action: rule.action,
      message: `${rule.name} noticed memory usage at ${value}%, above the ${threshold}% threshold.`,
      details: {
        metric,
        value,
        threshold,
        pollMs: intervalMs
      }
    });
  }, intervalMs);

  watcherRegistry.set(ruleId, intervalId);
};

export const syncSystemMonitors = async () => {
  const rules = await TriggerRule.find({
    enabled: true,
    type: "system"
  }).sort({ createdAt: 1, name: 1 });

  const activeRuleIds = new Set(rules.map((rule) => String(rule._id)));
  stopStaleMonitors(activeRuleIds);

  for (const rule of rules) {
    try {
      attachSystemMonitor(rule);
    } catch (err) {
      logger.warn({ err, rule: rule.name }, "Failed to attach system monitor");
    }
  }
};

export default {
  syncSystemMonitors
};
