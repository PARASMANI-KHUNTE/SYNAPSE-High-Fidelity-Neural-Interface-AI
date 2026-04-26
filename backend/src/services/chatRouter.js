/**
 * Query Classifier & Router Service
 * Prioritizes perceived speed by default:
 * - Route to heavier models only when the query clearly warrants it.
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

const REASONING_PATTERNS = [
  /\b(step[-\s]?by[-\s]?step|think through|walk me through|reason)\b/i,
  /\b(analy(?:ze|sis)|root cause|diagnose)\b/i,
  /\b(compare|trade-?offs?|pros and cons|decision)\b/i,
  /\b(architecture|system design|hld|lld)\b/i,
  /\b(plan|roadmap|strategy)\b/i
];

const CODE_FENCE_PATTERN = /```|^\s*(traceback|exception|error:|stack trace)\b/i;

const CASUAL_CHAR_THRESHOLD = 18;
const CASUAL_WORD_THRESHOLD = 8;
const LONG_QUERY_CHAR_THRESHOLD = 220;

const countWords = (text = "") =>
  String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

/**
 * Classifies a user query into a specific type.
 * @param {string} query
 * @param {{hasImages?: boolean}} opts
 * @returns {'GREETING' | 'IDENTITY' | 'CASUAL' | 'CODE' | 'REASONING' | 'KNOWLEDGE' | 'VISION'}
 */
export const classifyQuery = (query, opts = {}) => {
  const trimmed = String(query || "").trim();
  const hasImages = Boolean(opts?.hasImages);

  if (hasImages) return "VISION";

  if (GREETING_PATTERNS.some((pattern) => pattern.test(trimmed))) return "GREETING";
  if (IDENTITY_PATTERNS.some((pattern) => pattern.test(trimmed))) return "IDENTITY";
  if (CODE_FENCE_PATTERN.test(trimmed) || CODE_PATTERNS.some((pattern) => pattern.test(trimmed))) return "CODE";

  const wordCount = countWords(trimmed);
  if (trimmed.length <= CASUAL_CHAR_THRESHOLD || wordCount <= CASUAL_WORD_THRESHOLD) return "CASUAL";

  if (REASONING_PATTERNS.some((pattern) => pattern.test(trimmed)) || trimmed.length >= LONG_QUERY_CHAR_THRESHOLD) {
    return "REASONING";
  }

  return "KNOWLEDGE";
};

/**
 * Determines if RAG context retrieval is necessary for the given query type.
 * (Additional gating happens in chatPipeline.)
 */
export const shouldUseRAG = (type) => type === "REASONING" || type === "KNOWLEDGE";

/**
 * Picks the appropriate Ollama model based on query type.
 * Default behavior: keep most turns on the fast model.
 */
export const selectModel = (type, hasImages = false) => {
  if (hasImages) {
    return process.env.OLLAMA_VISION_MODEL || "llava";
  }

  if (type === "CODE") {
    return process.env.OLLAMA_CODE_MODEL || "deepseek-coder:6.7b-instruct-q4_0";
  }

  if (type === "REASONING") {
    return process.env.OLLAMA_REASON_MODEL || process.env.OLLAMA_CHAT_MODEL || "qwen2.5:7b";
  }

  return process.env.OLLAMA_CASUAL_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:7b";
};

export const getConfiguredModels = () => ({
  auto: "Auto",
  chat: process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_CASUAL_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:7b",
  code: process.env.OLLAMA_CODE_MODEL || "deepseek-coder:6.7b-instruct-q4_0",
  reasoning: process.env.OLLAMA_REASON_MODEL || "qwen2.5:7b",
  casual: process.env.OLLAMA_CASUAL_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:7b",
  vision: process.env.OLLAMA_VISION_MODEL || "llava"
});

export const resolveModelPreference = ({ preference, queryType, hasImages = false, customModel = "" }) => {
  const requested = String(preference || "auto").trim().toLowerCase();
  const configured = getConfiguredModels();

  if (hasImages) return configured.vision;

  switch (requested) {
    case "auto":
      return selectModel(queryType, hasImages);
    case "chat":
      return configured.casual;
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

export const getSystemPromptModifier = (type, operatorName) => {
  switch (type) {
    case "GREETING":
      return `Be brief, warm, and direct to ${operatorName}.`;
    case "IDENTITY":
      return `Use known facts about ${operatorName} from memory/history; do not invent personal details.`;
    case "CODE":
      return "Provide correct, runnable code first. Explain after, briefly.";
    case "CASUAL":
      return "Be concise and natural. Avoid filler openers/closings.";
    case "REASONING":
      return "Be structured and professional. Use bullets/headings, state assumptions, and answer in the first 1–2 sentences.";
    case "VISION":
      return "Follow strict vision grounding rules: observations first, then interpretation, then uncertainty. Never invent details.";
    default:
      return "Be professional, concise, and factual. Answer in the first 1–2 sentences.";
  }
};
