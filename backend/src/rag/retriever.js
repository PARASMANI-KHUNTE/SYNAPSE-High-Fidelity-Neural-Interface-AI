import fs from "fs";
import path from "path";
import { OllamaEmbeddings } from "@langchain/ollama";

const vectorStoreCache = { instance: null, lastLoad: 0, mode: null, entryCount: 0 };
const CACHE_TTL = 5 * 60 * 1000;
const CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE || "800", 10);
const CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP || "120", 10);
let hasWarnedAboutFaiss = false;

const resolveProjectPath = (targetPath) => {
  if (!targetPath) {
    return process.cwd();
  }
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);
};

const normalizeScore = (score) => 1 - Math.min(Math.max(score, 0), 1);

const chunkText = (text) => {
  const clean = String(text || "").trim();
  if (!clean) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(clean.length, start + CHUNK_SIZE);
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) {
      break;
    }
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks.filter(Boolean);
};

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);

const scoreChunk = (queryTerms, chunk) => {
  const chunkTerms = tokenize(chunk);
  if (chunkTerms.length === 0) {
    return 0;
  }

  const uniqueChunkTerms = new Set(chunkTerms);
  let overlap = 0;
  for (const term of queryTerms) {
    if (uniqueChunkTerms.has(term)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(queryTerms.length, 1);
};

const loadPlainTextChunks = () => {
  const dataPath = resolveProjectPath(process.env.RAG_DATA_PATH || "./data.txt");
  if (!fs.existsSync(dataPath)) {
    console.warn(`[RAG] Fallback dataset not found at ${dataPath}`);
    return [];
  }

  const raw = fs.readFileSync(dataPath, "utf8");
  return chunkText(raw);
};

const getFallbackResults = (query, topK) => {
  const chunks = loadPlainTextChunks();
  const queryTerms = tokenize(query);

  return chunks
    .map((chunk) => ({
      pageContent: chunk,
      score: scoreChunk(queryTerms, chunk)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK * 2)
    .map((item) => [
      { pageContent: item.pageContent },
      1 - Math.min(item.score, 1)
    ]);
};

const loadFaissStore = async () => {
  const { FaissStore } = await import("@langchain/community/vectorstores/faiss");
  const embeddingModel = process.env.EMBEDDING_MODEL || "nomic-embed-text";
  const vectorstorePath = process.env.VECTORSTORE_PATH || "./vectorstore";
  const embeddings = new OllamaEmbeddings({ model: embeddingModel });
  return FaissStore.load(vectorstorePath, embeddings);
};

const getVectorstoreEntryCount = () => {
  try {
    const vectorstorePath = resolveProjectPath(process.env.VECTORSTORE_PATH || "./vectorstore");
    const docstorePath = path.join(vectorstorePath, "docstore.json");
    if (!fs.existsSync(docstorePath)) {
      return 0;
    }

    const raw = fs.readFileSync(docstorePath, "utf8");
    const parsed = JSON.parse(raw);
    const docs = Array.isArray(parsed) ? parsed[0] : null;
    return Array.isArray(docs) ? docs.length : 0;
  } catch {
    return 0;
  }
};

const getSimilarityResults = async (query, topK) => {
  const now = Date.now();

  if (!vectorStoreCache.instance || (now - vectorStoreCache.lastLoad) > CACHE_TTL) {
    try {
      vectorStoreCache.instance = await loadFaissStore();
      vectorStoreCache.lastLoad = now;
      vectorStoreCache.mode = "faiss";
      vectorStoreCache.entryCount = getVectorstoreEntryCount();
      console.log("[RAG] Vector store loaded/cached");
    } catch (error) {
      vectorStoreCache.instance = null;
      vectorStoreCache.lastLoad = now;
      vectorStoreCache.mode = "fallback";
      vectorStoreCache.entryCount = 0;
      if (!hasWarnedAboutFaiss) {
        console.warn(`[RAG] FAISS unavailable, using text fallback: ${error.message}`);
        hasWarnedAboutFaiss = true;
      }
    }
  }

  if (vectorStoreCache.mode === "faiss" && vectorStoreCache.instance) {
    const desiredK = topK * 2;
    const available = Number(vectorStoreCache.entryCount || 0);
    const effectiveK = available > 0 ? Math.min(desiredK, available) : desiredK;
    return vectorStoreCache.instance.similaritySearchWithScore(query, effectiveK);
  }

  return getFallbackResults(query, topK);
};

export const getRelevantDocs = async (query) => {
  if (!query || query.trim().length < 3) return "";

  const embeddingModel = process.env.EMBEDDING_MODEL || "nomic-embed-text";
  const topK = parseInt(process.env.RAG_TOP_K || "6", 10);
  const maxScore = parseFloat(process.env.RAG_MAX_SCORE || "1.0");
  const minScore = parseFloat(process.env.RAG_MIN_SCORE || "0.0");
  const queryTerms = tokenize(query);
  const minLexicalScore = parseFloat(
    process.env.RAG_MIN_LEXICAL_SCORE || (queryTerms.length >= 3 ? "0.1" : "0")
  );

  console.log(`\n[RAG] Query: "${query.substring(0, 100)}"`);
  const desiredK = topK * 2;
  const available = Number(vectorStoreCache.entryCount || 0);
  const effectiveK = available > 0 ? Math.min(desiredK, available) : desiredK;
  console.log(`[RAG] Model: ${embeddingModel} | TopK: ${topK} | SearchK: ${effectiveK} | MinScore: ${minScore} | MaxScore: ${maxScore}`);

  const results = await getSimilarityResults(query, topK);

  if (!results.length) {
    console.warn("[RAG] No results found");
    return "";
  }

  const relevant = results.filter(([doc, score]) => {
    const normalized = normalizeScore(score);
    const lexicalScore = scoreChunk(queryTerms, doc.pageContent);
    return normalized >= minScore && normalized <= maxScore && lexicalScore >= minLexicalScore;
  });

  results.slice(0, topK).forEach(([doc, score], index) => {
    const normalized = normalizeScore(score);
    const lexicalScore = scoreChunk(queryTerms, doc.pageContent);
    const passed = normalized >= minScore && normalized <= maxScore && lexicalScore >= minLexicalScore;
    const tag = passed ? "PASS" : "SKIP";
    console.log(`  [${tag}] Result ${index + 1} | Score: ${normalized.toFixed(4)} | Lex: ${lexicalScore.toFixed(4)} | ${doc.pageContent.substring(0, 60).replace(/\n/g, " ")}...`);
  });

  if (!relevant.length) {
    console.log("[RAG] Context skipped (out-of-domain)");
    return "";
  }

  const limitedResults = relevant.slice(0, topK);
  const context = limitedResults.map(([doc]) => doc.pageContent).join("\n\n");
  console.log(`[RAG] Returning ${limitedResults.length}/${results.length} chunks (${context.length} chars) via ${vectorStoreCache.mode || "fallback"}`);
  return context;
};

export const invalidateVectorStoreCache = () => {
  vectorStoreCache.instance = null;
  vectorStoreCache.lastLoad = 0;
  vectorStoreCache.mode = null;
};
