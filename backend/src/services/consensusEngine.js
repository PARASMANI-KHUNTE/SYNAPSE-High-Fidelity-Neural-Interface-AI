import validator from "./resultValidator.js";
import resultValidator from "./resultValidator.js";
import { cleanMultiple } from "./contentCleaner.js";

const extractEntities = resultValidator.extractEntities;

const MIN_SOURCE_COUNT = 1;  // Lowered to 1 since we often only get 1-2 sources
const NAME_SIMILARITY_THRESHOLD = 0.85;

const normalizeTitle = (title) => {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(the |a |an )/g, "")
    .trim();
};

const calculateSimilarity = (a, b) => {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  
  if (normA === normB) return 1;
  
  const wordsA = new Set(normA.split(/\s+/));
  const wordsB = new Set(normB.split(/\s+/));
  
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  
  return intersection / union;
};

const extractEntityMentions = (results) => {
  const entityMap = new Map();
  
  for (const result of results) {
    const { text, url, validation } = result;
    if (!text || !validation?.valid) continue;
    
    const entities = validation.entities || extractEntities(text);
    
    for (const movie of entities.movies || []) {
      const normalized = normalizeTitle(movie);
      if (!entityMap.has(normalized)) {
        entityMap.set(normalized, {
          name: movie,
          mentions: [],
          sources: new Set(),
          dates: [],
          numbers: [],
          people: []
        });
      }
      
      const entry = entityMap.get(normalized);
      entry.mentions.push({ text: text.substring(0, 200), source: url });
      entry.sources.add(url);
      
      if (entities.dates) entry.dates.push(...entities.dates);
      if (entities.numbers) entry.numbers.push(...entities.numbers);
    }
    
    for (const person of entities.people || []) {
      const normalized = normalizeTitle(person);
      if (!entityMap.has(normalized)) {
        entityMap.set(normalized, {
          name: person,
          mentions: [],
          sources: new Set(),
          dates: [],
          numbers: [],
          people: []
        });
      }
      
      const entry = entityMap.get(normalized);
      entry.sources.add(url);
    }
  }
  
  return entityMap;
};

const calculateConsensus = (entityMap) => {
  const entities = [];
  
  for (const [key, data] of entityMap) {
    const sourceCount = data.sources.size;
    const consensusScore = Math.min(1, sourceCount / MIN_SOURCE_COUNT);
    
    const dateSet = new Set(data.dates);
    const numSet = new Set(data.numbers);
    
    const summary = data.mentions[0]?.text?.substring(0, 150) || "";
    
    entities.push({
      name: data.name,
      normalized: key,
      sourceCount,
      consensusScore: Math.round(consensusScore * 100) / 100,
      sources: [...data.sources].slice(0, 5),
      details: {
        dates: [...dateSet].slice(0, 3),
        numbers: [...numSet].slice(0, 3),
        summary
      },
      bestSource: [...data.sources][0] || null
    });
  }
  
  return entities.sort((a, b) => b.sourceCount - a.sourceCount);
};

const mergeSimilarEntities = (entities) => {
  const merged = [];
  const used = new Set();
  
  for (let i = 0; i < entities.length; i++) {
    if (used.has(i)) continue;
    
    const current = entities[i];
    const similar = [current];
    
    for (let j = i + 1; j < entities.length; j++) {
      if (used.has(j)) continue;
      
      const comparison = entities[j];
      const similarity = calculateSimilarity(current.normalized, comparison.normalized);
      
      if (similarity >= NAME_SIMILARITY_THRESHOLD) {
        similar.push(comparison);
        used.add(j);
        
        current.sourceCount += comparison.sourceCount;
        current.sources = [...new Set([...current.sources, ...comparison.sources])];
      }
    }
    
    merged.push({
      ...current,
      sourceCount: merged.length > 0 ? current.sourceCount : current.sourceCount,
      isMerged: similar.length > 1,
      variants: similar.map(s => s.name)
    });
    used.add(i);
  }
  
  return merged.sort((a, b) => b.sourceCount - a.sourceCount);
};

const buildConsensusReport = (entities) => {
  const lines = [];
  
  for (const entity of entities) {
    if (entity.sourceCount < MIN_SOURCE_COUNT) continue;
    
    const isVerified = entity.sourceCount >= 2;
    const status = isVerified ? "✓ VERIFIED" : "✗ SINGLE SOURCE";
    
    lines.push({
      name: entity.name,
      status,
      verified: isVerified,
      sources: entity.sourceCount,
      details: entity.details.summary,
      sourceList: entity.sources
    });
  }
  
  return lines;
};

export const extractConsensus = (scrapeResults, query = "") => {
  if (!scrapeResults || scrapeResults.length === 0) {
    return { hasConsensus: false, entities: [], report: [] };
  }
  
  const entityMap = extractEntityMentions(scrapeResults);
  const entities = calculateConsensus(entityMap);
  const mergedEntities = mergeSimilarEntities(entities);
  const report = buildConsensusReport(mergedEntities);
  
  const verified = report.filter(r => r.verified);
  const hasConsensus = verified.length > 0;
  
  return {
    hasConsensus,
    consensusScore: hasConsensus ? verified.length / report.length : 0,
    entities: mergedEntities,
    report,
    verified,
    unverified: report.filter(r => !r.verified),
    sourceCount: scrapeResults.length,
    uniqueSources: new Set(scrapeResults.map(r => r.url)).size
  };
};

export const processWithConsensus = async (searchResults, scrapedPages, query) => {
  const cleaned = cleanMultiple(scrapedPages);
  const validated = validateMultiple(cleaned, query);
  
  if (!validated.hasData) {
    return {
      success: false,
      reason: "no_valid_data",
      rawResults: searchResults
    };
  }
  
  const consensus = extractConsensus(validated.results, query);
  
  return {
    success: true,
    query,
    searchResults: searchResults.slice(0, 5),
    consensus,
    structured: consensus.entities.slice(0, 10).map(e => ({
      title: e.name,
      verified: e.sourceCount >= MIN_SOURCE_COUNT,
      sources: e.sourceCount,
      summary: e.details.summary,
      sourceUrls: e.sources
    }))
  };
};

export default {
  extractConsensus,
  processWithConsensus,
  normalizeTitle,
  calculateSimilarity
};