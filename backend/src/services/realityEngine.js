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
    /\b(this week|this month|releasing|release date|box office|now showing)\b/i,
  ];

  if (URGENT_REALTIME_PATTERNS.some(p => p.test(trimmed))) {
    return "REALTIME";
  }

  // 2. LLM Classification (Adaptive Layer)
  const classificationPrompt = [
    {
      role: "system",
      content: `Analyze the user query and classify it as STATIC or REALTIME.
REALTIME: If the query asks for current events, news, latest versions, real-time prices, people in office, movie releases, box office, or any information that could have changed recently.
STATIC: If the query is a general knowledge question, greeting, coding task, or math problem.
Respond with ONLY the word "STATIC" or "REALTIME".`
    },
    { role: "user", content: query }
  ];

  let classificationResult = "";
  try {
    await generateResponseStream(
      classificationPrompt,
      (chunk) => { classificationResult += chunk; },
      null,
      process.env.OLLAMA_CASUAL_MODEL || "qwen2.5:7b"
    );

    const result = classificationResult.trim().toUpperCase();
    return result.includes("REALTIME") ? "REALTIME" : "STATIC";
  } catch (error) {
    console.warn("⚠️ RealityEngine LLM classification failed:", error.message);
    return trimmed.length > 30 ? "REALTIME" : "STATIC";
  }
};

export default { classifyRealityIntent };
