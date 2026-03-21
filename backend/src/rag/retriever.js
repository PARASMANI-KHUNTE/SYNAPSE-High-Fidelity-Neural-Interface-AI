import { OllamaEmbeddings } from "@langchain/ollama";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

export const getRelevantDocs = async (query) => {
  if (!query || query.trim().length < 3) return "";

  const embeddingModel = process.env.EMBEDDING_MODEL || "nomic-embed-text";
  const vectorstorePath = process.env.VECTORSTORE_PATH || "./vectorstore";
  const topK = parseInt(process.env.RAG_TOP_K) || 6;
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
    const tag = passed ? '✅' : '❌';
    console.log(`  ${tag} Result ${i + 1} | Score: ${score.toFixed(4)} | ${doc.pageContent.substring(0, 60).replace(/\n/g, ' ')}...`);
  });

  if (relevant.length === 0) {
    if (query.length > 10) console.log("ℹ️ [RAG] Context skipped (out-of-domain)");
    return "";
  }

  const context = relevant.map(([doc]) => doc.pageContent).join("\n\n");
  console.log(`✅ [RAG] Returning ${relevant.length}/${results.length} chunks (${context.length} chars)`);
  return context;
};