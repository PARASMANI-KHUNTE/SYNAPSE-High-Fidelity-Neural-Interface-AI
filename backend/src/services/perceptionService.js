import logger from "../utils/logger.js";

class PerceptionService {
  constructor() {
    this.currentEmotion = "neutral";
    this.isChatActive = false;
    this.lastFrameTime = 0;
  }

  setChatActive(active) {
    this.isChatActive = active;
    if (active) {
      logger.debug("Chat active: Perception processing paused to prioritize VRAM/compute.");
    }
  }

  updateEmotion(emotion) {
    if (!emotion || typeof emotion !== "string") return;
    this.currentEmotion = emotion.toLowerCase();
    logger.debug({ emotion: this.currentEmotion }, "Global emotion state updated");
  }

  getEmotion() {
    return this.currentEmotion;
  }

  canAnalyze() {
    // If chat is actively generating, we pause vision processing
    if (this.isChatActive) return false;
    
    const now = Date.now();
    // Throttling: Analyze at most once every 3 seconds to save energy/compute
    if (now - this.lastFrameTime < 3000) return false;
    
    this.lastFrameTime = now;
    return true;
  }
}

export default new PerceptionService();
