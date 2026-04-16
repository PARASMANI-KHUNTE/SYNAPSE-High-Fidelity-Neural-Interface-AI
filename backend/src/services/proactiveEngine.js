import logger from "../utils/logger.js";
import Alert from "../models/Alert.js";
import { getIO } from "../config/socket.js";
import GitWatcher from "../proactive/watchers/GitWatcher.js";
import SystemWatcher from "../proactive/watchers/SystemWatcher.js";

class ProactiveEngine {
  constructor() {
    this.watchers = [];
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 300000; // Global check every 5 minutes
    this.lastAlerts = new Map(); // deduplication cache
  }

  initialize() {
    if (this.isRunning) return;

    logger.info("Initializing Proactive Intelligence Engine...");
    
    // Register default watchers
    this.registerWatcher(new GitWatcher());
    this.registerWatcher(new SystemWatcher({ memoryThresholdMB: 600 }));

    this.isRunning = true;
    this.startScheduler();
  }

  registerWatcher(watcher) {
    this.watchers.push(watcher);
    logger.debug({ watcher: watcher.name }, "Watcher registered");
  }

  startScheduler() {
    // Run once immediately
    this.pulse();
    
    this.intervalId = setInterval(() => {
      this.pulse();
    }, this.checkInterval);
  }

  async pulse() {
    logger.debug("Engine pulse: running all watchers");
    
    for (const watcher of this.watchers) {
      try {
        const result = await watcher.check();
        if (result) {
          await this.handleWatcherResult(result);
        }
      } catch (err) {
        logger.error({ watcher: watcher.name, err: err.message }, "Watcher pulse failed");
      }
    }
  }

  async handleWatcherResult(result) {
    const cacheKey = `${result.type}_${result.id}`;
    const now = Date.now();
    
    // De-duplicate: don't trigger the same exact alert more than once every hour
    if (this.lastAlerts.has(cacheKey) && (now - this.lastAlerts.get(cacheKey) < 3600000)) {
      return;
    }

    try {
      // Persist to DB
      const alert = await Alert.create({
        type: result.type,
        label: result.label,
        message: result.message,
        metadata: result.metadata || {}
      });

      this.lastAlerts.set(cacheKey, now);

      // Emit to all connected clients
      const io = getIO();
      io.emit("system:alert", alert);
      
      logger.info({ type: alert.type, label: alert.label }, "Proactive alert emitted");
    } catch (err) {
      logger.error({ err: err.message }, "Failed to persist/emit proactive alert");
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("Proactive Intelligence Engine stopped");
  }
}

export const proactiveEngine = new ProactiveEngine();
