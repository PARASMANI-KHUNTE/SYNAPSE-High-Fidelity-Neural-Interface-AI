import express from "express";
import { syncClipboardWatchers } from "../triggers/handlers/clipboardWatch.js";
import { createTriggerRule, listTriggerRules, setTriggerEnabled } from "../triggers/registry.js";
import { syncFileWatchers } from "../triggers/handlers/fileWatcher.js";
import { syncSystemMonitors } from "../triggers/handlers/systemMonitor.js";

const router = express.Router();

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

  const condition = body.condition && typeof body.condition === "object" ? body.condition : {};
  return {
    name,
    type,
    action,
    condition,
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
