const stopAtClauseBoundary = (value = "") =>
  String(value)
    .split(/[.\n]/)[0]
    .split(/\b(?:and|but|because|so)\b/i)[0]
    .split(/[,\n]/)[0]
    .trim();

const extractNameFact = (message) => {
  const match = message.match(/\b(?:my name is|call me)\s+([a-z][a-z\s'-]{1,40})/i);
  if (!match) return null;
  return {
    key: "name",
    value: stopAtClauseBoundary(match[1]),
    confidence: 0.95,
    source: "user_stated"
  };
};

const extractPreferenceFact = (message) => {
  const match = message.match(/\b(?:i prefer|my favorite(?:\s+\w+)? is|i like|i love)\s+(.+)/i);
  if (!match) return null;
  return {
    key: "preference",
    value: stopAtClauseBoundary(match[1]).replace(/[.?!]+$/, ""),
    confidence: 0.9,
    source: "user_stated"
  };
};

const extractWorkFact = (message) => {
  const match = message.match(/\b(?:i am working on|i'm working on|i work on|i'm building|i am building|i'm creating)\s+(.+)/i);
  if (!match) return null;
  return {
    key: "current_focus",
    value: stopAtClauseBoundary(match[1]).replace(/[.?!]+$/, ""),
    confidence: 0.88,
    source: "user_stated"
  };
};

const extractStudyFact = (message) => {
  const match = message.match(/\b(?:i study|i'm studying|i am studying)\s+(.+)/i);
  if (!match) return null;
  return {
    key: "study_focus",
    value: stopAtClauseBoundary(match[1]).replace(/[.?!]+$/, ""),
    confidence: 0.88,
    source: "user_stated"
  };
};

const extractLocationFact = (message) => {
  const match = message.match(/\b(?:i live in|i'm from|i am from)\s+(.+)/i);
  if (!match) return null;
  return {
    key: "location",
    value: stopAtClauseBoundary(match[1]).replace(/[.?!]+$/, ""),
    confidence: 0.9,
    source: "user_stated"
  };
};

const CLEANUP_FACT_KEYS = new Set(["name", "preference", "current_focus", "study_focus", "location"]);

const normalizeFactValue = (value = "") =>
  String(value)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/, "")
    .substring(0, 500);

export const extractFactsFromExchange = ({ userMessage = "" }) => {
  const text = String(userMessage || "").trim();
  if (!text) return [];

  const rawFacts = [
    extractNameFact(text),
    extractPreferenceFact(text),
    extractWorkFact(text),
    extractStudyFact(text),
    extractLocationFact(text)
  ].filter(Boolean);

  const seen = new Set();

  return rawFacts
    .map((fact) => ({
      ...fact,
      key: CLEANUP_FACT_KEYS.has(fact.key) ? fact.key : "memory",
      value: normalizeFactValue(fact.value)
    }))
    .filter((fact) => fact.value.length > 1)
    .filter((fact) => {
      const dedupeKey = `${fact.key}:${fact.value.toLowerCase()}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
};

export default { extractFactsFromExchange };
