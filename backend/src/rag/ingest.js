import "dotenv/config";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OllamaEmbeddings } from "@langchain/ollama";
import fs from "fs";

const run = async () => {
  try {
    const dataPath = process.env.RAG_DATA_PATH || "./data.txt";
    const chunkSize = parseInt(process.env.RAG_CHUNK_SIZE) || 500;
    const overlap = parseInt(process.env.RAG_CHUNK_OVERLAP) || 100;
    const embeddingModel = process.env.EMBEDDING_MODEL || "nomic-embed-text";
    const vectorstorePath = process.env.VECTORSTORE_PATH || "./vectorstore";

    const text = fs.readFileSync(dataPath, "utf-8");

    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    console.log(`📄 Data: ${dataPath} (${chunks.length} chunks, size=${chunkSize}, overlap=${overlap})`);
    console.log(`🧠 Embedding model: ${embeddingModel}`);

    const embeddings = new OllamaEmbeddings({ model: embeddingModel });
    const vectorStore = await FaissStore.fromTexts(chunks, [], embeddings);

    await vectorStore.save(vectorstorePath);
    console.log(`✅ RAG ready → ${vectorstorePath}`);
  } catch (error) {
    console.error("❌ Ingest failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

run();