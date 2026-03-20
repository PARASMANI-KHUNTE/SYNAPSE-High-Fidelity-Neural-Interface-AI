import { OllamaEmbeddings } from "@langchain/ollama";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

export const getRelevantDocs = async (query) => {
  const embeddingModel = process.env.EMBEDDING_MODEL || "nomic-embed-text";
  const vectorstorePath = process.env.VECTORSTORE_PATH || "./vectorstore";
  const topK = parseInt(process.env.RAG_TOP_K) || 6;

  const embeddings = new OllamaEmbeddings({ model: embeddingModel });
  const vectorStore = await FaissStore.load(vectorstorePath, embeddings);
  const results = await vectorStore.similaritySearch(query, topK);

  return results.map(r => r.pageContent).join("\n\n");
};