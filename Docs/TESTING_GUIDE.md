# Testing Guide

## Purpose

This guide documents how to verify Synapse layer by layer, what was validated in the latest engineering pass, and what to do when a check depends on a locally running backend/frontend process.

---

## Verified In This Pass

### Backend

- `backend npm test` passes.
- RAG retrieval now degrades gracefully when `faiss-node` is unavailable.
- `app.js` no longer auto-binds a port on import, which makes smoke testing safer.
- Direct Ollama non-stream and stream checks both worked.
- Tool executor smoke checks passed:
  - `git` read-only execution
  - `filesystem` read-only execution
  - `terminal` read-only execution
  - confirmation gating for `filesystem write`
  - confirmation gating for `screenshot`
- Live REST checks passed:
  - `GET /api/config`
  - `GET /api/system`
  - `GET /api/triggers`
- Live socket agent flow passed:
  - `agent:tools:list`
  - `agent:run` for `git`
  - `agent:tool:start`
  - `agent:tool:result`
  - `agent:done`
- Live chat flow passed:
  - agent-routed chat turn: `show git status`
  - normal LLM chat turn: `hello`
- Trigger CRUD passed:
  - `POST /api/triggers`
  - `PATCH /api/triggers/:id`

### Frontend

- `frontend npm run lint` passes.
- `frontend npm run build` passes in a non-sandboxed run.
- Layout window toggles, layout presets, and docked tool feed wiring were source-verified.

### Memory

- Fact extraction works at module level.
- Direct Mongo-backed memory writes work at module level.
- Important note:
  - the live backend process running during this pass did not reflect the current memory persistence code for chat turns
  - direct memory write tests passed against the repo code
  - if live memory still appears empty, restart the backend before retesting

---

## What Was Fixed During Testing

### 1. RAG fallback

File: `backend/src/rag/retriever.js`

- Replaced hard FAISS dependency behavior with dynamic loading.
- Added plain-text fallback retrieval from `data.txt`.
- Reduced noisy repeated FAISS warnings.

### 2. Backend import safety

File: `backend/app.js`

- Added `startServer()`.
- Avoided auto-listening on import.
- Exported `app`, `httpServer`, `io`, and `startServer`.

### 3. Memory deprecation cleanup

File: `backend/src/memory/profileMemory.js`

- Replaced deprecated Mongoose `new: true` option with `returnDocument: "after"`.

---

## Layer-By-Layer Test Checklist

### Layer 1: Backend foundation

Run:

```bash
cd backend
npm test
```

Expected:

- Test suite completes without crashing.
- If FAISS native bindings are missing, retrieval still works through fallback mode.

### Layer 2: Frontend quality gate

Run:

```bash
cd frontend
npm run lint
npm run build
```

Expected:

- Lint passes.
- Build passes.
- Large chunk warning may appear, but it is not a failure.

### Layer 3: Live backend API

Check:

- `GET /api/config`
- `GET /api/system`
- `GET /api/triggers`

Expected:

- JSON responses with no 500s.

### Layer 4: Agent tool layer

Verify:

- `git` tool returns branch or status.
- `filesystem list/read` works inside project scope.
- `terminal node --version` works.
- `filesystem write` requests confirmation.
- `screenshot` requests confirmation.

### Layer 5: Chat flow

Verify both types:

- Agentic: `show git status`
- Normal LLM: `hello`

Expected:

- Agentic chat returns tool output.
- Normal chat streams a natural assistant response.

### Layer 6: Memory

Verify:

- Send: `My name is <name>. I prefer concise answers.`
- Check `/api/memory/profile?userId=<sameUserId>`

Expected:

- Facts should appear.

If facts do not appear:

- restart backend
- rerun the same check
- if still broken, inspect `MemoryFact` and `UserProfile` collections directly

### Layer 7: Triggers

Verify:

- list built-ins
- create a new trigger
- disable it

Expected:

- trigger appears in API response
- toggle persists

---

## Recommended Manual End-To-End Flow

After restarting backend and frontend:

1. Open Synapse.
2. Use layout preset `Mission`.
3. Send `show git status`.
4. Send `hello`.
5. Send `My name is Paras and I prefer concise answers`.
6. Open Memory panel and confirm facts appear.
7. Open Trigger panel and create a file watcher.
8. Toggle System, Tool Feed, and Console panels on and off from `WINDOW_MGR`.
9. Switch to `Focus` preset and confirm the layout collapses cleanly.

---

## Known Caveats

- Live verification depends on restarting the backend after code changes.
- FAISS native bindings may be unavailable on some Windows setups; fallback retrieval now handles this.
- Frontend production build may fail inside some restricted sandboxes even when the app itself is healthy.
- The current JS bundle is large and emits a chunk-size warning during production build.

---

## Suggested Next QA Expansion

- Add scripted socket smoke tests to the repo.
- Add API-level tests for memory and trigger routes.
- Add a Playwright smoke test for the HUD layout and panel toggles.
- Add a startup health check page for Ollama, Mongo, and trigger/watcher status.
