import { EventEmitter } from "events";

class TriggerEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  emitAlert(alert) {
    this.emit("alert", {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...alert
    });
  }

  subscribe(callback) {
    this.on("alert", callback);
    return () => this.off("alert", callback);
  }
}

const eventBus = new TriggerEventBus();

export default eventBus;
export { TriggerEventBus };
