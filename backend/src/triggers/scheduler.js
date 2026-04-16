import eventBus from "./eventBus.js";
import logger from "../utils/logger.js";

class TriggerScheduler {
  constructor() {
    this.intervals = new Map();
    this.timeouts = new Map();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("Trigger scheduler started");
  }

  stop() {
    this.isRunning = false;
    for (const [id, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
    
    for (const [id, timeout] of this.timeouts) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    
    logger.info("Trigger scheduler stopped");
  }

  scheduleInterval(id, fn, intervalMs, label = "interval") {
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
    }

    const interval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        const result = await fn();
        if (result) {
          eventBus.emitAlert({
            type: "scheduled",
            label,
            message: `Scheduled task "${label}" completed`,
            data: result
          });
        }
      } catch (err) {
        logger.error(`Scheduled task error: ${label}`, err);
        eventBus.emitAlert({
          type: "error",
          label,
          message: `Scheduled task "${label}" failed: ${err.message}`,
          severity: "error"
        });
      }
    }, intervalMs);

    this.intervals.set(id, interval);
    logger.info(`Scheduled interval: ${label} every ${intervalMs}ms`);
  }

  scheduleTimeout(id, fn, delayMs, label = "timeout") {
    if (this.timeouts.has(id)) {
      clearTimeout(this.timeouts.get(id));
    }

    const timeout = setTimeout(async () => {
      if (!this.isRunning) return;
      try {
        const result = await fn();
        if (result) {
          eventBus.emitAlert({
            type: "scheduled",
            label,
            message: `Timeout task "${label}" completed`,
            data: result
          });
        }
      } catch (err) {
        logger.error(`Timeout task error: ${label}`, err);
        eventBus.emitAlert({
          type: "error",
          label,
          message: `Timeout task "${label}" failed: ${err.message}`,
          severity: "error"
        });
      }
    }, delayMs);

    this.timeouts.set(id, timeout);
  }

  cancel(id) {
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
      logger.info(`Cancelled interval: ${id}`);
    }
    if (this.timeouts.has(id)) {
      clearTimeout(this.timeouts.get(id));
      this.timeouts.delete(id);
      logger.info(`Cancelled timeout: ${id}`);
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      intervals: this.intervals.size,
      timeouts: this.timeouts.size
    };
  }
}

const scheduler = new TriggerScheduler();
export default scheduler;
export { TriggerScheduler };
