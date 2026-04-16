# Architecture Overview

Synapse is a **local-first, multi-model AI assistant** that runs on your machine (Ollama for inference) with a realtime UI (Socket.IO). It combines:

- **Chat orchestration** (streaming, attachments, search, PDF)
- **Agent/tool execution** (read-only tools + confirmation gates)
- **Persistent memory** (facts + episodic summaries in MongoDB)
- **RAG** (FAISS vectorstore, fallback lexical chunking)
- **Multi-modal** (images via vision model, audio STT/TTS)

## Repository layout (top-level)

- `backend/` — Node.js (ESM) + Express + Socket.IO + MongoDB services
- `frontend/` — React + Vite mission-control UI
- `Docs/` — existing architecture, roadmap, testing docs
- `cli/` — prompt/input artifacts (currently `prompt.txt`)
- `desktop/` — present but currently empty

## Runtime architecture (containers)

```mermaid
flowchart LR
  U[User Browser] -->|HTTP| FE[Frontend (Vite/React)]
  FE -->|Socket.IO| BE[Backend (Express + Socket.IO)]
  FE -->|HTTP (REST)| BE

  BE -->|Mongoose| MDB[(MongoDB)]
  BE -->|HTTP| OLL[Ollama API :11434]
  BE -->|FAISS files| VS[(Vectorstore on disk)]
  BE -->|Local FS| UP[(uploads/ + generated artifacts)]
  BE -->|HTTP| WEB[(Public websites/search endpoints)]
```

## Backend “layers” (by module boundaries)

This matches the code’s separation of responsibilities:

1) **App & Runtime**
   - Express startup, middleware, routes, metrics/health, Socket.IO init.
2) **Sockets & Chat Orchestration**
   - `chat:message` and streaming reply events.
3) **Services**
   - LLM streaming, PDF parse/generation, web search, image search, voice STT/TTS.
4) **Agent Layer**
   - Planner → tool registry → policy evaluation → executor → audit log.
5) **Memory & RAG**
   - Facts + user profile + episodic memory + FAISS retriever.
6) **Background Work**
   - In-memory queue for web/image search; p-queue for model concurrency.
7) **Triggers (in-memory)**
   - Scheduler + registry + event bus (builtins, interval-based).

## Frontend “layers” (by UI intent)

- **Session/chat**: recent chats list, history, delete
- **Realtime console surfaces**: streaming tokens, agent events, tool results
- **Utility panels**: sandbox, memory panel, triggers panel (partial)
- **Auth**: login/register/refresh/logout + token persistence

## Key interfaces

- **Socket.IO** (primary realtime path):
  - `chat:*` events for chat and streaming
  - `agent:*` events for tool execution + confirmation gates
- **REST APIs** (supporting):
  - `/api/auth/*` register/login/refresh/logout/me
  - `/api/upload` upload attachments
  - `/api/memory/profile` memory visibility
  - `/api/sandbox` JS execution sandbox (HTTP)
  - `/api/config`, `/health`, `/metrics`

## Persistent state

Stored in MongoDB:

- `users` — accounts + refresh token hash
- `chats` — chat sessions + messages + feedback
- `memory_facts` — durable extracted facts
- `user_profiles` — aggregated profile facts/preferences
- `memory_episodes` — per-session episodic summaries
- `audit_logs` — tool policy decisions and results

On disk:

- `backend/vectorstore/` — FAISS index files (if built)
- `backend/uploads/` — user uploads + generated audio/screenshots

## Design constraints (observed)

- Local inference via **Ollama HTTP API** is treated as an external dependency.
- Tool execution is **policy-gated** with audit logging.
- “Heavy” workloads are serialized (or constrained) via in-memory queues.
- Networking is conservative for browser tool (blocks internal hostnames).

