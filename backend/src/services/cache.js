import { LRUCache } from "lru-cache";

// Cache for RAG search results and repetitive model routing
export const generalCache = new LRUCache({
  max: 500, // max 500 items
  ttl: 1000 * 60 * 5, // 5 minutes standard TTL
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false
});

// Cache for web search results (short-lived)
export const searchCache = new LRUCache({
  max: 100, // max 100 searches
  ttl: 1000 * 60 * 15, // 15 minutes TTL for web search
});

export const getCacheKey = (prefix, payload) => {
  return `${prefix}:${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
};
