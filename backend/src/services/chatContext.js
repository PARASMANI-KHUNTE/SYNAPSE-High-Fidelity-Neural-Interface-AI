const readInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Smaller defaults improve speed (less prompt) while remaining configurable via env.
const DEFAULT_HISTORY_MESSAGE_LIMIT = readInt(process.env.CONTEXT_WINDOW_SIZE, 12);
const DEFAULT_HISTORY_CHAR_BUDGET = readInt(process.env.CONTEXT_CHAR_BUDGET, 8000);
const DEFAULT_MEMORY_FACT_LIMIT = readInt(process.env.MEMORY_FACT_LIMIT, 8);

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

const isMemoryFact = (content) => MEMORY_PATTERNS.some((pattern) => pattern.test(content));
const isMemoryQuery = (query) => MEMORY_QUERY_PATTERNS.some((pattern) => pattern.test(query));

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
    if (seen.has(key)) continue;

    facts.push(fact);
    seen.add(key);
    if (facts.length >= limit) break;
  }

  return facts.reverse();
};

const selectConversationHistory = (messages, query) => {
  const cleanMessages = messages
    .map((message, index) => ({ ...normalizeMessage(message), index }))
    .filter((message) => message.content);

  if (cleanMessages.length === 0) return [];

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
      if (selectedIndexes.has(message.index) || !isMemoryFact(message.content)) continue;
      scoredOlderMessages.push(message);
      if (scoredOlderMessages.length >= 4) break;
    }
  }

  return [...scoredOlderMessages, ...selected]
    .sort((left, right) => left.index - right.index)
    .map(({ role, content }) => ({ role, content }));
};

export const buildChatMessages = ({
  chatMessages = [],
  userMessage = "",
  memoryContext = {},
  profileFacts = [],
  currentUserMessage = null,
  operatorName = "Operator",
  ragContext = "",
  searchContext = "",
  attachmentContext = "",
  queryType = "KNOWLEDGE",
  voiceGender = "male",
  emotion = "neutral"
}) => {
  const memoryFacts = extractMemoryFacts(chatMessages);
  const resolvedProfileFacts = Array.isArray(memoryContext?.profileFacts) && memoryContext.profileFacts.length > 0
    ? memoryContext.profileFacts
    : profileFacts;

  const durableFacts = (resolvedProfileFacts || [])
    .map((fact) => {
      if (typeof fact === "string") return fact;
      return fact?.key && fact?.value ? `${fact.key}: ${fact.value}` : "";
    })
    .filter(Boolean)
    .slice(0, DEFAULT_MEMORY_FACT_LIMIT);

  const episodicSummaries = (memoryContext?.episodeSummaries || [])
    .map((episode) => {
      const topics = episode?.topics?.length ? ` Topics: ${episode.topics.join(", ")}.` : "";
      return episode?.summary ? `${episode.summary}${topics}` : "";
    })
    .filter(Boolean)
    .slice(0, 2);

  const mergedFacts = [...new Set([...durableFacts, ...memoryFacts])].slice(0, DEFAULT_MEMORY_FACT_LIMIT);
  const conversationHistory = selectConversationHistory(chatMessages, userMessage);
  const hasVisualInput = Boolean(currentUserMessage?.images?.length);

  const profileLabel = memoryContext?.profile?.name ? `${operatorName} (${memoryContext.profile.name})` : operatorName;
  const currentDate = new Date().toISOString().split("T")[0];
  const genderStyleLine = String(voiceGender || "male").toLowerCase() === "female"
    ? "- If responding in Hindi, use feminine self-reference and agreement naturally."
    : "- If responding in Hindi, use masculine self-reference and agreement naturally.";

  const systemParts = hasVisualInput
    ? [
        `You are SYNAPSE, a vision-capable AI assistant helping your operator, ${profileLabel}.`,
        `Current date: ${currentDate}.`,
        "Vision Rules (anti-hallucination):",
        "- Analyze strictly what is visually present in the attached image(s).",
        "- Never invent details that are not visible.",
        "- If text is too small/blurred, say so and ask for a clearer image or a zoomed crop.",
        "- If the user asks for something not visible, say it cannot be determined from this image.",
        "",
        "Required Output Format:",
        "Step 1 — OBSERVATIONS (facts only, no interpretation): list visible elements with high confidence.",
        "Step 2 — INTERPRETATION (clearly labeled): only if the user asked for it.",
        "Step 3 — UNCERTAINTY: state unclear/unknown items explicitly.",
        genderStyleLine,
        `- The operator currently appears ${emotion || "neutral"}. Project a tone that reflects and acknowledges this state appropriately.`
      ]
    : [
        `You are SYNAPSE, a professional local AI assistant helping your operator, ${profileLabel}.`,
        `Current date: ${currentDate}.`,
        "Core Rules:",
        "- Answer the user's question in the first 1–2 sentences.",
        "- Never start with filler like \"Certainly\", \"Great question\", or \"Of course\".",
        "- Never end with filler like \"Hope this helps\".",
        "- If unsure, say so early and ask a clarifying question.",
        "- Do not invent facts or memories.",
        "",
        "Style by Task Type:",
        "- GREETING/CASUAL: concise, friendly, max 3 short paragraphs.",
        "- CODE: provide correct runnable code first, then a short explanation and next steps.",
        "- REASONING/KNOWLEDGE: structured bullets/headings, state assumptions, keep it practical.",
        genderStyleLine,
        `- The operator currently appears ${emotion || "neutral"}. Project a tone that reflects and acknowledges this state appropriately.`
      ];

  if (!hasVisualInput && (queryType === "REASONING" || queryType === "KNOWLEDGE" || ragContext || searchContext)) {
    systemParts.push(
      "",
      "Knowledge Integration:",
      "- Use RAG/search context only if relevant.",
      "- If web search context is present, prefer it for time-sensitive claims.",
      "- If the user asks for current/latest info but no search context is present, say it is not verified live."
    );
  }

  if (mergedFacts.length > 0) {
    systemParts.push("", "Known Facts about Operator:", ...mergedFacts.map((fact) => `- ${fact}`));
  }

  if (!hasVisualInput && episodicSummaries.length > 0) {
    systemParts.push("", "Relevant Episodic Memory:", ...episodicSummaries.map((summary) => `- ${summary}`));
  }

  if (!hasVisualInput && ragContext) {
    systemParts.push("", "Retrieved Context:", truncate(ragContext, 5000));
  }

  if (!hasVisualInput && searchContext) {
    systemParts.push("", "Web Search Context:", truncate(searchContext, 3500));
  }

  if (!hasVisualInput && attachmentContext) {
    systemParts.push("", "Attachment Context:", truncate(attachmentContext, 5000));
  }

  const currentTurn = currentUserMessage
    ? {
        role: "user",
        content: hasVisualInput
          ? `User question:\n${currentUserMessage.content || userMessage || "Describe the attached image."}`
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

export default { buildChatMessages };
