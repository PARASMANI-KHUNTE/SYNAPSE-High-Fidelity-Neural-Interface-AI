import config from "../config/env.js";
import { getCacheKey, generalCache } from "./cache.js";

const QUALITY_DIMENSIONS = [
  { key: "accuracy", weight: 0.35, label: "Factual Accuracy" },
  { key: "completeness", weight: 0.25, label: "Completeness" },
  { key: "coherence", weight: 0.15, label: "Logical Coherence" },
  { key: "safety", weight: 0.15, label: "Safety & Truthfulness" },
  { key: "usefulness", weight: 0.10, label: "Helpfulness" }
];

const PATTERN_SCORES = {
  hallucination: { pattern: /\b(?:approximately|around|roughly|about)\s+\$?\d+[\d,]*|latest\s+data\s+shows|according\s+to\s+\w+\s+(?:report|source|study)|research\s+shows|studies\s+show|evidence\s+suggests/i, penalty: -0.3 },
  uncertainty: { pattern: /\b(?:im not sure|i dont know|uncertain|unclear|sorry|could not find|no information)/i, bonus: 0.1 },
  hedging: { pattern: /\bmight\s+be|possibly|perhaps|maybe|might have|could be|would suggest/i, penalty: -0.1 },
  overconfidence: { pattern: /\b(?:definitely|absolutely|certainly|proven fact|no doubt|i guarantee|im positive)/i, penalty: -0.2 },
  verified_content: { pattern: /source:|fetchedat:|verified|cited|according to/i, bonus: 0.15 },
  tool_execution: { pattern: /i executed|i ran|i used|i triggered|tool result|output:/i, bonus: 0.1 },
  error_admission: { pattern: /\b(?:error|failed|unable to|could not|something went wrong)/i, bonus: 0.05 }
};

const scorePattern = (text, patternConfig) => {
  const matches = String(text || "").match(patternConfig.pattern);
  return matches ? matches.length * (patternConfig.penalty || patternConfig.bonus || 0) : 0;
};

const evaluateAccuracy = (response, context = {}) => {
  const text = String(response || "").toLowerCase();
  const hasNumbers = /\d[\d,\.]*/.test(text);
  const hasDates = /\b(19|20)\d{2}\b/.test(text);
  const hasSpecifics = /\$\d+|\d+\s*(?:million|billion|%|users?|people|cases)/i.test(text);
  
  let accuracy = 0.5;
  
  if (context.hasLiveData) {
    accuracy += 0.2;
  }
  
  if (hasNumbers || hasDates || hasSpecifics) {
    accuracy += 0.1;
  }
  
  if (context.citationsCount > 0) {
    accuracy += Math.min(0.2, context.citationsCount * 0.1);
  }
  
  return Math.min(1, accuracy);
};

const evaluateCompleteness = (response, userQuery = "") => {
  const text = String(response || "");
  const query = String(userQuery || "").toLowerCase();
  
  let completeness = 0.5;
  
  if (text.length < 50) return Math.max(0, completeness - 0.3);
  if (text.length > 500) completeness += 0.1;
  if (text.length > 1000) completeness += 0.1;
  
  if (/^(what|who|where|when|how|why)/.test(query)) {
    if (text.length < 100) return completeness - 0.2;
  }
  
  if (/\[|\]|\*\*|\|\`/.test(text)) {
    completeness += 0.1;
  }
  
  return Math.min(1, completeness);
};

const evaluateCoherence = (response) => {
  const text = String(response || "");
  
  let coherence = 0.7;
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length < 2) return coherence;
  
  const fragments = text.split(/[\n,]/).filter(s => s.trim().length > 5 && s.trim().length < 20);
  if (fragments.length > sentences.length * 0.5) {
    coherence -= 0.2;
  }
  
  if (/\n\n|\. /.test(text) && text.length > 100) {
    coherence += 0.1;
  }
  
  return Math.min(1, Math.max(0, coherence));
};

const evaluateSafety = (response) => {
  const text = String(response || "").toLowerCase();
  
  let safety = 0.9;
  
  const harmfulPatterns = [
    /\b(kill|hack|exploit|breach|steal|bypass|crack|malware)\b/i,
    /\b(buy|sell|trade)\s+(?:drugs|weapons|stolen)/i,
    /\bhate\s+\w+|discriminat/i
  ];
  
  for (const pattern of harmfulPatterns) {
    if (pattern.test(text)) {
      return 0;
    }
  }
  
  if (text.includes("as of 2025") || text.includes("as of 2024")) {
    safety -= 0.2;
  }
  
  safety += scorePattern(text, PATTERN_SCORES.hallucination);
  safety += scorePattern(text, PATTERN_SCORES.uncertainty);
  safety += scorePattern(text, PATTERN_SCORES.overconfidence);
  safety += scorePattern(text, PATTERN_SCORES.error_admission);
  
  return Math.min(1, Math.max(0, safety));
};

const evaluateHelpfulness = (response, query = "") => {
  const text = String(response || "");
  const queryLower = String(query || "").toLowerCase();
  
  let helpfulness = 0.6;
  
  if (/^(write|create|make|generate|build)/.test(queryLower)) {
    if (text.length > 100) helpfulness += 0.2;
  }
  
  if (/^(explain|describe|tell me)/.test(queryLower)) {
    if (text.length > 200) helpfulness += 0.1;
  }
  
  if (/^(list|show|what)/.test(queryLower)) {
    const hasList = /^[\d\*\-\•\•]|\n[0-9]\./.test(text);
    if (hasList) helpfulness += 0.15;
  }
  
  helpfulness += scorePattern(text, PATTERN_SCORES.tool_execution);
  
  return Math.min(1, Math.max(0, helpfulness));
};

export const evaluateQuality = (response, context = {}) => {
  const {
    userQuery = "",
    hasLiveData = false,
    citationsCount = 0,
    toolExecutions = 0
  } = context;

  const scores = {
    accuracy: evaluateAccuracy(response, { hasLiveData, citationsCount }),
    completeness: evaluateCompleteness(response, userQuery),
    coherence: evaluateCoherence(response),
    safety: evaluateSafety(response),
    usefulness: evaluateHelpfulness(response, userQuery)
  };

  let totalScore = 0;
  for (const dim of QUALITY_DIMENSIONS) {
    totalScore += scores[dim.key] * dim.weight;
  }

  const flags = [];
  if (scores.accuracy < 0.5) flags.push("low_accuracy");
  if (scores.completeness < 0.4) flags.push("incomplete");
  if (scores.safety < 0.6) flags.push("potentially_harmful");
  if (scores.coherence < 0.5) flags.push("incoherent");

  let grade = "F";
  if (totalScore >= 0.9) grade = "A";
  else if (totalScore >= 0.8) grade = "B";
  else if (totalScore >= 0.7) grade = "C";
  else if (totalScore >= 0.6) grade = "D";

  return {
    overallScore: Math.round(totalScore * 100) / 100,
    grade,
    scores,
    flags,
    dimensions: QUALITY_DIMENSIONS.map(d => ({ ...d, score: scores[d.key] }))
  };
};

export const evaluateQualityCached = (response, context = {}) => {
  const cacheKey = getCacheKey("quality", String(response || "").substring(0, 200));
  
  if (generalCache.has(cacheKey)) {
    return generalCache.get(cacheKey);
  }

  const result = evaluateQuality(response, context);
  generalCache.set(cacheKey, result);
  
  return result;
};

export const shouldRequestCorrection = (evaluation) => {
  if (!evaluation) return false;
  
  if (evaluation.scores.safety < 0.5) return true;
  if (evaluation.scores.accuracy < 0.4) return true;
  if (evaluation.flags.includes("potentially_harmful")) return true;
  
  return false;
};

export default {
  evaluateQuality,
  evaluateQualityCached,
  evaluateAccuracy,
  evaluateCompleteness,
  evaluateCoherence,
  evaluateSafety,
  evaluateHelpfulness,
  shouldRequestCorrection
};