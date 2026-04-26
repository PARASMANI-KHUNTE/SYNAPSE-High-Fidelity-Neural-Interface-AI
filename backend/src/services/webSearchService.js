import axios from "axios";
import config from "../config/env.js";

/**
 * Web Search Service
 * Uses Serper API first, falls back to Tavily or free alternatives.
 */
export const searchWeb = async (query) => {
  const serperKey = process.env.SERPER_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  
  // Try Serper first (best quality)
  if (serperKey) {
    try {
      const response = await axios.post(
        "https://google.serper.dev/search",
        { q: query, num: 5 },
        {
          headers: {
            "X-API-KEY": serperKey,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      const results = response.data.organic || [];
      return results.map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        source: new URL(item.link).hostname,
      }));
    } catch (error) {
      console.warn("Serper failed:", error.message);
    }
  }
  
  // Try Tavily (free tier available)
  if (tavilyKey) {
    try {
      const response = await axios.get(
        `https://api.tavily.com/search`,
        {
          params: { 
            q: query, 
            max_results: 5,
            api_key: tavilyKey
          },
          timeout: 10000,
        }
      );

      const results = response.data.results || [];
      return results.map((item) => ({
        title: item.title,
        link: item.url,
        snippet: item.content,
        source: new URL(item.url).hostname,
      }));
    } catch (error) {
      console.warn("Tavily failed:", error.message);
    }
  }

  console.warn("⚠️ No search API key configured. Add SERPER_API_KEY or TAVILY_API_KEY to .env");
  return [];
};

export default { searchWeb };
