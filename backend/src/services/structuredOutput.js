export const StructuredFormat = {
  VERSION: "1.0",
  TYPES: {
    MOVIE: "movie",
    PERSON: "person",
    EVENT: "event",
    NEWS: "news",
    GENERAL: "general"
  },
  
  create: (data) => ({
    version: StructuredFormat.VERSION,
    timestamp: new Date().toISOString(),
    type: data.type || StructuredFormat.TYPES.GENERAL,
    query: data.query,
    hasData: data.hasData || false,
    confidence: data.confidence || 0,
    data: data.items || [],
    sources: data.sources || [],
    metadata: data.metadata || {}
  }),
  
  movie: (data) => ({
    ...StructuredFormat.create(data),
    type: StructuredFormat.TYPES.MOVIE,
    items: (data.movies || []).map(m => ({
      title: m.title,
      normalized: m.normalized,
      verified: m.verified,
      releaseDate: m.releaseDate,
      cast: m.cast || [],
      director: m.director,
      boxOffice: m.boxOffice,
      sourceCount: m.sources,
      sourceUrls: m.sourceUrls
    }))
  }),
  
  news: (data) => ({
    ...StructuredFormat.create(data),
    type: StructuredFormat.TYPES.NEWS,
    items: (data.headlines || []).map(n => ({
      headline: n.title,
      summary: n.summary,
      publishedAt: n.publishedAt,
      source: n.source,
      url: n.url
    }))
  })
};

export const formatStructuredAnswer = (consensus, query) => {
  const hasVerified = consensus.verified?.length > 0;
  const confidence = hasVerified 
    ? Math.round((consensus.verified.length / consensus.sourceCount) * 100) 
    : 0;
  
  return {
    query,
    hasData: consensus.hasConsensus,
    confidence,
    entities: consensus.entities.map(e => ({
      name: e.name,
      verified: e.sourceCount >= 2,
      sources: e.sourceCount,
      summary: e.details?.summary,
      sourceUrls: e.sources
    })),
    verified: consensus.verified,
    sources: [...new Set(consensus.entities.flatMap(e => e.sources))],
    metadata: {
      totalSources: consensus.sourceCount,
      verifiedCount: consensus.verified?.length || 0,
      timestamp: new Date().toISOString()
    }
  };
};

export const formatHumanReadable = (structured, maxItems = 5) => {
  const lines = [];
  const entities = structured.entities || [];
  
  // If no verified consensus but we have entities, use those
  const hasEntities = entities?.length > 0;
  const hasVerified = structured.verified?.length > 0;
  
  if (!hasEntities && !hasVerified) {
    lines.push("I couldn't find verified information for this query.");
    return lines;
  }
  
  if (hasEntities && entities.length > 0) {
    lines.push("**Search Results**:\n");
    
    for (const item of entities.slice(0, maxItems)) {
      const status = item.verified ? "✓ Verified" : "⚠ Unverified";
      lines.push(`• ${item.name} (${status})`);
      if (item.summary) {
        lines.push(`  ${item.summary.substring(0, 150)}...`);
      }
      if (item.sourceUrls?.length > 0) {
        lines.push(`  Source: ${item.sourceUrls[0]}`);
      }
      lines.push("");
    }
  }
  
  // Add raw sources
  if (structured.sources?.length > 0) {
    lines.push(`**Sources**: ${structured.sources.slice(0, 3).join(", ")}`);
  }
  
  return lines;
};

export const rankResults = (items, weights = {}) => {
  const {
    verifiedWeight = 0.4,
    sourceWeight = 0.3,
    recencyWeight = 0.2,
    relevanceWeight = 0.1
  } = weights;
  
  return items.map(item => {
    const score = 
      (item.verified ? verifiedWeight : 0) +
      Math.min(sourceWeight, (item.sources || 1) * (sourceWeight / 3)) +
      (item.isRecent ? recencyWeight : 0) +
      (item.relevance || 0.5) * relevanceWeight;
    
    return { ...item, rankScore: Math.round(score * 100) / 100 };
  }).sort((a, b) => b.rankScore - a.rankScore);
};

export default {
  StructuredFormat,
  formatStructuredAnswer,
  formatHumanReadable,
  rankResults
};