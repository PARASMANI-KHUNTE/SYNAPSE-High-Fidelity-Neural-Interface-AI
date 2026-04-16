import eventBus from "./eventBus.js";
import scheduler from "./scheduler.js";
import registry from "./registry.js";

export { eventBus, scheduler, registry };

export const initializeTriggers = async () => {
  try {
    scheduler.start();
    await registry.initializeBuiltinTriggers();
    registry.startAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to initialize triggers:", err);
    return { success: false, error: err.message };
  }
};

export const shutdownTriggers = () => {
  scheduler.stop();
  registry.stopAll();
};
