const MIN_WORD_COUNT = 15;
const MIN_ENTITY_WORDS = 2;
const MAX_AGE_DAYS = 30;

const RELIABLE_DOMAINS = new Set([
  "imdb.com", "rottentomatoes.com", "variety.com", "hollywoodreporter.com",
  "filmfare.com", "bollywoodhungama.com", "theguardian.com", "bbc.com",
  "reuters.com", "apnews.com", "nytimes.com", "wsj.com",
  "washingtonpost.com", "cnn.com", "bbc.co.uk",
  "wikipedia.org", "wikidata.org",
  "newsapi.org", "gnews.io"
]);

const LOW_QUALITY_PATTERNS = [
  /^(advertisement|sponsored|partner)/i,
  /^(subscribe|newsletter|sign up)/i,
  /copyright\s+\d{4}/i,
  /(?:cookie|privacy)\s+policy/i,
  /all\s+rights\s+reserved/i,
  /[\W]{50,}/,
];

const ENTITY_PATTERNS = {
  movie: /\b(?:movie|film|feature|directors?|stars?|casts?|releas(?:ed|es)|opening|in theaters)\b/i,
  person: /\b(?:actor|actress|director|producer|CEO|founder|creator|star)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  date: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})\b/,
  number: /\b(?:\d+(?:[\.,]\d+)?(?:\s*(?:million|billion|percent|%|crore|lakh))?)\b/i,
};

const isReliableSource = (url) => {
  try {
    const domain = new URL(url).hostname.replace(/^www\./i, "");
    return RELIABLE_DOMAINS.has(domain) || 
           RELIABLE_DOMAINS.has(domain.replace(/^[^.]+\./, ""));
  } catch {
    return false;
  }
};

const hasLowQualityContent = (text) => {
  for (const pattern of LOW_QUALITY_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
};

const calculateRelevanceScore = (content, query) => {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
  
  let matches = 0;
  for (const term of queryTerms) {
    if (contentLower.includes(term)) matches++;
  }
  
  const relevance = matches / queryTerms.length;
  
  const contentLength = content.split(/\s+/).length;
  const density = Math.min(1, contentLength / 500);
  
  const hasEntity = Object.values(ENTITY_PATTERNS).some(pattern => pattern.test(content));
  const entityBonus = hasEntity ? 0.1 : 0;
  
  return Math.min(1, (relevance * 0.6) + (density * 0.3) + entityBonus);
};

const extractEntities = (content) => {
  const entities = {
    movies: [],
    people: [],
    dates: [],
    numbers: []
  };
  
  if (ENTITY_PATTERNS.movie.test(content)) {
    const movieMatches = content.match(/(?:“|")([^“”"]+)(?:”|")|(['"][^'"]+['"])/g);
    if (movieMatches) {
      entities.movies = movieMatches.map(m => m.replace(/[”“"']/g, "").trim());
    }
  }
  
  const personMatches = content.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/g);
  if (personMatches) {
    entities.people = [...new Set(personMatches.slice(0, 5))];
  }
  
  const dateMatches = content.match(ENTITY_PATTERNS.date);
  if (dateMatches) {
    entities.dates = dateMatches.slice(0, 3);
  }
  
  const numberMatches = content.match(ENTITY_PATTERNS.number);
  if (numberMatches) {
    entities.numbers = numberMatches.slice(0, 5);
  }
  
  return entities;
};

const checkFreshness = (publishedAt, fetchedAt) => {
  if (!publishedAt || !fetchedAt) return 0.5;
  
  try {
    const published = new Date(publishedAt);
    const fetched = new Date(fetchedAt);
    const ageDays = (fetched - published) / (1000 * 60 * 60 * 24);
    
    if (ageDays < 0) return 0.5;
    if (ageDays > MAX_AGE_DAYS) return 0;
    if (ageDays < 1) return 1;
    if (ageDays < 7) return 0.8;
    return 0.5;
  } catch {
    return 0.5;
  }
};

export const validateResult = (result, query = "") => {
  const { url, text, title, metadata = {} } = result;
  
  if (!text || text.length < MIN_WORD_COUNT) {
    return { valid: false, reason: "insufficient_content" };
  }
  
  if (hasLowQualityContent(text)) {
    return { valid: false, reason: "low_quality_content" };
  }
  
  const relevance = calculateRelevanceScore(text, query);
  if (relevance < 0.3) {
    return { valid: false, reason: "irrelevant_content", relevance };
  }
  
  const reliable = isReliableSource(url);
  const freshness = checkFreshness(metadata.publishedAt, metadata.fetchedAt);
  const entities = extractEntities(text);
  
  const score = (relevance * 0.5) + 
             (reliable ? 0.25 : 0) + 
             (freshness * 0.15) + 
             (entities.movies.length > 0 || entities.people.length > 0 ? 0.1 : 0);
  
  return {
    valid: score >= 0.35,
    reason: score < 0.35 ? "low_score" : null,
    score: Math.round(score * 100) / 100,
    relevance: Math.round(relevance * 100) / 100,
    reliability: reliable ? "high" : "medium",
    freshness: Math.round(freshness * 100) / 100,
    entities,
    metadata: {
      ...metadata,
      source: url ? new URL(url).hostname : "unknown"
    }
  };
};

export const validateMultiple = (results, query = "") => {
  const validated = [];
  
  for (const result of results) {
    const validation = validateResult(result, query);
    if (validation.valid) {
      validated.push({
        ...result,
        validation
      });
    }
  }
  
  const averageScore = validated.length > 0
    ? validated.reduce((sum, r) => sum + r.validation.score, 0) / validated.length
    : 0;
  
  return {
    results: validated.sort((a, b) => b.validation.score - a.validation.score),
    count: validated.length,
    total: results.length,
    averageScore,
    hasData: validated.length > 0
  };
};

export default {
  validateResult,
  validateMultiple,
  isReliableSource,
  extractEntities,
  calculateRelevanceScore
};