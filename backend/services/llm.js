import fetch from "node-fetch";

// ─── Config ───
const getOllamaModel = (hasImages) => hasImages ? (process.env.OLLAMA_VISION_MODEL || "llava") : (process.env.OLLAMA_MODEL || "llama3");
const getOllamaBaseUrl = () => process.env.OLLAMA_BASE_URL || "http://localhost:11434";

import { exec } from 'child_process';
import path from 'path';

// ═══════════════════════════════════════════
// 🎤 AUDIO TRANSCRIPTION (Local Python-Whisper Bridge)
// ═══════════════════════════════════════════
export const transcribeAudio = async (filePath) => {
  return new Promise((resolve, reject) => {
    console.log(`🎙️  Transcribing audio locally: ${path.basename(filePath)}...`);
    
    // Call the Python script we created
    const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe.py');
    const command = `python "${scriptPath}" "${filePath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Local Whisper Python error:", stderr || error.message);
        return resolve(`[Transcription Failed: ${error.message}]`);
      }
      
      const transcription = stdout.trim();
      console.log("✅ Transcription complete:", transcription);
      resolve(transcription || "[Transcription Empty]");
    });
  });
};

// ═══════════════════════════════════════════
// 🌊 MAIN ENTRY (Streaming for WebSockets)
// ═══════════════════════════════════════════
export async function generateResponseStream(messages, onChunk, abortSignal) {
  try {
    const lastMessage = [...messages].reverse().find(m => m.role === 'user');
    const hasImages = lastMessage && lastMessage.images && lastMessage.images.length > 0;
    
    return await callOllamaStream(messages, onChunk, hasImages, abortSignal);
  } catch (err) {
    if (err.name === 'AbortError' || err.type === 'aborted') {
      console.log(`[Abort] Stream manually truncated by user`);
      throw err; // handled by the caller or caught below in callOllamaStream
    }
    console.error(`❌ Streaming Error:`, err.message);
    throw err;
  }
}

// ═══════════════════════════════════════════
// 🔥 MAIN ENTRY (Standard)
// ═══════════════════════════════════════════
export const generateResponse = async (messages) => {
  const lastMessage = [...messages].reverse().find(m => m.role === 'user');
  const hasImages = !!(lastMessage && lastMessage.images && lastMessage.images.length > 0);
  
  const model = getOllamaModel(hasImages);
  console.log(`\n🦙 Calling Ollama [${model}]`);
  
  const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      model, 
      messages: messages.map(m => ({ role: m.role, content: m.content })), 
      stream: false,
      options: { num_ctx: 16384 }
    })
  });
  
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  const data = await response.json();
  return data.message.content;
};

// ─── Ollama (Streaming) ───
const callOllamaStream = async (messages, onChunk, hasImages, abortSignal) => {
  const model = getOllamaModel(hasImages);
  const baseUrl = getOllamaBaseUrl();
  console.log(`🦙 Streaming Ollama [${model}]`);
  
  const safeMessages = messages.map(m => {
    if (!hasImages || !m.images) return { role: m.role, content: m.content };
    return m;
  });
  
  let fullContent = "";
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortSignal,
      body: JSON.stringify({ 
        model, 
        messages: safeMessages, 
        stream: true,
        options: { num_ctx: 16384 } 
      })
    });
    
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

    for await (const chunk of response.body) {
      if (abortSignal?.aborted) break;
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            onChunk(data.message.content);
            fullContent += data.message.content;
          }
        } catch (e) { /* ignore parse errors for partial chunks */ }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.type === 'aborted') {
      console.log(`[Abort] Stream manually stopped for Ollama`);
      return fullContent; // Gracefully return whatever partial content we accumulated
    }
    throw err;
  }
  return fullContent;
};