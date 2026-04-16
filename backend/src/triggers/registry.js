import eventBus from "./eventBus.js";
import scheduler from "./scheduler.js";
import logger from "../utils/logger.js";

class TriggerRegistry {
  constructor() {
    this.triggers = new Map();
    this.builtinTriggers = [];
  }

  register(trigger) {
    const { id, name, type, schedule, handler, enabled = true } = trigger;
    
    if (this.triggers.has(id)) {
      logger.warn(`Trigger ${id} already registered, updating`);
    }

    this.triggers.set(id, {
      id,
      name,
      type,
      schedule,
      handler,
      enabled,
      lastRun: null,
      runCount: 0,
      createdAt: Date.now()
    });

    if (enabled && schedule) {
      this.activateTrigger(id);
    }

    logger.info(`Registered trigger: ${id} (${name})`);
    return trigger;
  }

  unregister(id) {
    if (!this.triggers.has(id)) {
      return false;
    }

    this.deactivateTrigger(id);
    this.triggers.delete(id);
    logger.info(`Unregistered trigger: ${id}`);
    return true;
  }

  activateTrigger(id) {
    const trigger = this.triggers.get(id);
    if (!trigger || !trigger.schedule) return;

    const { schedule } = trigger;
    
    if (schedule.type === "interval" && schedule.intervalMs) {
      scheduler.scheduleInterval(
        `trigger-${id}`,
        async () => {
          trigger.lastRun = Date.now();
          trigger.runCount++;
          return await trigger.handler();
        },
        schedule.intervalMs,
        trigger.name
      );
    } else if (schedule.type === "cron" && schedule.cronExpression) {
      this.setupCronTrigger(id, schedule.cronExpression);
    }

    trigger.enabled = true;
    logger.info(`Activated trigger: ${id}`);
  }

  deactivateTrigger(id) {
    scheduler.cancel(`trigger-${id}`);
    const trigger = this.triggers.get(id);
    if (trigger) {
      trigger.enabled = false;
    }
    logger.info(`Deactivated trigger: ${id}`);
  }

  async execute(id, data = {}) {
    const trigger = this.triggers.get(id);
    if (!trigger) {
      throw new Error(`Trigger not found: ${id}`);
    }

    trigger.lastRun = Date.now();
    trigger.runCount++;

    try {
      const result = await trigger.handler(data);
      eventBus.emitAlert({
        type: "trigger_executed",
        triggerId: id,
        triggerName: trigger.name,
        message: `Trigger "${trigger.name}" executed successfully`,
        data: result
      });
      return result;
    } catch (err) {
      eventBus.emitAlert({
        type: "error",
        triggerId: id,
        triggerName: trigger.name,
        message: `Trigger "${trigger.name}" failed: ${err.message}`,
        severity: "error"
      });
      throw err;
    }
  }

  getAll() {
    return Array.from(this.triggers.values());
  }

  getById(id) {
    return this.triggers.get(id);
  }

  getByType(type) {
    return Array.from(this.triggers.values()).filter(t => t.type === type);
  }

  async initializeBuiltinTriggers() {
    const builtins = [
      {
        id: "heartbeat",
        name: "Heartbeat",
        type: "system",
        schedule: { type: "interval", intervalMs: 60000 },
        handler: async () => {
          return {
            status: "ok",
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: Date.now()
          };
        }
      },
      {
        id: "status_check",
        name: "System Status Check",
        type: "monitoring",
        schedule: { type: "interval", intervalMs: 300000 },
        handler: async () => {
          return {
            platform: process.platform,
            nodeVersion: process.version,
            env: process.env.NODE_ENV || "development"
          };
        }
      }
    ];

    for (const trigger of builtins) {
      this.register(trigger);
    }

    logger.info(`Initialized ${builtins.length} builtin triggers`);
  }

  setupCronTrigger(id, cronExpression) {
    logger.warn(`Cron triggers not fully implemented, using interval fallback for: ${id}`);
    const trigger = this.triggers.get(id);
    if (trigger) {
      const intervalMs = 60000;
      scheduler.scheduleInterval(
        `trigger-${id}`,
        async () => {
          trigger.lastRun = Date.now();
          trigger.runCount++;
          return await trigger.handler();
        },
        intervalMs,
        trigger.name
      );
    }
  }
}

const registry = new TriggerRegistry();
export default registry;
export { TriggerRegistry };
