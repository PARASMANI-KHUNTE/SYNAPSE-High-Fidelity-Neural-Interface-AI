import { EventEmitter } from "events";
import { getIO } from "../config/socket.js";
import logger from "../utils/logger.js";

const triggerEventBus = new EventEmitter();

export const publishTriggerEvent = (event = {}) => {
  const payload = {
    id: `${event.ruleName || "trigger"}_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...event
  };

  triggerEventBus.emit("trigger:event", payload);

  try {
    const io = getIO();
    io.emit("trigger:alert", payload);
  } catch (err) {
    logger.debug({ err }, "Trigger alert emitted before socket initialization");
  }

  return payload;
};

export const onTriggerEvent = (handler) => {
  triggerEventBus.on("trigger:event", handler);
  return () => triggerEventBus.off("trigger:event", handler);
};

export default {
  publishTriggerEvent,
  onTriggerEvent
};
