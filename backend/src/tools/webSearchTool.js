import { searchWeb } from "../services/webSearchService.js";
import { scrapeMultiple } from "../services/webScraper.js";

/**
 * Web Search Tool
 * Combines search and scraping to provide grounded context for the AI.
 */
const webSearchTool = {
  name: "web_search",
  description: "Search the internet for real-time information, news, or specific facts.",
  risk: "low",
  requiresConfirmation: false,
  readOnly: true,
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        required: true,
        description: "The search query to look up on the web"
      }
    }
  },
  validate(params = {}) {
    const query = String(params.query || "").trim();
    if (!query || query.length < 3) {
      return { valid: false, error: "Search query must be at least 3 characters long" };
    }
    return { valid: true, query };
  },
  async execute(params = {}) {
    const { query } = webSearchTool.validate(params);
    
    console.log(`🌐 Agentic Tool: Performing web search for "${query}"...`);
    
    // 1. Search for links
    const links = await searchWeb(query);
    if (links.length === 0) {
      return { success: false, output: "No search results found." };
    }

    // 2. Scrape the top 3 results for deeper context
    const urlsToScrape = links.slice(0, 3).map(l => l.link);
    const scrapedContents = await scrapeMultiple(urlsToScrape);

    // 3. Multi-source validation (consensus check)
    // We look for repeating entities or facts across snippets and scraped content
    const allText = links.map(l => `${l.title} ${l.snippet}`).join(" ") + scrapedContents.join(" ");
    const wordCounts = {};
    const entities = allText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    entities.forEach(e => {
      if (e.length > 3) wordCounts[e] = (wordCounts[e] || 0) + 1;
    });
    
    const validatedEntities = Object.entries(wordCounts)
      .filter(([_, count]) => count >= 2)
      .map(([entity]) => entity)
      .slice(0, 10);

    const consensusNote = validatedEntities.length > 0 
      ? `\n\nConsensus Entities found across multiple sources: ${validatedEntities.join(", ")}`
      : "";

    // 4. Combine into structured output
    const formattedResults = links.map((link, i) => {
      const content = scrapedContents[i] ? `\nContent Summary:\n${scrapedContents[i].substring(0, 800)}...` : "";
      return `[${i + 1}] ${link.title}\nSource: ${link.link}\nSnippet: ${link.snippet}${content}`;
    }).join("\n\n---\n\n") + consensusNote;

    return {
      success: true,
      output: formattedResults,
      metadata: {
        sources: links.map(l => l.link),
        count: links.length,
        consensus: validatedEntities
      }
    };
  }
};

export default webSearchTool;
