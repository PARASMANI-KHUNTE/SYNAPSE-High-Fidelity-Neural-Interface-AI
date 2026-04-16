import perceptionService from "../../services/perceptionService.js";
import { generateResponseStream } from "../../services/llm.js";
import logger from "../../utils/logger.js";

export const perceptionEvents = (io, socket) => {
  socket.on("perception:analyze", async ({ frame }) => {
    if (!perceptionService.canAnalyze()) return;

    try {
      // Small prompt to get emotion from the frame
      // We use GEMINI_3_FLASH for cost/speed as this is a background recurring task
      const prompt = "Analyze the facial expression of the person in this frame. Return exactly one word from this list: neutral, happy, focused, tired, confused. Nothing else.";
      
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: frame }
          ]
        }
      ];

      // We call the LLM directly without stream for this internal classification
      const result = await generateResponseStream(messages, null, null, "GEMINI_3_FLASH");
      const emotion = result.trim().toLowerCase().replace(/[^a-z]/g, "");

      const validEmotions = ["neutral", "happy", "focused", "tired", "confused"];
      if (validEmotions.includes(emotion)) {
        perceptionService.updateEmotion(emotion);
        // Broadcast to user to update the avatar UI
        socket.emit("perception:update", { emotion });
      }
    } catch (err) {
      logger.error({ err: err.message }, "Perception analysis cycle failed");
    }
  });

  socket.on("perception:manual_emotion", ({ emotion }) => {
    perceptionService.updateEmotion(emotion);
    socket.emit("perception:update", { emotion });
  });
};
