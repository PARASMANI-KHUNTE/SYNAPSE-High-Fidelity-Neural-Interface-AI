import axios from "axios";
import * as cheerio from "cheerio";
import { isInternalHostname } from "../utils/networkSecurity.js";

const SEARCH_TIMEOUT = 15000;
const MAX_RESULTS = 5;
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && !isInternalHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const getSourceFromUrl = (url) => {
  try {
    const host = new URL(url).hostname || "";
    return host.replace(/^www\./i, "");
  } catch {
    return "unknown";
  }
};

export const searchInternet = async (query) => {
  if (!query || query.length < 3 || query.length > 500) {
    return [];
  }

  const sanitizedQuery = query.replace(/[^\w\s-]/g, "").trim();
  
  if (!sanitizedQuery) {
    return [];
  }

  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🌐 Neural Research: Searching web for: "${sanitizedQuery}"...`);
      
      const url = `https://www.bing.com/search?q=${encodeURIComponent(sanitizedQuery)}`;
      
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1"
        },
        timeout: SEARCH_TIMEOUT,
        maxRedirects: 3,
        validateStatus: (status) => status === 200
      });

      const $ = cheerio.load(response.data);
      const results = [];
      const fetchedAt = new Date().toISOString();

      $("li.b_algo").each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        
        try {
          const titleEl = $(el).find("h2");
          const title = titleEl.text().trim();
          
          const linkEl = titleEl.find("a");
          const link = linkEl.attr("href") || $(el).find("a").first().attr("href");
          
          const snippetSelectors = [".b_caption p", ".b_algoSlug", ".b_lineclamp3", ".b_lineclamp2", ".snippet"];
          let snippet = "";
          
          for (const selector of snippetSelectors) {
            const el = $(el).find(selector);
            if (el.length) {
              snippet = el.text().trim();
              break;
            }
          }
          
          if (!snippet) {
            snippet = $(el).find("p").first().text().trim();
          }

          if (title && isValidUrl(link) && snippet && snippet.length > 20) {
            results.push({
              title: title.substring(0, 200),
              url: link,
              snippet: snippet.substring(0, 500),
              source: getSourceFromUrl(link),
              fetchedAt
            });
          }
        } catch (err) {
          // Skip malformed result
        }
        
        return true;
      });

      if (results.length === 0) {
        $(".b_caption p, .b_secondaryText").each((i, el) => {
          if (results.length >= 3) return false;
          const text = $(el).text().trim();
          if (text.length > 50 && !text.includes("http")) {
            results.push({
              title: "Web Snippet",
              url: "Bing Search",
              snippet: text.substring(0, 500),
              source: "bing.com",
              fetchedAt
            });
          }
          return true;
        });
      }

      console.log(`✅ Neural Research: Found ${results.length} relevant web snippets from Bing.`);
      return results;
      
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Bing search attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
      }
    }
  }

  // Fallback to DuckDuckGo
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🌐 Neural Research: Fallback to DuckDuckGo for: "${sanitizedQuery}"...`);
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(sanitizedQuery)}`;
      
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: SEARCH_TIMEOUT
      });

      const $ = cheerio.load(response.data);
      const results = [];
      const fetchedAt = new Date().toISOString();

      $(".result").each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        
        const titleEl = $(el).find(".result__a");
        const title = titleEl.text().trim();
        const link = titleEl.attr("href");
        const snippet = $(el).find(".result__snippet").text().trim();

        if (title && isValidUrl(link) && snippet && snippet.length > 20) {
          results.push({
            title: title.substring(0, 200),
            url: link,
            snippet: snippet.substring(0, 500),
            source: getSourceFromUrl(link),
            fetchedAt
          });
        }
        return true;
      });

      if (results.length > 0) {
        console.log(`✅ Neural Research: Found ${results.length} relevant web snippets from DuckDuckGo.`);
        return results;
      }
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ DuckDuckGo fallback attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    }
  }

  // Fallback to Google
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🌐 Neural Research: Fallback to Google for: "${sanitizedQuery}"...`);
      const url = `https://www.google.com/search?q=${encodeURIComponent(sanitizedQuery)}`;
      
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.google.com/"
        },
        timeout: SEARCH_TIMEOUT
      });

      const $ = cheerio.load(response.data);
      const results = [];
      const fetchedAt = new Date().toISOString();

      $(".g").each((i, el) => {
        if (results.length >= MAX_RESULTS) return false;
        
        const titleEl = $(el).find("h3");
        const title = titleEl.text().trim();
        const link = $(el).find("a").attr("href");
        const snippet = $(el).find(".VwiC3b").text().trim() || $(el).find(".yXK76").text().trim();

        if (title && isValidUrl(link) && snippet && snippet.length > 20) {
          results.push({
            title: title.substring(0, 200),
            url: link,
            snippet: snippet.substring(0, 500),
            source: getSourceFromUrl(link),
            fetchedAt
          });
        }
        return true;
      });

      if (results.length > 0) {
        console.log(`✅ Neural Research: Found ${results.length} relevant web snippets from Google.`);
        return results;
      }
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Google fallback attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      if (attempt < MAX_RETRIES) await sleep(1500 * attempt);
    }
  }

  console.error("❌ Neural Research failed after all retries and fallbacks:", lastError?.message);
  return [];
};

export const searchInternetCached = (() => {
  const cache = new Map();
  const CACHE_TTL = 5 * 60 * 1000;

  return async (query) => {
    const cacheKey = query.toLowerCase().trim();
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📦 Returning cached search results for: "${query}"`);
      return cached.results;
    }

    const results = await searchInternet(query);
    
    cache.set(cacheKey, { results, timestamp: Date.now() });
    
    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
    
    return results;
  };
})();
