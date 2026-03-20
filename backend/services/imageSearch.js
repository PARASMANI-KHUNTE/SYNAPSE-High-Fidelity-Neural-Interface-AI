import axios from "axios";
import * as cheerio from "cheerio";

export const searchReferenceImages = async (query) => {
  if (!query || query.length < 2) return [];
  try {
    console.log(`🔍 Searching reference images for: "${query}"...`);
    // Using a more reliable image search URL (Bing Images fallback)
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}+logo+official&form=HDRSC2&first=1`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    const $ = cheerio.load(response.data);
    const imageUrls = [];

    // Extracting image URLs from m= attributes in Bing results (standard metadata format)
    $('.iusc').each((i, el) => {
       if (imageUrls.length >= 4) return;
       try {
         const mAttr = $(el).attr('m');
         if (mAttr) {
           const meta = JSON.parse(mAttr);
           if (meta.murl) imageUrls.push(meta.murl);
         }
       } catch (e) {
         // Fallback if parsing fails
       }
    });

    // Fallback if Bing script parsing fails: try finding regular img tags
    if (imageUrls.length === 0) {
       $('img.mimg').each((i, el) => {
         if (imageUrls.length >= 4) return;
         const src = $(el).attr('src');
         if (src && src.startsWith('http')) imageUrls.push(src);
       });
    }

    console.log(`✅ Found ${imageUrls.length} image results for query.`);
    return imageUrls;
  } catch (err) {
    console.error("Reference Image Search Error:", err.message);
    return [];
  }
};
