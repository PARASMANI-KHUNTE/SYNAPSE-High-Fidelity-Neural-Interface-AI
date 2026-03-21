const DEFAULT_HISTORY_MESSAGE_LIMIT = parseInt(process.env.CONTEXT_WINDOW_SIZE, 10) || 24;
const DEFAULT_HISTORY_CHAR_BUDGET = parseInt(process.env.CONTEXT_CHAR_BUDGET, 10) || 12000;
const DEFAULT_MEMORY_FACT_LIMIT = parseInt(process.env.MEMORY_FACT_LIMIT, 10) || 8;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from", "how",
  "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "so", "that", "the",
  "their", "them", "they", "this", "to", "was", "we", "were", "what", "when", "where",
  "who", "why", "with", "you", "your"
]);

const MEMORY_PATTERNS = [
  /\b(i am|i'm|i was|i work|i live|i study|i'm studying|my name is|call me|remember that|i like|i love|i prefer|my favorite)\b/i
];

const MEMORY_QUERY_PATTERNS = [
  /\bremember\b/i,
  /\brecall\b/i,
  /\bwhat do you know about me\b/i,
  /\bwhat did i\b/i,
  /\bwhat am i\b/i,
  /\bmy\b/i
];

const normalizeMessage = (message) => ({
  role: message.role,
  content: typeof message.content === "string" ? message.content.trim() : "",
  images: Array.isArray(message.images) ? message.images : undefined
});

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const truncate = (text, limit = 1600) => {
  if (!text) return "";
  return text.length > limit ? `${text.substring(0, limit)}...` : text;
};

const isMemoryFact = (content) =>
  MEMORY_PATTERNS.some((pattern) => pattern.test(content));

const isMemoryQuery = (query) =>
  MEMORY_QUERY_PATTERNS.some((pattern) => pattern.test(query));

const extractMemoryFacts = (messages, limit = DEFAULT_MEMORY_FACT_LIMIT) => {
  const facts = [];
  const seen = new Set();

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = normalizeMessage(messages[index]);
    if (message.role !== "user" || !message.content || !isMemoryFact(message.content)) {
      continue;
    }

    const fact = truncate(message.content.replace(/\s+/g, " "), 220);
    const key = fact.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    facts.push(fact);
    seen.add(key);

    if (facts.length >= limit) {
      break;
    }
  }

  return facts.reverse();
};

const selectConversationHistory = (messages, query) => {
  const cleanMessages = messages
    .map((message, index) => ({ ...normalizeMessage(message), index }))
    .filter((message) => message.content);

  if (cleanMessages.length === 0) {
    return [];
  }

  const selected = [];
  let charCount = 0;

  for (let index = cleanMessages.length - 1; index >= 0; index -= 1) {
    const message = cleanMessages[index];
    const messageLength = message.content.length;

    if (
      selected.length >= DEFAULT_HISTORY_MESSAGE_LIMIT ||
      (selected.length > 0 && charCount + messageLength > DEFAULT_HISTORY_CHAR_BUDGET)
    ) {
      break;
    }

    selected.push(message);
    charCount += messageLength;
  }

  const selectedIndexes = new Set(selected.map((message) => message.index));
  const queryTerms = tokenize(query);
  const scoredOlderMessages = cleanMessages
    .filter((message) => !selectedIndexes.has(message.index))
    .map((message) => {
      const terms = tokenize(message.content);
      const overlap = queryTerms.filter((term) => terms.includes(term)).length;
      const memoryBoost = isMemoryFact(message.content) ? 2 : 0;
      return { message, score: overlap + memoryBoost };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.message.index - left.message.index)
    .slice(0, 4)
    .map(({ message }) => message);

  if (isMemoryQuery(query) && scoredOlderMessages.length === 0) {
    for (let index = cleanMessages.length - 1; index >= 0; index -= 1) {
      const message = cleanMessages[index];
      if (selectedIndexes.has(message.index) || !isMemoryFact(message.content)) {
        continue;
      }

      scoredOlderMessages.push(message);
      if (scoredOlderMessages.length >= 4) {
        break;
      }
    }
  }

  return [...scoredOlderMessages, ...selected]
    .sort((left, right) => left.index - right.index)
    .map(({ role, content }) => ({ role, content }));
};

export const buildChatMessages = ({
  chatMessages = [],
  userMessage = "",
  currentUserMessage = null,
  operatorName = "Operator",
  ragContext = "",
  searchContext = "",
  attachmentContext = "",
  queryType = "KNOWLEDGE"
}) => {
  const memoryFacts = extractMemoryFacts(chatMessages);
  const conversationHistory = selectConversationHistory(chatMessages, userMessage);
  const hasVisualInput = Boolean(currentUserMessage?.images?.length);
  
  const systemParts = hasVisualInput
    ? [
        `You are SYNAPSE, a vision-capable AI assistant helping your operator, ${operatorName}.`,
        "Vision Directives:",
        "- The current user turn includes attached image data.",
        "- Analyze the attached image directly.",
        "- Do not say you cannot see images.",
        "- Describe visible objects, text, layout, style, colors, and notable details grounded in the image.",
        "- If something is unclear, state uncertainty briefly instead of inventing details."
      ]
    : [
        `You are SYNAPSE, a high-fidelity AI assistant helping your operator, ${operatorName}.`,
        "Core Directives:",
        "- Maintain a natural, helpful, and professional tone.",
        "- Be conversational for greetings and casual chat.",
        "- Use conversation history for continuity and memory facts for stable user details."
      ];

  if (hasVisualInput) {
    if (memoryFacts.length > 0) {
      systemParts.push("", "Known Facts about Operator:", ...memoryFacts.map((fact) => `- ${fact}`));
    }
  }

  if (!hasVisualInput && (queryType === "KNOWLEDGE" || ragContext || searchContext)) {
    systemParts.push(
      "Knowledge Integration Rules:",
      "- Use retrieved knowledge and search results only when they are relevant.",
      "- Proactively provide direct URLs, video links, and source citations found in search results.",
      "- If the query is factual and no data is found in context or training, admit it.",
      "- Do not invent facts or memories.",
      "",
      "Response Structure (for Knowledge Queries):",
      "1. Comprehensive Analysis: Provide a detailed, structured, and well-formatted answer.",
      "2. 🔗 Related Resources: List useful links, videos, or articles found in context/search.",
      "3. ❓ Contextual FAQs: Suggest 2-3 most relevant follow-up questions the user might have.",
      "4. 💡 Intelligence Insight: Provide unique, high-value additional info if available."
    );
  }

  if (!hasVisualInput && memoryFacts.length > 0) {
    systemParts.push("", "Known Facts about Operator:", ...memoryFacts.map((fact) => `- ${fact}`));
  }

  if (!hasVisualInput && ragContext) {
    systemParts.push("", "Retrieved Knowledge Context:", truncate(ragContext, 6000));
  }

  if (!hasVisualInput && searchContext) {
    systemParts.push("", "Latest Information (Web Search):", truncate(searchContext, 4000));
  }

  if (!hasVisualInput && attachmentContext) {
    systemParts.push("", "Attachment Context:", truncate(attachmentContext, 5000));
  }

  const currentTurn = currentUserMessage
    ? {
        role: "user",
        content: hasVisualInput
          ? `Attached image analysis request:\n${currentUserMessage.content || userMessage || "Describe the attached image."}`
          : (currentUserMessage.content || ""),
        ...(currentUserMessage.images ? { images: currentUserMessage.images } : {})
      }
    : null;

  return [
    { role: "system", content: systemParts.join("\n") },
    ...(hasVisualInput ? [] : conversationHistory),
    ...(currentTurn ? [currentTurn] : [])
  ];
};
