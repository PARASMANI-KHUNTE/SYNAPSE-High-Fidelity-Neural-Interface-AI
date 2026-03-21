import axios from "axios";
import * as cheerio from "cheerio";

const SEARCH_TIMEOUT = 15000;
const MAX_RESULTS = 5;
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.hostname.includes("localhost");
  } catch {
    return false;
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
              snippet: snippet.substring(0, 500)
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
              snippet: text.substring(0, 500)
            });
          }
          return true;
        });
      }

      console.log(`✅ Neural Research: Found ${results.length} relevant web snippets.`);
      return results;
      
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Search attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
      }
    }
  }

  console.error("❌ Neural Research failed after all retries:", lastError?.message);
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
