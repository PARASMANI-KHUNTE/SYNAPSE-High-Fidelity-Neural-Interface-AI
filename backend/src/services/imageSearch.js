import axios from "axios";
import * as cheerio from "cheerio";
import { isInternalHostname } from "../utils/networkSecurity.js";

const SEARCH_TIMEOUT = 12000;
const MAX_IMAGES = 4;
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isValidImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  
  const trimmed = url.trim();
  
  if (trimmed.length < 10 || trimmed.length > 500) return false;

  if (trimmed.toLowerCase().startsWith("data:") || trimmed.toLowerCase().startsWith("blob:") || trimmed.toLowerCase().startsWith("javascript:")) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (isInternalHostname(parsed.hostname)) return false;

  const pathname = parsed.pathname.toLowerCase();
  const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
  return validExtensions.some(ext => pathname.endsWith(ext));
};

export const searchReferenceImages = async (query) => {
  if (!query || query.length < 2 || query.length > 200) {
    return [];
  }

  const sanitizedQuery = query.replace(/[^\w\s-]/g, "").trim().substring(0, 150);
  
  if (!sanitizedQuery) {
    return [];
  }

  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔍 Searching reference images for: "${sanitizedQuery}"...`);
      
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(sanitizedQuery)}&form=HDRSC2&first=1&count=${MAX_IMAGES + 2}`;
      
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive"
        },
        timeout: SEARCH_TIMEOUT,
        maxRedirects: 3,
        validateStatus: (status) => status === 200
      });

      const $ = cheerio.load(response.data);
      const imageUrls = [];
      const seenUrls = new Set();

      $(".iusc").each((i, el) => {
        if (imageUrls.length >= MAX_IMAGES) return false;
        
        try {
          const mAttr = $(el).attr("m");
          
          if (mAttr) {
            try {
              const meta = JSON.parse(mAttr);
              
              if (meta.murl && isValidImageUrl(meta.murl) && !seenUrls.has(meta.murl)) {
                seenUrls.add(meta.murl);
                imageUrls.push(meta.murl);
              }
            } catch (parseErr) {
              // Invalid JSON in m attribute, skip
            }
          }
        } catch (err) {
          // Skip malformed element
        }
        
        return true;
      });

      if (imageUrls.length === 0) {
        $("img.mimg, img.thumb, a.thumbLink img").each((i, el) => {
          if (imageUrls.length >= MAX_IMAGES) return false;
          
          const src = $(el).attr("src") || $(el).attr("data-src");
          
          if (src && isValidImageUrl(src) && !seenUrls.has(src)) {
            seenUrls.add(src);
            imageUrls.push(src);
          }
          
          return true;
        });
      }

      const validatedUrls = imageUrls.filter(url => {
        if (!isValidImageUrl(url)) return false;
        
        const ext = url.toLowerCase().split(".").pop().split("?")[0];
        return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
      });

      console.log(`✅ Found ${validatedUrls.length} image results for query.`);
      return validatedUrls;
      
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Image search attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
      }
    }
  }

  console.error("❌ Reference Image Search failed after all retries:", lastError?.message);
  return [];
};
