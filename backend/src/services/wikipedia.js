import axios from "axios";
import * as cheerio from "cheerio";

const API_TIMEOUT = 10000;

const WIKIPEDIA_API = "https://en.wikipedia.org/wiki/";

const fetchWikipediaDirect = async (query) => {
  try {
    const searchTerm = encodeURIComponent(query.replace(/\s+/g, "_"));
    const url = `${WIKIPEDIA_API}${searchTerm}`;
    
    const response = await axios.get(url, {
      timeout: API_TIMEOUT,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      }
    });

    const $ = cheerio.load(response.data);
    const title = $("#firstHeading").text().trim() || query;
    const extract = $("#mw-content-text .mw-parser-output > p").first().text().trim();
    
    if (!extract) return null;

    return {
      title,
      url,
      snippet: extract.substring(0, 500),
      source: "wikipedia.org",
      fetchedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn("Wikipedia direct failed:", err.message);
    return null;
  }
};

const fetchWikipediaSummary = async (query) => {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:wikipedia.org`;
    
    const response = await axios.get(searchUrl, {
      timeout: API_TIMEOUT,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      }
    });

    const $ = cheerio.load(response.data);
    const results = [];
    const fetchedAt = new Date().toISOString();

    $(".g").each((i, el) => {
      if (results.length >= 3) return false;
      
      const title = $(el).find("h3").text().trim();
      const link = $(el).find("a").attr("href");
      const snippet = $(el).find(".VwiC3b, .yXK76").text().trim();

      if (title && link?.includes("wikipedia.org")) {
        results.push({
          title: title.substring(0, 200),
          url: link,
          snippet: snippet.substring(0, 400),
          source: "wikipedia.org",
          fetchedAt
        });
      }
    });

    return results;
  } catch (err) {
    console.warn("Wikipedia search failed:", err.message);
    return [];
  }
};

const fetchWiki = async (query) => {
  const direct = await fetchWikipediaDirect(query);
  if (direct) return [direct];
  
  const results = await fetchWikipediaSummary(query);
  return results.slice(0, 3);
};

export default {
  fetchWikipediaSummary,
  fetchWikipediaDirect,
  fetchWiki
};