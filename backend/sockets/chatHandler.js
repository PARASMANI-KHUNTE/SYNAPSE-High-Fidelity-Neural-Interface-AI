import Chat from "../models/Chat.js";
import { getRelevantDocs } from "../rag/retriever.js";
import { generateResponseStream, transcribeAudio } from "../services/llm.js";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";

export const chatSocketHandler = (io) => {
  const activeGenerations = new Map();

  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- Fetch Chat List ---
    socket.on("chat:list", async () => {
      try {
        // Query ALL local chats, bypassing strict userId since older chats were orphaned
        const chats = await Chat.find({}).select('_id title updatedAt').sort({ updatedAt: -1 });
        socket.emit("chat:list:reply", { chats });
      } catch (err) {
        console.error("Error fetching chat list:", err.message);
      }
    });

    // --- Fetch History for a specific Chat ---
    socket.on("chat:history", async ({ chatId }) => {
      if (!chatId) return;
      try {
        const chat = await Chat.findById(chatId);
        if (chat) {
          socket.emit("chat:history:reply", { chatId, messages: chat.messages });
        }
      } catch (err) {
        console.error("Error fetching history:", err.message);
      }
    });

    // --- Delete Chat Session ---
    socket.on("chat:delete", async ({ chatId }) => {
      if (!chatId) return;
      try {
        await Chat.findByIdAndDelete(chatId);
        // Refresh the list for the user after deletion
        const chats = await Chat.find({}).select('_id title updatedAt').sort({ updatedAt: -1 });
        socket.emit("chat:list:reply", { chats });
        socket.emit("chat:deleted", { chatId });
      } catch (err) {
        console.error("Error deleting chat:", err.message);
      }
    });

    socket.on("chat:stop", () => {
      const controller = activeGenerations.get(socket.id);
      if (controller) {
        controller.abort();
        activeGenerations.delete(socket.id);
      }
    });

    socket.on("chat:message", async (data) => {
      try {
        const { userId, chatId, message, images, audio, fileUrl } = data;
        
        let finalMessageText = message || "";
        let contextAddition = "";

        if (!message && !audio && (!images || images.length === 0) && !fileUrl) {
          socket.emit("chat:error", { message: "Empty message payload" });
          return;
        }

        const abortController = new AbortController();
        activeGenerations.set(socket.id, abortController);
        socket.emit("chat:reply:start"); // Open the UI bubble immediately for feedback

        // 1. Process Special Files (PDF/Docs)
        if (fileUrl && fileUrl.endsWith(".pdf")) {
          try {
            const { parsePDF } = await import("../services/pdf.js");
            const filePath = path.join(process.cwd(), fileUrl);
            const pdfText = await parsePDF(filePath);
            contextAddition += `\n[PDF CONTENT ATTACHED]:\n${pdfText.substring(0, 10000)}...`; // Limit context for token safety
            socket.emit("chat:reply:chunk", { chunk: `*📄 Processed PDF: ${path.basename(fileUrl)}*\n\n` });
          } catch (err) {
            console.error("PDF Handler Error:", err);
            socket.emit("chat:reply:chunk", { chunk: `*(Failed to process PDF: ${err.message})*\n\n` });
          }
        }

        // 2. Audio Transcription
        if (audio) {
          try {
            // transcribeAudio is already imported at the top
            const filename = audio.split('/').pop();
            const localPath = path.join(process.cwd(), 'uploads', filename);
            if (fs.existsSync(localPath)) {
              const transcript = await transcribeAudio(localPath);
              finalMessageText = (finalMessageText + " " + transcript).trim();
              socket.emit("chat:reply:chunk", { chunk: `*🎤 Transcribed Audio*\n\n` });
            }
          } catch (err) {
            console.error("Transcription Error:", err);
            socket.emit("chat:reply:chunk", { chunk: `*(Failed to transcribe audio: ${err.message})*\n\n` });
          }
        }

        // 3. Web Scraping Interceptor
        let urlScrapedContext = "";
        const urls = finalMessageText.match(/https?:\/\/[^\s]+/g);
        if (urls && urls.length > 0) {
          try {
            const targetUrl = urls[0];
            socket.emit("chat:reply:chunk", { chunk: `*🛜 Surfing the web: [${targetUrl}]...*\n\n` });
            
            const { data: html } = await axios.get(targetUrl, { 
              timeout: 10000, 
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
            });
            const $ = cheerio.load(html);
            $('script, style, noscript, nav, footer, iframe, img, svg').remove();
            const textOutput = $('body').text().replace(/\s+/g, ' ').trim();
            
            urlScrapedContext = `\n\n=== SCRAPED CONTENT FROM ${targetUrl} ===\n${textOutput.substring(0, 12000)}\n===================================\n\n`;
          } catch(err) {
            console.error("Scraping failed:", err.message);
            urlScrapedContext = `\n\n[System Note: Failed to scrape ${urls[0]} - ${err.message}]\n\n`;
            socket.emit("chat:reply:chunk", { chunk: `*(Failed to scrape link: ${err.message})*\n\n` });
          }
        }

        // --- NEW: Informational Reference Image Search ---
        const informationalKeywords = ["what is", "who is", "tell me about", "show me", "bmw", "apple", "logo"];
        if (informationalKeywords.some(k => finalMessageText.toLowerCase().includes(k)) && !images?.length) {
            try {
                const { searchReferenceImages } = await import("../services/imageSearch.js");
                const entities = finalMessageText.split(" ").slice(-3).join(" "); // rough entity extraction
                const refs = await searchReferenceImages(entities);
                if (refs && refs.length > 0) {
                    socket.emit("chat:reply:chunk", { chunk: "*(Finding reference images...)*\n\n" });
                    // We'll attach these to the final assistant message or send as a special chunk
                }
            } catch (err) { console.error("Search err:", err); }
        }

        // --- NEW: Stable Diffusion Image Generation Interceptor ---
        if (finalMessageText.toLowerCase().includes("generate an image of") || finalMessageText.toLowerCase().includes("create an image of")) {
            try {
                socket.emit("chat:reply:chunk", { chunk: "*(🎨 Painting your request locally...)*\n\n" });
                const { generateImage } = await import("../services/imageGen.js");
                const prompt = finalMessageText.replace(/generate an image of|create an image of/gi, "").trim();
                const imagePath = await generateImage(prompt);
                images.push(imagePath);
            } catch (err) {
                socket.emit("chat:reply:chunk", { chunk: `*(Failed to generate image: ${err.message})*\n\n` });
            }
        }

        // --- NEW: PDF Generation Flag ---
        let shouldGeneratePDF = false;
        if (finalMessageText.toLowerCase().includes("create a pdf report about")) {
            shouldGeneratePDF = true;
            socket.emit("chat:reply:chunk", { chunk: "*(📄 Researching for your PDF report...)*\n\n" });
        }

        // 2. Memory Configuration
        let chat;
        if (chatId) chat = await Chat.findById(chatId);
        
        if (!chat) {
          const titleContent = finalMessageText.trim() || "Image/Audio Upload";
          const title = titleContent.length > 25 ? titleContent.substring(0, 25) + '...' : titleContent;
          chat = await Chat.create({ userId, title, messages: [] });
          socket.emit("chat:created", { chatId: chat._id, title: chat.title });
        }

        // 3. RAG
        let ragContext = "";
        try {
           if (finalMessageText.trim()) {
             ragContext = await getRelevantDocs(finalMessageText);
           }
        } catch (e) {
           console.warn("RAG failed:", e.message);
        }

        // 4. Built Context
        const windowSize = parseInt(process.env.CONTEXT_WINDOW_SIZE) || 6;
        const recentMessages = chat.messages.slice(-windowSize);

        // --- Global Cross-Chat Memory ---
        let globalPastContext = "";
        try {
          // Bypass userId to catch orphaned old chats
          const otherChats = await Chat.find({ _id: { $ne: chat._id } })
            .sort({ updatedAt: -1 })
            .limit(3);
          
          let allPastMsgs = [];
          for (const c of otherChats) {
            allPastMsgs.push(...c.messages.slice(-5));
          }
          allPastMsgs.sort((a,b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
          const recentPastMsgs = allPastMsgs.slice(-10);
          
          if (recentPastMsgs.length > 0) {
            globalPastContext = `\nPrior interactions from user's other recent chats:
${recentPastMsgs.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
`;
          }
        } catch(e) { console.error("Global memory error:", e); }

        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeString = now.toLocaleTimeString('en-US');

        // Prepare format for LLM (Mapping image URLs to Base64)
        const formatForLLM = (m) => {
          const msgObj = { role: m.role, content: m.content };
          if (m.imageUrls && m.imageUrls.length > 0) {
            msgObj.images = m.imageUrls.map(url => {
              try {
                const filename = url.split('/').pop();
                const localPath = path.join(process.cwd(), 'uploads', filename);
                return fs.readFileSync(localPath, { encoding: 'base64' });
              } catch(e) { return null; }
            }).filter(Boolean);
          }
          return msgObj;
        };

        const llmMessages = [
          { 
            role: "system", 
            content: `You are a precise AI assistant named OS Assistant.
            
Current Date: ${dateString}
Current Time: ${timeString}
Timezone: UTC${now.getTimezoneOffset() / -60}

You have live internet access. Read the scraped contents closely.
${globalPastContext}
${urlScrapedContext}

Context:
${ragContext}` 
          },
          ...recentMessages.map(formatForLLM),
          formatForLLM({ 
            role: "user", 
            content: shouldGeneratePDF 
              ? `${finalMessageText}\n\n[INSTRUCTION]: Please write a detailed, professional, and well-structured research report on this topic. Use clear headings and bullet points where appropriate.`
              : finalMessageText, 
            imageUrls: images 
          })
        ];

        // 4. Stream Response
        let fullReply = "";
        let sentenceBuffer = "";
        
        try {
          const ttsScriptPath = path.join(process.cwd(), 'scripts', 'tts.py');
          const { exec } = await import("child_process");

          const generateTTS = (text) => {
            if (!text || text.trim().length < 3) return;
            const audioFileName = `speech_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp3`;
            const audioRelativePath = `uploads/${audioFileName}`;
            const audioAbsPath = path.join(process.cwd(), audioRelativePath);
            const voicePref = data.voice || 'male';
            const selectedVoice = voicePref === 'female' ? "en-US-JennyNeural" : "en-US-GuyNeural";
            
            const cleanText = text.replace(/[*_#`]/g, '').replace(/\[.*?\]/g, '').replace(/"/g, "'");
            exec(`python "${ttsScriptPath}" "${cleanText}" "${audioAbsPath}" "${selectedVoice}"`, (err) => {
               if (!err) socket.emit("audio:ready", { url: `${process.env.BASE_URL}/${audioRelativePath}` });
            });
          };

          fullReply = await generateResponseStream(llmMessages, (chunk) => {
            socket.emit("chat:reply:chunk", { chunk });
            
            // Sentence Buffering
            sentenceBuffer += chunk;
            const endings = /[.?!](\s+|$)/;
            if (endings.test(sentenceBuffer)) {
               const parts = sentenceBuffer.split(/([.?!](\s+|$))/);
               const sentence = (parts[0] + (parts[1] || "")).trim();
               sentenceBuffer = parts.slice(2).join("");
               generateTTS(sentence);
            }
          }, abortController.signal);

          // Final flush
          if (sentenceBuffer.trim()) generateTTS(sentenceBuffer.trim());

        } catch (err) {
          if (err.name === 'AbortError' || err.type === 'aborted') {
            console.log("Stream stopped safely by user.");
          } else { throw err; }
        }

        activeGenerations.delete(socket.id);

        // 5. Save memory
        if (fullReply && fullReply.trim()) {
          chat.messages.push(
            { role: "user", content: finalMessageText, imageUrls: images, audioUrl: audio },
            { role: "assistant", content: fullReply, timestamp: new Date() }
          );
          await chat.save();
        }

        // --- Post-Generation Image Search (If relevant) ---
        const lowerMsg = finalMessageText.toLowerCase();
        const searchKeywords = ["what is", "about", "who is", "show me", "define", "bmw", "logo", "car", "apple", "tesla"];
        if (searchKeywords.some(k => lowerMsg.includes(k)) && !images?.length) {
            try {
                const { searchReferenceImages } = await import("../services/imageSearch.js");
                const entities = finalMessageText.split(" ").slice(-2).join(" ");
                const searchResults = await searchReferenceImages(entities);
                if (searchResults && searchResults.length > 0) {
                    socket.emit("chat:reply:images", { images: searchResults.slice(0, 4) });
                }
            } catch (e) { console.error("Post-image search failed:", e); }
        }

        // --- Post-Generation PDF Creation (If flagged) ---
        if (shouldGeneratePDF && fullReply) {
            try {
                const { generatePDF } = await import("../services/pdfGen.js");
                const topic = finalMessageText.replace(/create a pdf report about/gi, "").trim() || "Report";
                const pdfPath = await generatePDF(fullReply, topic);
                socket.emit("chat:reply:chunk", { chunk: `\n\n✅ **PDF Report Finalized**: [Download ${topic}.pdf](${process.env.BASE_URL}/${pdfPath})\n\n` });
            } catch (err) {
                console.error("Post-PDF Error:", err);
                socket.emit("chat:reply:chunk", { chunk: `\n\n*(Failed to finalize PDF: ${err.message})*\n\n` });
            }
        }

        socket.emit("chat:reply:end", { fullReply });
      } catch (err) {
        activeGenerations.delete(socket.id);
        console.error("Chat Error:", err.message);
        socket.emit("chat:error", { message: "Internal Server Error: " + err.message });
      }
    });

    socket.on("disconnect", () => {
      const controller = activeGenerations.get(socket.id);
      if (controller) {
        controller.abort();
        activeGenerations.delete(socket.id);
      }
      console.log(`🔴 Client disconnected: ${socket.id}`);
    });
  });
};

