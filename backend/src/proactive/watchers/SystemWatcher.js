import logger from "../../utils/logger.js";

export default class SystemWatcher {
  constructor(options = {}) {
    this.name = "system-watcher";
    this.memoryThresholdMB = options.memoryThresholdMB || 800;
    this.lastTriggered = 0;
  }

  async check() {
    try {
      const memory = process.memoryUsage();
      const rssMB = Math.round(memory.rss / 1024 / 1024);

      if (rssMB > this.memoryThresholdMB) {
        return {
          id: "high_memory",
          type: "system",
          label: "Performance Alert",
          message: `High memory usage detected (${rssMB}MB). System may become slow.`,
          priority: "high",
          metadata: { rssMB }
        };
      }
      return null;
    } catch (err) {
      logger.error({ err: err.message }, "SystemWatcher check failed");
      return null;
    }
  }
}
