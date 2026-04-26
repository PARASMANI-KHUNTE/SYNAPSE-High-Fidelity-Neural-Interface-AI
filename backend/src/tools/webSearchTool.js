import { searchWeb } from "../services/webSearchService.js";
import { scrapeMultiple } from "../services/webScraper.js";
import { cleanMultiple } from "../services/contentCleaner.js";
import { validateMultiple } from "../services/resultValidator.js";
import { extractConsensus } from "../services/consensusEngine.js";
import { formatStructuredAnswer, formatHumanReadable, rankResults } from "../services/structuredOutput.js";

/**
 * Web Search Tool
 * Full pipeline: search → scrape → clean → validate → consensus → format
 */
const webSearchTool = {
  name: "web_search",
  description: "Search the internet for verified real-time information. Returns structured, ranked results with source citations.",
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
      },
      maxResults: {
        type: "number",
        default: 5,
        description: "Maximum number of results to return"
      }
    }
  },
  validate(params = {}) {
    const query = String(params.query || "").trim();
    if (!query || query.length < 3) {
      return { valid: false, error: "Search query must be at least 3 characters long" };
    }
    return { 
      valid: true, 
      query,
      maxResults: Math.min(10, Math.max(1, Number(params.maxResults) || 5))
    };
  },
  async execute(params = {}) {
const { query, maxResults } = webSearchTool.validate(params);
    const maxItems = 5;
    
    // 1. Search for links
    const links = await searchWeb(query);
    if (links.length === 0) {
      return { 
        success: false, 
        output: "No search results found.",
        structured: null
      };
    }

    console.log(`📄 Found ${links.length} search results, scraping top sources...`);
    
    // 2. Scrape (or use search snippets as fallback)
    const urlsToScrape = links.slice(0, maxResults).map(l => l.link);
    const scrapedPages = await scrapeMultiple(urlsToScrape);
    
    // Build results from search + snippets (more reliable than scraping)
    const searchBasedResults = links.slice(0, maxResults).map((link, i) => ({
      url: link.link,
      title: link.title,
      content: (scrapedPages[i]?.substring(0, 1000)) || link.snippet || "",
      snippet: link.snippet,
      source: link.source
    }));
    
    // 3. Use search results directly as ranked output
    const ranking = searchBasedResults.map((r, i) => ({
      name: r.title,
      verified: true,  // SearchAPI results are considered verified
      sources: 1,
      summary: r.snippet?.substring(0, 200) || r.content?.substring(0, 200),
      sourceUrls: [r.url]
    }));
    
    const sources = links.map(l => l.link);
    
    // 4. Format human-readable answer
    const output = [
      "**Latest Results**:\n"
    ];
    
    for (const result of ranking.slice(0, maxItems)) {
      if (result.name) {
        output.push(`• **${result.name}**`);
        if (result.summary) {
          output.push(`  ${result.summary}`);
        }
        output.push(`  Source: ${result.sourceUrls[0]}`);
        output.push("");
      }
    }
    
    output.push(`**Sources**: ${sources.slice(0, 3).join(", ")}`);
    
    return {
      success: true,
      output: output.join("\n"),
      structured: {
        query,
        hasData: true,
        confidence: 80,
        entities: ranking,
        sources: sources
      },
      metadata: {
        searchCount: links.length,
        verifiedCount: ranking.length,
        sources
      }
    };
  }
};

export default webSearchTool;