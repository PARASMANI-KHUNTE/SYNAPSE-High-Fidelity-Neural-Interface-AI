import * as cheerio from "cheerio";

const BLOCK_TAGS = new Set([
  "script", "style", "nav", "header", "footer", "aside",
  "form", "button", "input", "iframe", "noscript",
  "svg", "canvas", "video", "audio"
]);

const AD_SELECTORS = [
  ".ad", ".ads", ".advertisement", ".sponsored",
  "[class*='ad-']", "[class*='ads-']", "[id*='ad-']",
  "[class*='promo']", "[class*='banner']", "[class*='sponsor']",
  "[data-ad]", "[data-advertisement]", "[aria-label*='advertisement']"
];

const NOISE_SELECTORS = [
  ".social-share", ".share-buttons", ".related-articles",
  ".newsletter", ".subscribe", ".popup", ".modal",
  "[class*='cookie']", "[class*='consent']", "[class*='gdpr']",
  ".comments", ".comment-section", ".reviews"
];

const TRAILING_PATTERNS = [
  /^(follow|share|like|comment|subscribe|sign up|register)/i,
  /^(read more|click here|learn more)/i,
  /^\d+\s+(followers?|views?|likes?)$/i,
];

const cleanText = (text) => {
  if (!text) return "";
  
  let cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  
  for (const pattern of TRAILING_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  
  return cleaned.replace(/^[\s\-•·]+|[\s\-•·]+$/g, "").trim();
};

const extractMainContent = (html) => {
  if (!html) return "";
  
  const $ = cheerio.load(html);
  
  for (const selector of AD_SELECTORS.concat(NOISE_SELECTORS)) {
    $(selector).remove();
  }
  
  $("script, style, nav, header, footer, aside").remove();
  
  const contentSelectors = [
    "article", "[role='main']", "main",
    ".article-content", ".article-body", ".post-content",
    ".story-content", ".story-body", ".content-body",
    ".entry-content", ".post-body", ".article__body",
    "#article", "#content", "#main-content"
  ];
  
  for (const selector of contentSelectors) {
    const content = $(selector).first();
    if (content.length && content.text().length > 100) {
      return content.html();
    }
  }
  
  const paragraphs = $("p");
  if (paragraphs.length > 2) {
    return paragraphs.map((i, el) => $(el).html()).get().join(" ");
  }
  
  return $("body").html() || "";
};

const extractCleanText = (html) => {
  if (!html) return "";
  
  const mainContent = extractMainContent(html);
  const $ = cheerio.load(mainContent);
  
  $("a").each((i, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const href = $el.attr("href");
    if (href && !text.includes(href)) {
      $el.replaceWith(`[${text}](${href})`);
    } else {
      $el.replaceWith(text);
    }
  });
  
  $("strong, b").each((i, el) => {
    const text = $(el).text().trim();
    $(el).replaceWith(`**${text}**`);
  });
  
  let text = $.root().text();
  
  text = cleanText(text);
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  if (sentences.length > 0) {
    text = sentences.join(". ");
  }
  
  return text;
};

const extractMetadata = (html, url = "") => {
  if (!html) return { title: "", description: "", image: "", author: "", publishedAt: "", url };
  
  const $ = cheerio.load(html);
  
  const title = 
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='twitter:title']").attr("content") ||
    $("title").text() ||
    $("h1").first().text() ||
    "";
  
  const description = 
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    "";
  
  const image = 
    $("meta[property='og:image']").attr("content") ||
    $("meta[name='twitter:image']").attr("content") ||
    "";
  
  const author = 
    $("meta[name='author']").attr("content") ||
    $("[rel='author']").text() ||
    $(".author").text() ||
    "";
  
  const publishedAt = 
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[name='date']").attr("content") ||
    "";
  
  return {
    title: cleanText(title),
    description: cleanText(description),
    image,
    author: cleanText(author),
    publishedAt,
    url
  };
};

const isValidContent = (text) => {
  if (!text || text.length < 50) return false;
  
  const junkPatterns = [
    /^[\s\d\W]+$/,
    /^(cookie|privacy|terms|legal)/i,
    /^(subscribe|newsletter|sign up)/i,
    /^(copyright|©|\d{4})/i,
  ];
  
  for (const pattern of junkPatterns) {
    if (pattern.test(text)) return false;
  }
  
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) return false;
  
  return true;
};

export const cleanContent = (html, url = "") => {
  const text = extractCleanText(html);
  const metadata = extractMetadata(html, url);
  
  if (!isValidContent(text)) {
    return { valid: false, text: "", metadata };
  }
  
  return {
    valid: true,
    text: text.substring(0, 5000),
    metadata,
    wordCount: text.split(/\s+/).filter(Boolean).length
  };
};

export const cleanMultiple = (pages) => {
  const results = [];
  
  for (const page of pages) {
    const cleaned = cleanContent(page.content, page.url);
    if (cleaned.valid) {
      results.push({
        ...cleaned,
        source: page.source || new URL(page.url).hostname,
        url: page.url
      });
    }
  }
  
  return results;
};

export default {
  cleanContent,
  cleanMultiple,
  extractCleanText,
  extractMetadata,
  isValidContent
};