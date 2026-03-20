import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Perform a real-time web search for text snippets.
 * This powers the 'Neural Research' and 'Present-Day Awareness' features.
 */
export const searchInternet = async (query) => {
  if (!query || query.length < 3) return [];
  try {
    console.log(`🌐 Neural Research: Searching web for: "${query}"...`);
    
    // Using Bing for reliable, snippet-heavy results
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // Bing search results are typically in 'li.b_algo' containers
    $('.b_algo').each((i, el) => {
      if (results.length >= 5) return;
      
      const title = $(el).find('h2').text().trim();
      const link = $(el).find('h2 a').attr('href');
      const snippet = $(el).find('.b_caption p, .b_algoSlug, .b_lineclamp3, .b_lineclamp2').text().trim();

      if (title && link && snippet) {
        results.push({
          title,
          url: link,
          snippet
        });
      }
    });

    // Fallback: search for any p tags with decent length if standard selectors fail
    if (results.length === 0) {
      $('.b_caption p').each((i, el) => {
        if (results.length >= 3) return;
        const text = $(el).text().trim();
        if (text.length > 50) {
          results.push({
            title: "Web Snippet",
            url: "Bing Search",
            snippet: text
          });
        }
      });
    }

    console.log(`✅ Neural Research: Found ${results.length} relevant web snippets.`);
    return results;
  } catch (err) {
    console.error("Neural Research Error:", err.message);
    return [];
  }
};
