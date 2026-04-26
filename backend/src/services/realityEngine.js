import { generateResponseStream } from "./llm.js";
import config from "../config/env.js";

/**
 * Reality Engine
 * Decides if a query needs real-time internet data or can be answered from static knowledge.
 */
export const classifyRealityIntent = async (query) => {
  const trimmed = String(query || "").trim().toLowerCase();

  // 1. Fast Pattern Check (Early Exit)
  const STATIC_PATTERNS = [
    /^(hi|hello|hey|yo|sup)$/i,
    /^(how are you|who are you|what is your name)$/i,
    /^(help|commands|what can you do)$/i,
    /^(tell me a joke|write a poem|sing a song)$/i,
    /\b(code|debug|function|class|algorithm)\b/i,
  ];

  if (STATIC_PATTERNS.some(p => p.test(trimmed))) {
    return "STATIC";
  }

  const URGENT_REALTIME_PATTERNS = [
    /\b(latest|current|news|today|now|price|weather|score|who is the current|breaking|recent|incident|happened|was there a|did .* happen|is there any)\b/i,
    /\b(search|look up|find online|research|check the web)\b/i,
  ];

  if (URGENT_REALTIME_PATTERNS.some(p => p.test(trimmed))) {
    return "REALTIME";
  }

  // 2. LLM Classification (Adaptive Layer)
  // We use a non-streaming, very short call to classify.
  const classificationPrompt = [
    {
      role: "system",
      content: `Analyze the user query and classify it as STATIC or REALTIME.
REALTIME: If the query asks for current events, news, latest versions, real-time prices, people in office, or any information that could have changed recently. If the query implies a "recent" or "current" context, always choose REALTIME.
STATIC: If the query is a general knowledge question, greeting, coding task, or math problem.

Respond with ONLY the word "STATIC" or "REALTIME".`
    },
    { role: "user", content: query }
  ];

  try {
    const classification = await generateResponseStream(
      classificationPrompt,
      null, // No chunk callback for classification
      null,
      process.env.OLLAMA_CASUAL_MODEL || "qwen2.5:7b" // Use a fast model
    );

    const result = classification.trim().toUpperCase();
    return result.includes("REALTIME") ? "REALTIME" : "STATIC";
  } catch (error) {
    console.warn("⚠️ RealityEngine LLM classification failed, falling back to STATIC:", error.message);
    return "STATIC";
  }
};

export default { classifyRealityIntent };
