# Low-Level Design (LLD) — Backend

## Entry & runtime

- `backend/app.js`
  - Express middleware: `helmet`, `compression`, request logger, `cors`, JSON body limit
  - HTTP rate limiting per route group (chat/upload/sandbox/auth/generic)
  - Static serving: `/uploads/*` with extension allowlist
  - Routes:
    - `/api/auth`
    - `/api/chat` (REST fallback)
    - `/api/memory`
    - `/api/upload`
    - `/api/sandbox`
  - Socket.IO init + attach listeners
  - Worker init (background in-memory queue)
  - `/health`, `/metrics`, `/api/config`
  - Graceful shutdown closes HTTP server + Mongoose connection

## Configuration

- `backend/src/config/env.js`
  - Zod schema for env vars
  - Builds a `config` object:
    - `app`, `auth`, `cors`, `mongo`, `ollama`, `sandbox`, `tts`

- `backend/src/config/database.js`
  - Mongoose connect with `dbName`, `serverSelectionTimeoutMS`

- `backend/src/config/socket.js`
  - Socket.IO init, CORS origins, buffer sizes
  - Socket auth middleware: `requireSocketAuth`
  - In-process rate limiting:
    - connections per IP
    - events per user per window

## Auth

- REST middleware: `backend/src/middleware/auth.js` (`requireAuth`)
  - Extracts Bearer token, verifies access token, sets `req.auth`
- Socket middleware: `requireSocketAuth`
  - Reads `handshake.auth.token` or header, sets `socket.auth`

- Token service: `backend/src/services/tokenService.js`
  - access token + refresh token sign/verify
  - refresh token hash (stored server-side)

- Routes: `backend/src/routes/auth.js`
  - `POST /register`
  - `POST /login`
  - `POST /refresh`
  - `POST /logout` (clears stored refresh hash)
  - `GET /me`

## Chat API (REST fallback)

- `backend/src/routes/chat.js`
  - Saves messages to `Chat`, optionally uses RAG, builds messages, calls `generateResponse`
  - Note: primary path is Socket.IO (below)

## Chat pipeline (Socket.IO primary)

### Event handler

- `backend/src/sockets/events/chatEvents.js`
  - `chat:message`
  - `chat:stop` (aborts active generation stream)
  - `chat:feedback` (thumbs up/down on a message)
  - `chat:suggest` (completion/autocomplete via `generateCompletion`)

### Orchestration services

- `backend/src/services/chatPipeline.js` (main orchestrator)
  - Creates/loads chat session (`Chat` document)
  - Normalizes message:
    - audio: transcribe + delete upload
    - image/pdf: provides default “analyze this” prompt
  - Persists user message
  - Extracts facts → stores facts → syncs profile
  - Agent routing:
    - planner `decompose()` returns `isAgentic` + one task
    - tools executed via `executeTool()`
    - tool result streamed back and persisted
  - Standard chat routing:
    - classify query, select model
    - optional RAG + attachment context + web search + image reference search
    - builds system prompt/history via `buildChatMessages()`
    - streams `generateResponseStream()` chunks back to client
    - optional TTS & PDF generation
    - persists assistant message + episodic summary update

### LLM client

- `backend/src/services/llm.js`
  - `generateResponseStream(messages, onChunk, abortSignal, modelOverride)`
  - `generateResponse(messages, modelOverride)` (non-stream)
  - `generateCompletion(text)` (autocomplete)
  - `checkOllamaHealth()`
  - `prewarmModel(modelName)`

## Agent/tool execution

### Planner

- `backend/src/agent/planner.js`
  - Heuristic regex routing of natural language → a single tool call plan

### Registry + policy + executor

- `backend/src/agent/toolRegistry.js` — registers tools (browser/git/filesystem/screenshot/terminal)
- `backend/src/agent/toolPolicy.js`
  - allow/deny/confirm decisions
  - special cases:
    - filesystem write actions confirm-required
    - terminal commands allowlist + confirm-required for `npm test/build/dev`
- `backend/src/agent/toolExecutor.js`
  - policy evaluation → optional needs-confirmation response → run tool → persist audit
- `backend/src/agent/auditLog.js`
  - writes `audit_logs` to Mongo when connected

### Tools

- `backend/src/tools/git.js` — safe git inspection (`status|branch|log|diff`)
- `backend/src/tools/filesystem.js` — read/list/stat/write/append/mkdir scoped to project root
- `backend/src/tools/terminal.js` — allowlisted commands (pwd/ls/cat/head/tail/grep/wc/find/du/npm/git)
- `backend/src/tools/browser.js` — fetch page HTML → extract text (blocks internal hostnames)
- `backend/src/tools/screenshot.js` — capture desktop screenshot → saves to `uploads/screenshots/`

## Memory system

- Facts extraction: `backend/src/memory/factExtractor.js` (heuristics)
- Storage:
  - `backend/src/models/MemoryFact.js` (`memory_facts`)
  - `backend/src/models/UserProfile.js` (`user_profiles`)
  - `backend/src/models/MemoryEpisode.js` (`memory_episodes`)
- Services:
  - `backend/src/memory/profileMemory.js`
  - `backend/src/memory/episodicMemory.js`
  - `backend/src/memory/memoryRouter.js` — returns a combined “memory context” view

API:
- `GET /api/memory/profile` via `backend/src/routes/memory.js`

## RAG

- Ingest: `backend/src/rag/ingest.js` (build FAISS index from `data.txt`)
- Retrieve: `backend/src/rag/retriever.js`
  - tries FAISS store; if unavailable uses `data.txt` chunk fallback
  - applies similarity and lexical overlap thresholds to reject OOD chunks

## Uploads

- `backend/src/middleware/upload.js` (multer disk storage, allowlist)
- `backend/src/routes/upload.js`
- Static serving in `backend/app.js` under `/uploads` with extension allowlist

## Sandbox (HTTP)

- Route: `backend/src/routes/sandbox.js`
  - Sanitizes JS code, caps output, runs with timeout
  - In production can execute via Docker with seccomp profile

## Background work & throttling

- In-memory queue worker:
  - `backend/src/utils/simpleQueue.js`
  - `backend/src/queues/chatQueue.js` + `backend/src/queues/worker.js`
  - used for “web-search” and “image-search” jobs from `chatPipeline.js`

- Concurrency control:
  - `backend/src/queues/jobOrchestrator.js` (p-queue)

## Triggers (in-memory)

- `backend/src/triggers/`
  - `scheduler.js` interval/timeout scheduler emitting alerts
  - `registry.js` registers triggers; includes builtin interval triggers
  - `eventBus.js` publishes alerts
  - No persistence layer is present in current code.

