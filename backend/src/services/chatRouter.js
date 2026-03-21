/**
 * Query Classifier & Router Service
 * Distinguishes between different types of user interactions 
 * to determine the optimal processing path (RAG vs direct)
 * and the ideal LLM model.
 */

const GREETING_PATTERNS = [
  /^(hi|hello|hey|greetings|morning|afternoon|evening|hola|yo|sup)$/i,
  /^how are you\??$/i,
  /^what's up\??$/i
];

const IDENTITY_PATTERNS = [
  /\b(who am i|what is my name|remember me|my identity|do you know me|what i am|what i like)\b/i,
  /\b(what do you know about me)\b/i
];

const CODE_PATTERNS = [
  /\b(code|write|debug|fix|function|class|algorithm|implement|compile|syntax|error|exception|script|program|snippet|refactor|optimize)\b/i,
  /\b(python|javascript|typescript|rust|java|go|c\+\+|c#|sql|html|css|bash|powershell|kotlin|swift)\b/i,
  /\b(api|endpoint|backend|frontend|database|query|loop|array|object|variable|method|library|package|npm|pip)\b/i,
  /\b(explain this code|how does this work|what does this do|how to implement|how to build)\b/i
];

const CASUAL_THRESHOLD = 10; // Characters

/**
 * Classifies a user query into a specific type.
 * @param {string} query 
 * @returns {'GREETING' | 'IDENTITY' | 'CASUAL' | 'CODE' | 'KNOWLEDGE'}
 */
export const classifyQuery = (query) => {
  const trimmed = String(query || "").trim();
  
  if (GREETING_PATTERNS.some(p => p.test(trimmed))) {
    return "GREETING";
  }

  if (IDENTITY_PATTERNS.some(p => p.test(trimmed))) {
    return "IDENTITY";
  }

  if (CODE_PATTERNS.some(p => p.test(trimmed))) {
    return "CODE";
  }

  if (trimmed.length < CASUAL_THRESHOLD) {
    return "CASUAL";
  }

  return "KNOWLEDGE";
};

/**
 * Determines if RAG context retrieval is necessary for the given query type.
 * @param {string} type 
 * @returns {boolean}
 */
export const shouldUseRAG = (type) => {
  return type === "KNOWLEDGE" || type === "CODE";
};

/**
 * Picks the appropriate Ollama model based on query type.
 * CODE     → DeepSeek-Coder 6.7B Q4 (precision code model)
 * KNOWLEDGE → Qwen2.5:7B (best reasoning + research)
 * GREETING/CASUAL → llama3.2:3b (fast, low VRAM)
 * @param {string} type 
 * @param {boolean} hasImages
 * @returns {string}
 */
export const selectModel = (type, hasImages = false) => {
  if (hasImages) {
    return process.env.OLLAMA_VISION_MODEL || "llava";
  }
  if (type === "CODE") {
    const model = process.env.OLLAMA_CODE_MODEL || "deepseek-coder:6.7b-instruct-q4_0";
    console.log(`[Router] 🧑‍💻 CODE query → ${model}`);
    return model;
  }
  if (type === "KNOWLEDGE" || type === "IDENTITY") {
    const model = process.env.OLLAMA_REASON_MODEL || process.env.OLLAMA_CHAT_MODEL || "qwen2.5:7b";
    console.log(`[Router] 🧠 KNOWLEDGE/IDENTITY query → ${model}`);
    return model;
  }
  // GREETING, CASUAL → fast small model
  const model = process.env.OLLAMA_CASUAL_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";
  console.log(`[Router] 💬 ${type} query → ${model}`);
  return model;
};

export const getConfiguredModels = () => ({
  auto: "Auto",
  chat: process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_REASON_MODEL || "qwen2.5:7b",
  code: process.env.OLLAMA_CODE_MODEL || "deepseek-coder:6.7b-instruct-q4_0",
  reasoning: process.env.OLLAMA_REASON_MODEL || process.env.OLLAMA_CHAT_MODEL || "qwen2.5:7b",
  casual: process.env.OLLAMA_CASUAL_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b",
  vision: process.env.OLLAMA_VISION_MODEL || "llava"
});

export const resolveModelPreference = ({ preference, queryType, hasImages = false, customModel = "" }) => {
  const requested = String(preference || "auto").trim().toLowerCase();
  const configured = getConfiguredModels();

  if (hasImages) {
    return configured.vision;
  }

  switch (requested) {
    case "auto":
      return selectModel(queryType, hasImages);
    case "chat":
      return configured.chat;
    case "code":
      return configured.code;
    case "reasoning":
      return configured.reasoning;
    case "casual":
      return configured.casual;
    case "custom":
      return customModel?.trim() || selectModel(queryType, hasImages);
    default:
      return selectModel(queryType, hasImages);
  }
};

/**
 * Gets a custom system prompt modifier based on query type.
 * @param {string} type 
 * @param {string} operatorName 
 * @returns {string}
 */
export const getSystemPromptModifier = (type, operatorName) => {
  switch (type) {
    case "GREETING":
      return `Be warm and welcoming to ${operatorName}. Keep it brief and friendly.`;
    case "IDENTITY":
      return `Focus on addressing ${operatorName} by name and using known facts about them from Memory/History.`;
    case "CODE":
      return `You are a precision coding assistant. Respond with clean, well-commented code blocks. Explain the logic clearly. Always prefer working, complete, production-ready code.`;
    case "CASUAL":
      return "Respond naturally and conversationally. No need to be overly formal or data-heavy.";
    default:
      return "Provide precise, data-driven answers based on available context.";
  }
};
