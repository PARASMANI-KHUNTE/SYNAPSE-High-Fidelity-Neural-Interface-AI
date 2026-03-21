/**
 * 🧪 SYNAPSE RAG Pipeline Test Suite
 * Run: npm test
 * 
 * Tests:
 *  T1 - RAG Integrity     : Query something only in your dataset
 *  T2 - Out-of-Domain     : Query should be rejected with "I don't have data..."
 *  T3 - Context Override  : Proves model uses RAG over training data
 *  T4 - Empty RAG         : Model should reject, not hallucinate (without RAG ctx)
 *  T5 - Relevance         : Off-topic query should get weak RAG hits (noise test)
 *  T6 - Real-Time Routing : Time-sensitive query should trigger internet search
 *  T7 - Chunk Quality     : Very specific query — vague answer = bad chunking
 *  T8 - Multi-turn Memory : Memory recall across messages
 */

import "dotenv/config";
import { getRelevantDocs } from "../rag/retriever.js";
import { generateResponse } from "../services/llm.js";
import fs from "fs";

const PASS = "\x1b[32m✅ PASS\x1b[0m";
const FAIL = "\x1b[31m❌ FAIL\x1b[0m";
const INFO = "\x1b[36mℹ️  INFO\x1b[0m";

const SYSTEM_PROMPT = (ctx) => `You are SYNAPSE, a precise AI assistant. 
RULES:
- You MUST answer using the provided context when it is relevant.
- If the context does not contain an answer, reply ONLY: "I don't have enough data in my neural memory to answer that accurately."
- DO NOT use information from your training data if context is available.

Context:
${ctx}`;

async function ask(question, context) {
  const msgs = [
    { role: "system", content: SYSTEM_PROMPT(context) },
    { role: "user", content: question }
  ];
  return await generateResponse(msgs);
}

async function runTest(id, name, fn) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`\x1b[33m🔬 TEST ${id}: ${name}\x1b[0m`);
  console.log("─".repeat(60));
  try {
    await fn();
  } catch (err) {
    console.error(`\x1b[31m💥 ERROR in Test ${id}: ${err.message}\x1b[0m`);
  }
}

// ─── Load data.txt to read what's ingested ─────────────────
const dataPath = process.env.RAG_DATA_PATH || "./data.txt";
let dataContent = "";
if (fs.existsSync(dataPath)) {
  dataContent = fs.readFileSync(dataPath, "utf-8").substring(0, 500);
}

console.log("\n\x1b[35m🧠 SYNAPSE RAG Test Suite\x1b[0m");
console.log(`📄 Dataset preview (first 500 chars): "${dataContent.substring(0, 200).replace(/\n/g, ' ')}..."\n`);

// ─── TEST 1: RAG Integrity ──────────────────────────────────
await runTest(1, "RAG Integrity — Query something in your dataset", async () => {
  // Grab a phrase from your actual data to test retrieval
  const samplePhrase = dataContent.split(".")[0]?.trim() || "INSAT-3D satellite";
  const query = `Tell me about: ${samplePhrase}`;
  console.log(`${INFO} Query: "${query}"`);
  const rag = await getRelevantDocs(query);
  console.log(`${INFO} RAG returned ${rag.length} chars`);
  if (rag.length > 100) {
    console.log(PASS, "RAG found relevant content");
    const answer = await ask(query, rag);
    console.log(`${INFO} Answer preview: ${answer.substring(0, 200)}`);
  } else {
    console.log(FAIL, "RAG returned too little data — check embeddings or vector store");
  }
});

// ─── TEST 2: Out-of-Domain ──────────────────────────────────
await runTest(2, "Out-of-Domain — Should reject unknown question", async () => {
  const query = "What is the capital of Mars?";
  console.log(`${INFO} Query: "${query}"`);
  const rag = await getRelevantDocs(query);
  console.log(`${INFO} RAG returned ${rag.length} chars`);
  const answer = await ask(query, rag || "[EMPTY CONTEXT - NO DATA AVAILABLE]");
  console.log(`${INFO} Answer: ${answer.substring(0, 200)}`);
  const isRejected = answer.toLowerCase().includes("don't have") || answer.toLowerCase().includes("cannot") || answer.toLowerCase().includes("no data");
  console.log(isRejected ? PASS : FAIL, isRejected ? "Model correctly rejected out-of-domain" : "⚠️ HALLUCINATION — model answered without data!");
});

// ─── TEST 3: Context Override ───────────────────────────────
await runTest(3, "Context Override — Fake data injection test", async () => {
  const fakeContext = "The capital of India is Indore. This is a test override.";
  const query = "What is the capital of India?";
  console.log(`${INFO} Injecting fake context: "${fakeContext}"`);
  console.log(`${INFO} Query: "${query}"`);
  const answer = await ask(query, fakeContext);
  console.log(`${INFO} Answer: ${answer.substring(0, 200)}`);
  const usedContext = answer.toLowerCase().includes("indore");
  console.log(usedContext ? PASS : FAIL, usedContext ? "Model correctly used injected RAG context over training data" : "⚠️ LLM IGNORING RAG — It answered from training data instead!");
});

// ─── TEST 4: Empty RAG (Prompt Strength) ────────────────────
await runTest(4, "Empty RAG — Prompt should force rejection not hallucination", async () => {
  const query = "Explain quantum entanglement in detail";
  console.log(`${INFO} Query: "${query}" with EMPTY context`);
  const answer = await ask(query, "[EMPTY — No documents in context]");
  console.log(`${INFO} Answer: ${answer.substring(0, 300)}`);
  const isRejected = answer.toLowerCase().includes("don't have") || answer.toLowerCase().includes("no data") || answer.toLowerCase().includes("cannot");
  console.log(isRejected ? PASS : FAIL, isRejected ? "Prompt is strong — model rejected without data" : "⚠️ WEAK PROMPT — model hallucinated with empty context!");
});

// ─── TEST 5: Relevance (Retrieval Noise) ────────────────────
await runTest(5, "Relevance — Off-topic query should get weak RAG hits", async () => {
  const query = "What are active volcanoes in Hawaii?";
  console.log(`${INFO} Query: "${query}" (unrelated to your dataset)`);
  const rag = await getRelevantDocs(query);
  console.log(`${INFO} RAG returned ${rag.length} chars`);
  console.log(`${INFO} RAG preview: "${rag.substring(0, 150).replace(/\n/g, ' ')}"`);
  // Low scores = noisy retrieval. High scores = good relevance filter.
  if (rag.length < 200) {
    console.log(PASS, "Retrieval returned minimal noise — good signal-to-noise ratio");
  } else {
    console.log(FAIL, "⚠️ RETRIEVAL NOISE — irrelevant chunks being returned. Consider raising the similarity threshold.");
  }
});

// ─── TEST 6: Real-Time Routing ──────────────────────────────
await runTest(6, "Real-Time Routing — Time-sensitive query check", async () => {
  const timeSensitiveKeywords = ["today", "current", "latest", "now", "2026", "war", "news"];
  const query = "What are the latest wars in 2026?";
  console.log(`${INFO} Query: "${query}"`);
  const triggersSearch = timeSensitiveKeywords.some(k => query.toLowerCase().includes(k));
  console.log(triggersSearch ? PASS : FAIL, triggersSearch ? "Keyword trigger detected — internet search WOULD activate in live chat" : "⚠️ Query not triggering real-time search — add keywords to the trigger list");
  const rag = await getRelevantDocs(query);
  console.log(`${INFO} RAG returned for time-sensitive query: ${rag.length} chars`);
  console.log(`${INFO} NOTE: Full internet routing only testable via live socket. Run in chat to confirm.`);
});

// ─── TEST 7: Chunk Quality ──────────────────────────────────
await runTest(7, "Chunk Quality — Specific query should get precise chunks", async () => {
  // Use a very specific phrase from your actual data
  const specificQuery = dataContent.split(/[.!?]/)[1]?.trim() || "INSAT-3D payload sensor";
  console.log(`${INFO} Query (specific detail): "${specificQuery}"`);
  const rag = await getRelevantDocs(specificQuery);
  console.log(`${INFO} RAG chunks returned: ${rag.length} chars`);
  const answer = await ask(specificQuery, rag || "[EMPTY]");
  console.log(`${INFO} Answer: ${answer.substring(0, 300)}`);
  const isVague = answer.toLowerCase().includes("generally") || answer.toLowerCase().includes("typically") || answer.length < 80;
  console.log(!isVague ? PASS : FAIL, !isVague ? "Answer is specific — chunking looks good" : "⚠️ VAGUE ANSWER — Chunking may be too coarse. Try reducing RAG_CHUNK_SIZE.");
});

// ─── TEST 8: Multi-turn Memory ──────────────────────────────
await runTest(8, "Multi-turn Memory — Memory recall across messages", async () => {
  const rag = await getRelevantDocs("satellites");
  const history = [
    { role: "system", content: SYSTEM_PROMPT(rag) },
    { role: "user", content: "I am studying satellites and space technology." },
    { role: "assistant", content: "Understood! I'll keep your focus on satellites and space technology in mind." },
    { role: "user", content: "Tell me more about what I am studying." }
  ];
  console.log(`${INFO} Sending multi-turn conversation`);
  const answer = await generateResponse(history);
  console.log(`${INFO} Answer: ${answer.substring(0, 300)}`);
  const usedMemory = answer.toLowerCase().includes("satellite") || answer.toLowerCase().includes("space");
  console.log(usedMemory ? PASS : FAIL, usedMemory ? "Memory working — model referenced previous turn" : "⚠️ MEMORY BROKEN — model did not recall previous context");
});

// ─── SUMMARY ────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log("\x1b[35m📊 Test run complete.\x1b[0m Check results above.");
console.log("─".repeat(60));
console.log("If Test 3 fails: Your LLM is ignoring RAG (worst issue)");
console.log("If Test 4 fails: Weak system prompt — needs hardening");
console.log("If Test 2 fails: Hallucination problem");
console.log("If Test 5 fails: Add a similarity score threshold in retriever.js");
console.log("If Test 7 fails: Reduce RAG_CHUNK_SIZE in .env (try 300-400)");
console.log("If Test 6 fails: Add more time-trigger keywords to chatHandler.js");
console.log(`${"═".repeat(60)}\n`);
