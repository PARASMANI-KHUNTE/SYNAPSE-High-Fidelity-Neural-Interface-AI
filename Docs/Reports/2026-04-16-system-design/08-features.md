# Features Inventory

This is a consolidated feature list from existing docs + implemented code paths.

## Core assistant

- Multi-session chat (list/history/delete)
- Streaming assistant responses (Socket.IO chunks)
- Model routing (auto/casual/reasoning/coding/custom; plus vision override when images exist)
- Autocomplete/suggestion (`chat:suggest`)
- Message feedback (thumbs up/down)

## Memory

- Fact extraction (name/preferences/work/study/location heuristics)
- Durable facts store + profile aggregation
- Episodic memory:
  - heuristic session summaries
  - background LLM refinement into structured JSON
- Memory UI:
  - profile + facts + recent episodes via `/api/memory/profile`

## RAG

- FAISS vectorstore retrieval (on-disk)
- Fallback retrieval from `backend/data.txt` chunking if FAISS unavailable
- OOD rejection using similarity + lexical overlap thresholds
- Configurable chunk size/overlap/topK via env

## Multi-modal

- Image input → vision model message assembly (base64 images)
- Audio input:
  - upload audio → Whisper transcription
  - optional TTS generation (server-side)
- PDF:
  - parse uploaded PDFs and inject excerpt into prompt
  - generate PDF reports (PDFKit) when requested

## Web & reference search

- Web search jobs (background queue) when message looks “current info / latest / news / etc.”
- Reference image search jobs (background queue) when the user requests images

## Agent tools (policy-gated)

Agentic routing from natural language:
- `git` tool (status/branch/log/diff)
- `filesystem` tool (read/list/stat + confirm-gated write/append/mkdir)
- `terminal` tool (allowlisted commands; confirm-gated npm scripts)
- `browser` tool (public webpage fetch + text extract; blocks local/internal targets)
- `screenshot` tool (confirm-gated desktop capture)

Auditability:
- tool decisions and outputs stored to `audit_logs` when Mongo is connected

## Sandbox

- JS execution sandbox (HTTP)
- Sanitization + timeout + output caps
- Optional hardened docker execution path (production mode)

## Operations / observability

- `/health` endpoint
- `/metrics` endpoint: process memory + socket client count + queue metrics
- `/api/config` endpoint: operator name + configured model list

## Triggers (in-memory)

- Scheduler and registry (interval triggers)
- Emits trigger alerts to an internal event bus (UI consumption is partial)

