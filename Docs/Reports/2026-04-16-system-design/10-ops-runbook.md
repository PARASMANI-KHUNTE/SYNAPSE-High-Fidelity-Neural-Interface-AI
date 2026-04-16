# Ops / Runbook

## Prerequisites

- Node.js (backend + frontend)
- MongoDB available via `MONGO_URI`
- Ollama running (default `http://127.0.0.1:11434`)

## Install & run (dev)

Backend:
- `cd backend`
- `npm install`
- `npm run dev` (port default `3001`)

Frontend:
- `cd frontend`
- `npm install`
- `npm run dev` (port default `5173`)

## Environment variables (backend)

See `backend/src/config/env.js` for authoritative list; key ones:

- App:
  - `PORT`, `BASE_URL`, `CORS_ORIGINS`, `OPERATOR_NAME`
- Mongo:
  - `MONGO_URI`, `DB_NAME`
- Ollama:
  - `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_VISION_MODEL`
- RAG:
  - `VECTORSTORE_PATH`, `EMBEDDING_MODEL`, `RAG_TOP_K`, `RAG_MIN_SCORE`, `RAG_MAX_SCORE`, `RAG_MIN_LEXICAL_SCORE`
- Auth:
  - `AUTH_MODE`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- Sandbox:
  - `SANDBOX_ENABLED`, `SANDBOX_DOCKER_IMAGE`, `SANDBOX_TIMEOUT_MS`, `SANDBOX_MEMORY_LIMIT`, `SANDBOX_CPU_LIMIT`, `SANDBOX_PIDS_LIMIT`, `SANDBOX_SECCOMP_PROFILE`
- TTS:
  - `ENABLE_TTS`, `TTS_ENGINE`, `TTS_ACCENT`, `TTS_FILE_TTL_MS`

## Build vectorstore (RAG ingest)

From `backend/`:
- Ensure `data.txt` exists (or set `RAG_DATA_PATH`)
- Run `node src/rag/ingest.js`
- This writes FAISS artifacts to `VECTORSTORE_PATH` (default `./vectorstore`)

## Tests

- Backend RAG test: `cd backend && npm test` (runs `tests/rag.test.js`)

## Troubleshooting

- Ollama connection errors:
  - verify `OLLAMA_BASE_URL`
  - ensure the model names exist in Ollama (pull if missing)
- Mongo connection:
  - verify `MONGO_URI` and that DB is reachable
- Uploads not served:
  - ensure `backend/uploads/` exists and file extension is in the allowlist

