import axios from "axios";
import * as cheerio from "cheerio";
import { isInternalHostname } from "../utils/networkSecurity.js";

const VERIFY_TIMEOUT = 20000;
const MAX_CLAIMS = 5;
const MAX_SOURCES_PER_CLAIM = 2;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && !isInternalHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const getHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "unknown";
  }
};

const EXTRACT_QUESTION_PATTERN = /(?:what is|who is|when did|where is|how (?:many|much)|is it|are they|did (?:it|he|she)|can (?:it|be)|should|does)\s+([^?]+)/i;

const extractVerifiableClaims = (text) => {
  const claims = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  const factPatterns = [
    /(?:was|is|are|were)\s+(\d+(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|trillion|percent|%|users?|people|users|years?|dollars?|USD|EUR|GBP|cases|deaths|votes))/gi,
    /(?:founded|created|launched|released|started|established)\s+in\s+(\d{4})/gi,
    /(\w+)\s+announced\s+(?:in\s+)?(\d{4})/gi,
    /(?:CEO|president|minister| founder|owner|creator)\s+is\s+(\w+(?:\s+\w+)?)/gi,
    /\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g,
    /(?:price|value|worth|market cap|valuation)\s+(?:is|at)?\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)/gi,
    /(?:version|update|release)\s+(?:is|from|version)\s+([\d.]+)/gi,
    /(?:latest|current|new)\s+(?:version|release|update)\s+(?:is|from)?\s*([\d.]+)/gi,
    /(\w+)\s+(?:company|founder|CEO|author|creator)\s+(\w+(?:\s+\w+){1,2})/gi
  ];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length < 30 || trimmed.length > 300) continue;
    
    const hasClaim = factPatterns.some(pattern => {
      pattern.lastIndex = 0;
      return pattern.test(trimmed);
    });

    if (hasClaim) {
      claims.push(trimmed);
    } else if (/\d{4}/.test(trimmed) && /company|product|version|release| founded/i.test(trimmed)) {
      claims.push(trimmed);
    } else if (/\$\d+/.test(trimmed)) {
      claims.push(trimmed);
    }

    if (claims.length >= MAX_CLAIMS) break;
  }

  return claims.slice(0, MAX_CLAIMS);
};

const buildVerificationQuery = (claim) => {
  const cleaned = claim.replace(/\s+/g, " ").trim();
  const match = cleaned.match(EXTRACT_QUESTION_PATTERN);
  if (match) {
    return match[1].trim();
  }
  
  const numMatch = cleaned.match(/(\d[\d,\.]*)\s*(million|billion|trillion|percent|%|users?|dollars?)/i);
  if (numMatch) {
    return `${numMatch[1]} ${numMatch[2]} ${cleaned.substring(0, 60)}`;
  }
  
  return cleaned.substring(0, 80);
};

const fetchVerificationSources = async (query) => {
  const sources = [];
  const sanitized = query.replace(/[^\w\s-]/g, "").trim().substring(0, 150);
  
  if (!sanitized || sanitized.length < 3) return sources;

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(sanitized)}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      timeout: VERIFY_TIMEOUT,
      validateStatus: () => true
    });

    if (response.status !== 200) return sources;

    const $ = cheerio.load(response.data);
    const fetchedAt = new Date().toISOString();

    $(".result").each((i, el) => {
      if (sources.length >= MAX_SOURCES_PER_CLAIM) return false;
      
      const title = $(el).find(".result__a").text().trim();
      const link = $(el).find(".result__a").attr("href");
      const snippet = $(el).find(".result__snippet").text().trim();

      if (title && isValidUrl(link) && snippet && snippet.length > 30) {
        sources.push({
          title: title.substring(0, 200),
          url: link,
          snippet: snippet.substring(0, 400),
          host: getHost(link),
          fetchedAt
        });
      }
      return true;
    });
  } catch (err) {
    console.warn("Verification source fetch failed:", err.message);
  }

  return sources;
};

const checkClaimAgainstSource = (claim, source) => {
  const claimLower = claim.toLowerCase();
  const snippetLower = source.snippet.toLowerCase();
  
  const numbersInClaim = claimLower.match(/\d[\d,\.]*/g) || [];
  const numbersInSource = snippetLower.match(/\d[\d,\.]*/g) || [];
  
  let confirmations = 0;
  let contradictions = 0;
  
  for (const num of numbersInClaim) {
    const normalizedNum = num.replace(/,/g, "");
    if (numbersInSource.some(ns => ns.replace(/,/g, "").startsWith(normalizedNum.substring(0, 4)))) {
      confirmations++;
    }
  }
  
  const yearMatch = claimLower.match(/\d{4}/);
  if (yearMatch && snippetLower.includes(yearMatch[0])) {
    confirmations++;
  }
  
  const keywords = claimLower.split(/\s+/).filter(w => w.length > 4);
  const matchedKeywords = keywords.filter(kw => 
    kw !== "which" && kw !== "there" && snippetLower.includes(kw)
  );
  
  if (matchedKeywords.length >= 2) {
    confirmations++;
  }
  
  const negativePatterns = [/not\s+(?:the\s+)?same|different|incorrect|wrong|false|no\s+longer|discontinued/i];
  for (const pattern of negativePatterns) {
    if (pattern.test(snippetLower) && !pattern.test(claimLower)) {
      contradictions++;
    }
  }

  const score = confirmations - contradictions;
  return score > 0 ? "confirmed" : score < 0 ? "contradicted" : "unverified";
};

export const verifyClaims = async (responseText) => {
  if (!responseText || responseText.length < 50) {
    return { verified: true, claims: [], overallConfidence: 1.0 };
  }

  const claims = extractVerifiableClaims(responseText);
  
  if (claims.length === 0) {
    return { verified: true, claims: [], overallConfidence: 0.5 };
  }

  const verifiedClaims = [];

  for (const claim of claims) {
    const query = buildVerificationQuery(claim);
    if (!query || query.length < 5) continue;

    const sources = await fetchVerificationSources(query);
    await sleep(500);

    const verifications = sources.map(source => ({
      source: source.title,
      url: source.url,
      status: checkClaimAgainstSource(claim, source),
      snippet: source.snippet
    }));

    const confirmedCount = verifications.filter(v => v.status === "confirmed").length;
    const contradictedCount = verifications.filter(v => v.status === "contradicted").length;
    const unverifiedCount = verifications.filter(v => v.status === "unverified").length;

    let status = "unverified";
    if (confirmedCount > 0 && contradictedCount === 0) {
      status = "confirmed";
    } else if (contradictedCount > confirmedCount) {
      status = "contradicted";
    } else if (confirmedCount > 0) {
      status = "partially_confirmed";
    }

    verifiedClaims.push({
      claim: claim.substring(0, 200),
      query,
      status,
      sources: verifications.slice(0, MAX_SOURCES_PER_CLAIM)
    });
  }

  const totalClaims = verifiedClaims.length;
  if (totalClaims === 0) {
    return { verified: false, claims: [], overallConfidence: 0.3 };
  }

  const confirmed = verifiedClaims.filter(c => c.status === "confirmed").length;
  const partially = verifiedClaims.filter(c => c.status === "partially_confirmed").length;
  const contradicted = verifiedClaims.filter(c => c.status === "contradicted").length;

  const confidence = (confirmed + partially * 0.5 - contradicted) / totalClaims;
  const overallConfidence = Math.max(0, Math.min(1, (confidence + 0.5) / 1.5));

  const hasContradictions = contradicted > 0;
  const hasVerifications = confirmed + partially > 0;

  return {
    verified: hasVerifications,
    claims: verifiedClaims,
    overallConfidence,
    hasContradictions,
    summary: hasContradictions 
      ? `Warning: ${contradicted} claim(s) may be inaccurate.`
      : hasVerifications 
        ? `${confirmed} claim(s) verified from web sources.`
        : "Unable to verify claims - could not fetch live data."
  };
};

export const verifyClaimsCached = (() => {
  const cache = new Map();
  const CACHE_TTL = 3 * 60 * 1000;

  return async (responseText) => {
    const cacheKey = responseText.substring(0, 100).toLowerCase().trim();
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    const result = await verifyClaims(responseText);
    cache.set(cacheKey, { result, timestamp: Date.now() });

    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }

    return result;
  };
})();

export default {
  verifyClaims,
  verifyClaimsCached
};