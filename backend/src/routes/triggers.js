import express from "express";
import { syncClipboardWatchers } from "../triggers/handlers/clipboardWatch.js";
import { createTriggerRule, listTriggerRules, setTriggerEnabled } from "../triggers/registry.js";
import { syncFileWatchers } from "../triggers/handlers/fileWatcher.js";
import { syncSystemMonitors } from "../triggers/handlers/systemMonitor.js";

const router = express.Router();

const assertPlainObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
};

const assertSafeObjectKeys = (obj) => {
  const bannedKeys = new Set(["__proto__", "constructor", "prototype"]);
  for (const key of Object.keys(obj || {})) {
    if (key.startsWith("$") || key.includes(".") || bannedKeys.has(key)) {
      throw new Error("Invalid condition key");
    }
  }
};

const validateCronCondition = (condition = {}) => {
  const { hour, minute } = condition;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("cron.hour must be an integer between 0 and 23");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("cron.minute must be an integer between 0 and 59");
  }
  return { hour, minute };
};

const validateFileCondition = (condition = {}) => {
  const pathValue = String(condition.path || "").trim();
  const eventValue = String(condition.event || "change").trim().toLowerCase();
  const patternValue = String(condition.pattern || "").trim();

  if (!pathValue || pathValue.length > 500) {
    throw new Error("file.path is required");
  }
  if (!["change", "rename", "all"].includes(eventValue)) {
    throw new Error("file.event must be one of: change, rename, all");
  }

  return {
    path: pathValue,
    event: eventValue,
    ...(patternValue ? { pattern: patternValue.substring(0, 200) } : {})
  };
};

const validateSystemCondition = (condition = {}) => {
  const metric = String(condition.metric || "").trim().toLowerCase();
  const operator = String(condition.operator || "").trim().toLowerCase();
  const threshold = Number(condition.threshold);

  if (!["cpu", "memory", "disk"].includes(metric)) {
    throw new Error("system.metric must be one of: cpu, memory, disk");
  }
  if (!["gt", "gte", "lt", "lte", "eq"].includes(operator)) {
    throw new Error("system.operator must be one of: gt, gte, lt, lte, eq");
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error("system.threshold must be a number between 0 and 100");
  }

  return { metric, operator, threshold };
};

const validateClipboardCondition = (condition = {}) => {
  const includes = Array.isArray(condition.includes) ? condition.includes : [];
  const excludes = Array.isArray(condition.excludes) ? condition.excludes : [];

  const normalizeList = (values) =>
    values
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((item) => item.substring(0, 120));

  return {
    includes: normalizeList(includes),
    excludes: normalizeList(excludes)
  };
};

const normalizeTriggerInput = (body = {}) => {
  const type = String(body.type || "").trim();
  const action = String(body.action || "").trim();
  const name = String(body.name || "").trim();

  if (!name || !type || !action) {
    throw new Error("name, type, and action are required");
  }

  if (!["cron", "file", "system", "clipboard"].includes(type)) {
    throw new Error("Unsupported trigger type");
  }

  const condition = body.condition ?? {};
  assertPlainObject(condition, "condition");
  assertSafeObjectKeys(condition);

  let normalizedCondition = {};
  if (type === "cron") normalizedCondition = validateCronCondition(condition);
  if (type === "file") normalizedCondition = validateFileCondition(condition);
  if (type === "system") normalizedCondition = validateSystemCondition(condition);
  if (type === "clipboard") normalizedCondition = validateClipboardCondition(condition);

  return {
    name,
    type,
    action,
    condition: normalizedCondition,
    enabled: body.enabled !== false
  };
};

router.get("/", async (req, res) => {
  try {
    const rules = await listTriggerRules();
    res.json({
      triggers: rules.map((rule) => ({
        id: rule._id,
        name: rule.name,
        type: rule.type,
        condition: rule.condition,
        action: rule.action,
        enabled: rule.enabled,
        lastFired: rule.lastFired
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load triggers", details: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = normalizeTriggerInput(req.body);
    const rule = await createTriggerRule(payload);

    await syncClipboardWatchers();
    await syncFileWatchers();
    await syncSystemMonitors();

    res.status(201).json({
      trigger: {
        id: rule._id,
        name: rule.name,
        type: rule.type,
        condition: rule.condition,
        action: rule.action,
        enabled: rule.enabled,
        lastFired: rule.lastFired
      }
    });
  } catch (err) {
    res.status(400).json({ error: "Failed to create trigger", details: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const rule = await setTriggerEnabled({
      id: req.params.id,
      enabled: req.body?.enabled
    });

    if (!rule) {
      return res.status(404).json({ error: "Trigger not found" });
    }

    await syncClipboardWatchers();
    await syncFileWatchers();
    await syncSystemMonitors();

    res.json({
      trigger: {
        id: rule._id,
        name: rule.name,
        enabled: rule.enabled,
        lastFired: rule.lastFired
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update trigger", details: err.message });
  }
});

export default router;
