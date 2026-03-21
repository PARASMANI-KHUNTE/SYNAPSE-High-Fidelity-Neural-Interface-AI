import { OllamaEmbeddings } from "@langchain/ollama";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

export const getRelevantDocs = async (query) => {
  const embeddingModel = process.env.EMBEDDING_MODEL || "nomic-embed-text";
  const vectorstorePath = process.env.VECTORSTORE_PATH || "./vectorstore";
  const topK = parseInt(process.env.RAG_TOP_K) || 6;
  // Lower score = more similar in FAISS L2. Threshold filters out noise.
  const minScore = parseFloat(process.env.RAG_MIN_SCORE) || 0.8;

  console.log(`\n🔍 [RAG] Query: "${query.substring(0, 100)}"`);
  console.log(`🔍 [RAG] Model: ${embeddingModel} | TopK: ${topK} | MinScore: ${minScore}`);

  const embeddings = new OllamaEmbeddings({ model: embeddingModel });
  const vectorStore = await FaissStore.load(vectorstorePath, embeddings);
  const results = await vectorStore.similaritySearchWithScore(query, topK);

  if (results.length === 0) {
    console.warn("⚠️ [RAG] No results found!");
    return "";
  }

  // Filter by relevance threshold
  const relevant = results.filter(([, score]) => score <= minScore);

  results.forEach(([doc, score], i) => {
    const passed = score <= minScore;
    console.log(`\n📄 [RAG] Result ${i + 1} | Score: ${score.toFixed(4)} | ${passed ? '✅ RELEVANT' : '❌ FILTERED OUT (noise)'}`);
    console.log(`   Preview: ${doc.pageContent.substring(0, 120).replace(/\n/g, ' ')}`);
  });

  if (relevant.length === 0) {
    console.warn(`⚠️ [RAG] All ${results.length} results scored above threshold (${minScore}) — query is out-of-domain. Returning empty.`);
    return "";
  }

  const context = relevant.map(([doc]) => doc.pageContent).join("\n\n");
  console.log(`✅ [RAG] Returning ${relevant.length}/${results.length} chunks (${context.length} chars)`);
  return context;
};