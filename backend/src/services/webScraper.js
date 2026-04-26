import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Web Scraper Service
 * Fetches HTML and extracts readable text content.
 */
export const scrapeUrl = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 8000,
      maxContentLength: 1024 * 1024 * 2, // 2MB limit
    });

    const $ = cheerio.load(response.data);
    
    // Remove unnecessary elements
    $("script, style, nav, footer, header, aside, iframe, noscript").remove();

    // Extract text from main content areas
    let text = $("main, article, #content, .content, .post-content, body").text();
    
    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Truncate to avoid context window issues (~5000 chars)
    return text.substring(0, 5000);
  } catch (error) {
    console.warn(`⚠️ WebScraper failed for ${url}:`, error.message);
    return "";
  }
};

/**
 * Scrapes multiple URLs in parallel
 */
export const scrapeMultiple = async (urls) => {
  const tasks = urls.slice(0, 3).map(url => scrapeUrl(url));
  return await Promise.all(tasks);
};

export default { scrapeUrl, scrapeMultiple };
