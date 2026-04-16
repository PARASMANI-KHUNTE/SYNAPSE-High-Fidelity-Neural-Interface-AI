# SYNAPSE — Full Project Reference

> Master reference document. Read this first before touching any file.
> Last updated: 2026-04-16

---

## 🗺️ What is Synapse?

A **local-first multi-model AI chat assistant** running entirely on your machine via Ollama.

| Layer | Stack |
|---|---|
| Backend | Node.js (ESM) + Express 5 + Socket.IO 4 + MongoDB |
| Frontend | React 18 + Vite + Framer Motion + TailwindCSS |
| LLMs | Ollama (local inference) |
| DB | MongoDB (`LLMmemory` database) |
| Auth | JWT (access 15m + refresh 7d) |

**Ports:** Backend `3001`, Frontend `5173`

---

## 📁 Full Directory Map

```
Synapse/
├── backend/
│   ├── app.js                        ← Express + Socket.IO entry, health/metrics endpoints, graceful shutdown
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js                ← Zod-validated singleton config (all env vars)
│   │   │   ├── database.js           ← MongoDB connection
│   │   │   └── socket.js             ← Socket.IO init
│   │   ├── routes/
│   │   │   ├── auth.js               ← /api/auth (login, register, refresh, logout, me)
│   │   │   ├── chat.js               ← /api/chat (REST fallback)
│   │   │   ├── memory.js             ← /api/memory/profile
│   │   │   ├── upload.js             ← /api/upload (multer)
│   │   │   └── sandbox.js            ← /api/sandbox (JS execution)
│   │   ├── sockets/
│   │   │   ├── index.js              ← Attaches all socket listeners
│   │   │   └── events/
│   │   │       ├── chatEvents.js     ← chat:message, chat:stop, chat:history, chat:list, chat:delete, chat:feedback
│   │   │       ├── agentEvents.js    ← agent:run, agent:confirm, agent:cancel, agent:tools:list
│   │   │       └── sessionEvents.js  ← session management
│   │   ├── middleware/
│   │   │   ├── auth.js               ← requireAuth JWT middleware
│   │   │   ├── errorHandler.js       ← Global async error handler + notFoundHandler (exports both)
│   │   │   ├── loggerMiddleware.js   ← Request logger (method, url, status, duration)
│   │   │   ├── rateLimiter.js        ← standardLimiter + llmLimiter
│   │   │   └── validation.js         ← Zod schema middleware wrapper
│   │   ├── services/
│   │   │   ├── llm.js                ← Ollama API (stream + non-stream), prewarmModel(), keep_alive, exp backoff
│   │   │   ├── chatPipeline.js       ← Main chat orchestration: RAG+search+memory+TTS+agent
│   │   │   ├── chatRouter.js         ← classifyQuery(), shouldUseRAG(), resolveModelPreference()
│   │   │   ├── chatContext.js        ← buildChatMessages() — assembles full system+history prompt
│   │   │   ├── voice.js              ← generateTTS(), transcribeAudio(), createStreamingTts()
│   │   │   ├── imageSearch.js        ← Bing image scraper (uses turl CDN thumbnails)
│   │   │   ├── search.js             ← Web search (Bing/DuckDuckGo text results)
│   │   │   ├── pdf.js                ← parsePDF() — pdf-parse wrapper
│   │   │   ├── pdfGen.js             ← generatePDF() — pdfkit report generator
│   │   │   ├── cache.js              ← LRU caches: generalCache (5min), searchCache (15min)
│   │   │   ├── tokenService.js       ← JWT sign/verify helpers
│   │   │   └── workers/
│   │   │       └── heavyTasks.js     ← worker_threads runner (PDF parse offloaded here)
│   │   ├── agent/
│   │   │   ├── planner.js            ← LLM-driven tool plan generator
│   │   │   ├── toolExecutor.js       ← Executes a single tool with policy check
│   │   │   ├── toolRegistry.js       ← Registers all available tools
│   │   │   ├── toolPolicy.js         ← Risk assessment, confirmation requirements
│   │   │   └── auditLog.js           ← Logs tool executions
│   │   ├── tools/
│   │   │   ├── git.js                ← Git tool (status/branch/log/diff/stash/remote — safe read-only)
│   │   │   ├── filesystem.js         ← FS tool (read, list, write, mkdir — within projectRoot)
│   │   │   ├── terminal.js           ← Shell tool (~20 allowlisted commands, cross-platform)
│   │   │   ├── browser.js            ← Web fetch tool (cheerio text extraction)
│   │   │   ├── screenshot.js         ← Windows screenshot (nircmd / Win32 API)
│   │   │   └── pathUtils.js          ← getProjectRoot() helper
│   │   ├── memory/
│   │   │   ├── factExtractor.js      ← Extracts name/prefs/routines from user messages
│   │   │   ├── profileMemory.js      ← rememberFacts(), syncProfileFacts()
│   │   │   ├── episodicMemory.js     ← upsertEpisodeFromChat() — session summaries in Mongo
│   │   │   ├── memoryRouter.js       ← queryMemoryContext() — fetch relevant memory for prompt
│   │   │   └── sessionMemory.js      ← In-memory session store
│   │   ├── rag/
│   │   │   ├── ingest.js             ← Chunk + embed documents into FAISS
│   │   │   └── retriever.js          ← getRelevantDocs() — vector + lexical hybrid search
│   │   ├── models/
│   │   │   └── Chat.js               ← Mongoose Chat schema (messages, userId, title)
│   │   ├── queues/
│   │   │   ├── jobOrchestrator.js    ← p-queue: visionQ(1), ttsQ(1), reasoningQ(2), casualQ(10)
│   │   │   ├── chatQueue.js          ← addChatJob() for web-search and image-search
│   │   │   └── worker.js             ← initWorker() — processes background chat jobs
│   │   └── utils/
│   │       ├── logger.js             ← pino singleton (hijacks console.*)
│   │       ├── cleanup.js            ← Deletes uploads/ files >24h every 12h
│   │       └── networkSecurity.js    ← isInternalHostname() SSRF guard
│
├── frontend/
│   └── src/
│       ├── App.jsx                   ← Root: socket lifecycle, auth, message state, all handlers
│       ├── components/
│       │   ├── ChatWindow.jsx        ← Message list + scroll + status header + InputBar integration
│       │   ├── MessageBubble.jsx     ← Renders message, images, markdown, code blocks, feedback
│       │   ├── InputBar.jsx          ← Text input, voice recording, file upload, model selector
│       │   ├── Sidebar.jsx           ← Chat sessions, settings drawer, memory panel, collapse
│       │   ├── MemoryPanel.jsx       ← Displays facts/episodes/profile from memory API
│       │   ├── SandboxPanel.jsx      ← JS/code sandbox slide-in panel
│       │   ├── AgentConsole.jsx      ← Live agent tool execution feed
│       │   ├── AgentDebugPanel.jsx   ← Detailed agent event inspector
│       │   ├── Avatar3D.jsx          ← Three.js 3D avatar (basic animations)
│       │   ├── AvatarCanvas.jsx      ← Canvas wrapper for Avatar3D
│       │   ├── StatusRing.jsx        ← Animated status indicator in header
│       │   ├── VoiceVisualizer.jsx   ← Real-time audio waveform viz
│       │   ├── Particles.jsx         ← Particle background effect
│       │   ├── ThreeBackground.jsx   ← Three.js animated background
│       │   └── TriggerPanel.jsx      ← UI for manual trigger/proactive actions (stub)
│       └── index.css                 ← CSS variables, design tokens, glassmorphic utilities
```

---

## 🔌 Socket.IO Events Reference

### Client → Server
| Event | Payload | Handler |
|---|---|---|
| `chat:message` | `{chatId, message, fileUrl, fileType, images[], voice, modelPreference}` | `chatEvents.js` |
| `chat:stop` | — | Aborts current generation |
| `chat:history` | `{chatId}` | Returns full message history |
| `chat:list` | — | Returns all chat sessions for user |
| `chat:delete` | `{chatId}` | Deletes chat |
| `chat:feedback` | `{chatId, messageId, feedback}` | Stores thumbs up/down |
| `chat:suggest` | `{input}` | Returns autocomplete suggestion (debounced 300ms frontend) |
| `agent:run` | `{tool, params, sessionId}` | Runs agent tool directly |
| `agent:confirm` | `{token}` | Confirms dangerous tool execution |
| `agent:cancel` | `{token}` | Cancels pending tool execution |
| `agent:tools:list` | — | Returns all registered tools |

### Server → Client
| Event | Payload | When |
|---|---|---|
| `chat:reply:start` | — | LLM generation begins |
| `chat:reply:chunk` | `{chunk}` | Each streamed token |
| `chat:reply:end` | — | Full response complete |
| `chat:reply:file` | `{type, url, name}` | PDF or image attachment generated |
| `chat:reply:images` | `{images[]}` | Reference images from Bing search |
| `chat:model` | `{preference, model, queryType}` | Which model was selected |
| `chat:created` | `{chatId, title}` | New chat session created |
| `chat:stopped` | — | Generation manually stopped |
| `chat:error` | `{message}` | Error during generation |
| `chat:suggestion` | `{suggestion}` | Autocomplete suggestion |
| `audio:ready` | `{url}` | TTS audio file ready to play |
| `agent:thinking` | `{runId, step, message}` | Agent planning phase |
| `agent:tool:start` | `{runId, tool, params}` | Tool execution started |
| `agent:tool:result` | `{runId, tool, output}` | Tool execution finished |
| `agent:tool:error` | `{runId, tool, error}` | Tool execution failed |
| `agent:confirm:req` | `{runId, tool, params, risk}` | Tool needs user confirmation |
| `agent:done` | `{runId, success, tool, result}` | Agent turn complete |

---

## 🤖 LLM / Model Routing

### Models (configured in `.env`)
| Role | Env Var | Default |
|---|---|---|
| Casual/General | `OLLAMA_MODEL` | `llama3.2:1b` |
| Vision | `OLLAMA_VISION_MODEL` | `llava` |
| Reasoning | Set in `chatRouter.js` | `qwen2.5:7b` |
| Coding | Set in `chatRouter.js` | `deepseek-coder:6.7b` |

### `classifyQuery()` returns one of:
`CASUAL` | `REASONING` | `CODING` | `KNOWLEDGE` | `VISION`

### `resolveModelPreference()` logic:
- `auto` → uses `classifyQuery` result
- `chat` → forces casual model
- `code` → forces coding model
- `reasoning` → forces reasoning model
- `custom` → uses `customModel` string directly
- Has image → forces vision model regardless

### Ollama Options (set in `llm.js`)
- `keep_alive: "5m"` — model unloads from VRAM after 5 idle minutes
- `num_ctx: 4096` — context window
- `temperature: 0.1` — low for precision
- Startup pre-warms: `llama3.2:1b` (or `OLLAMA_MODEL`)
- Retry: exponential backoff `RETRY_DELAY * 2^(attempt-1)`, max `OLLAMA_MAX_RETRIES` (default 3)

---

## 🧠 Memory System

### Three Layers
| Layer | File | Storage | What it stores |
|---|---|---|---|
| Profile/Facts | `profileMemory.js` | MongoDB | Name, preferences, routines extracted from chat |
| Episodic | `episodicMemory.js` | MongoDB | Per-session summaries, key moments |
| Session | `sessionMemory.js` | In-memory | Short-term in-progress context |

### Flow
1. User sends message → `factExtractor.js` detects facts inline
2. After reply → `upsertEpisodeFromChat()` saves summary
3. Next turn → `queryMemoryContext()` retrieves relevant memory to inject in system prompt

---

## 🔍 RAG System

- **Vector store**: FAISS (`faiss-node`) at `./vectorstore/`
- **Embedding model**: `nomic-embed-text` via Ollama
- **Chunking**: 800 chars, 120 overlap (configurable)
- **Retrieval**: Hybrid — vector similarity + lexical keyword scoring
- **Top-K**: 6 results (configurable via `RAG_TOP_K`)
- **LRU cached**: 5-minute TTL (`generalCache` in `cache.js`)

---

## 🔊 Voice / TTS System

### TTS Engines (priority order in `voice.js`)
1. **Qwen TTS** — via Ollama (if model available)
2. **Edge TTS** — Microsoft neural voices (requires network)
3. **Native fallback** — system TTS

### Streaming TTS Pipeline (`chatPipeline.js`)
- `createStreamingTts()` — accumulates chunks, extracts speakable segments
- Min chars before speaking: 30 (first segment), 65 (subsequent)
- Processes TTS in parallel, emits in order via promise queue
- Emits `audio:ready` with URL per segment
- Frontend queues `Audio` objects and plays sequentially

### STT
- Web Speech API (browser native) — live in `InputBar.jsx`
- MediaRecorder → uploads audio file → Whisper transcription on backend

---

## 🌐 Image Search

### How it works (`imageSearch.js`)
1. Scrapes `bing.com/images/search?q=...` with Cheerio
2. Parses `.iusc` elements, extracts `m` JSON attribute
3. Uses `turl` (Bing CDN thumbnail) — NOT `murl` (external source) ← **critical**
4. Validates via `isValidImageUrl()` — trusted hosts: `bing.com`, `mm.bing.net`, `th.bing.com`, `googleusercontent.com`, `wikimedia.org`
5. Returns max 4 images

### Frontend display (`MessageBubble.jsx`)
- `<img referrerPolicy="no-referrer-when-downgrade" crossOrigin="anonymous">` ← **critical for Bing**
- Falls back to `ImageOff` placeholder on error
- `imageLoadErrors` Set tracked in `ChatWindow.jsx` state

---

## ⚙️ Environment Variables

```env
# App
NODE_ENV=development
AUTH_MODE=jwt             # jwt | userid | none
PORT=3001
BASE_URL=http://localhost:3001
OPERATOR_NAME=Operator
CORS_ORIGINS=http://localhost:3001,http://localhost:5173

# MongoDB
MONGO_URI=mongodb://localhost:27017
DB_NAME=LLMmemory

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_VISION_MODEL=llava
OLLAMA_TIMEOUT=120000
OLLAMA_MAX_RETRIES=3
OLLAMA_RETRY_DELAY=2000

# RAG
RAG_TOP_K=6
EMBEDDING_MODEL=nomic-embed-text
VECTORSTORE_PATH=./vectorstore
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=120

# Auth
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# TTS
ENABLE_TTS=true
TTS_ENGINE=
TTS_ACCENT=auto           # auto | en-us | en-in | hi-in
TTS_FILE_TTL_MS=300000

# Sandbox
SANDBOX_ENABLED=true
SANDBOX_DOCKER_IMAGE=node:20-alpine
SANDBOX_TIMEOUT_MS=5000
SANDBOX_MEMORY_LIMIT=128m
```

---

## 🏗️ Key Architectural Decisions

| Decision | Reason |
|---|---|
| Socket.IO for chat | Bidirectional streaming — HTTP SSE doesn't support abort |
| MongoDB for chat history | Flexible schema for messages with imageUrls, audioUrl, feedback |
| FAISS (not pgvector) | No extra DB needed, runs fully local |
| p-queue per model type | Prevents VRAM overload — Vision/TTS limited to 1 concurrent |
| LRU cache for RAG+search | Same question in the same session skips expensive FAISS/Bing calls |
| `keep_alive: "5m"` on Ollama | Frees VRAM between requests without cold-start overhead |
| Worker threads for PDF | Node event loop never blocks — parsing a large PDF takes 0 impact |
| `turl` not `murl` for images | Bing CDN always accessible; source images often hotlink-blocked |

---

## 🔧 Middleware Stack (in order, `app.js`)

```
helmet()              ← Security headers
compression()         ← Gzip
requestLogger()       ← pino request logging
CORS                  ← Configured origins only
express.json({10mb})  ← JSON body parser
/uploads static       ← Served with ext allowlist
/health               ← { status, uptime }
/metrics              ← { memory, sockets, queues }
/api/auth             ← Auth routes (rate limited)
/api/chat             ← requireAuth + rate limited
/api/memory           ← requireAuth
/api/upload           ← requireAuth + rate limited
/api/sandbox          ← requireAuth + rate limited
errorHandler()        ← Catches all async errors
notFoundHandler()     ← 404 fallback
```

---

## ⚠️ Known Gotchas / Watch Out For

1. **`terminal.js` template literals** — PowerShell commands embed single-quoted strings inside backtick template literals. Mixing `"` and `` ` `` inside nested strings breaks ESM parsing. Always use `[System.Environment]::NewLine` instead of `\n` in PS commands.

2. **Image search needs `turl` not `murl`** — Fixed already but don't revert. `murl` is the original source image; Bing hotlink-blocks most of these. `turl` is always from `th.bing.com`.

3. **`referrerPolicy` on images** — Must be `no-referrer-when-downgrade`. `no-referrer` breaks Bing CDN serving.

4. **Socket reconnect loop** — The boot `useEffect` in `App.jsx` must depend on `[]` only (run once). Adding `accessToken` to deps causes reconnect on every token refresh.

5. **Audio queue ordering** — TTS chunks generate in parallel but emit in order. Don't break the `queue = queue.then(...)` serial chain in `chatPipeline.js`.

6. **`errorHandler` exports both** — `app.js` imports `{ errorHandler, notFoundHandler }` from `src/middleware/errorHandler.js`. Both must be exported.

7. **ESM-only project** — `"type": "module"` in `package.json`. All imports must use `.js` extensions. No `require()`.

8. **`p-queue` is ESM-only** — Import as `import PQueue from "p-queue"`. Don't use `require`.

9. **`lru-cache` v10+ API** — Use `LRUCache` as named export: `import { LRUCache } from "lru-cache"`. The old `new LRU()` API broke in v8+.

10. **GitHub CI uses `npm install`** — NOT `npm ci` (lockfile has Windows-native optional deps that fail on Ubuntu).

---

## 📊 Performance Endpoints

```
GET /health    → { status: "OK", uptime: "Ns" }
GET /metrics   → {
  status, uptime, memory: { rss, heapTotal, heapUsed },
  sockets: N,
  queues: { vision, tts, reasoning, casual } each: { size, pending }
}
```

---

## 🚧 Not Implemented (Confirmed Zero Code)

- Perception layer (webcam, emotion)
- OS-level notifications / system tray
- Browser automation (form submission, DOM)
- Multi-agent planner system
- CLI client
- Mobile responsive layout
- Electron desktop wrapper
- Secrets manager
- Editable/custom memory triggers
- Multi-user collaborative sessions
- Command Orb / Thinking Panel UI
