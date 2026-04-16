# Low-Level Design (LLD) — Frontend

## Entry points

- `frontend/index.html` — root container
- `frontend/src/main.jsx` — mounts `<App />`
- `frontend/src/App.jsx` — main application runtime

## App runtime responsibilities (`frontend/src/App.jsx`)

### Auth

- Stores tokens in localStorage:
  - `synapse_access_token`
  - `synapse_refresh_token`
- Calls REST endpoints:
  - `POST /api/auth/login|register|refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

### Socket.IO connection

- Connects to `VITE_API_URL` (defaults to `http://localhost:3001`)
- Handles reconnect attempts and connection-state UI
- Emits/handles primary events:
  - Emits: `chat:message`, `chat:stop`, `chat:list`, `chat:history`, `chat:delete`, `chat:feedback`, `chat:suggest`
  - Receives: `chat:reply:*`, `chat:model`, `chat:*:reply`, `agent:*`, `audio:ready`

### Streaming output UI

- Buffers token chunks and flushes on an interval (`STREAM_CHUNK_FLUSH_MS`)
- Tracks “generation active” and “waiting” UI states

### Panels and developer surfaces

`App.jsx` integrates:
- `Sidebar` — sessions list + settings + layout presets + memory preview
- `ChatWindow` — main conversation view
- `SandboxPanel` — JS execution panel (HTTP)
- `AgentConsole` — agent/tool events and direct tool controls
- `TriggerPanel` — trigger panel (currently partial/stub)

## Sidebar (`frontend/src/components/Sidebar.jsx`)

Key functions:
- Chat session navigation and deletion
- Settings:
  - auto speak toggle
  - voice selection (male/female)
  - panel visibility toggles (memory/status ring/agent console/sandbox)
  - layout presets (focus/dev/mission)

## UI component inventory (selected)

- Chat:
  - `ChatWindow.jsx`, `MessageBubble.jsx`, `InputBar.jsx`
- Agent/dev:
  - `AgentConsole.jsx`, `AgentDebugPanel.jsx`
- Memory:
  - `MemoryPanel.jsx`
- Sandbox:
  - `SandboxPanel.jsx`
- Visuals:
  - `StatusRing.jsx`, `Particles.jsx`, `ThreeBackground.jsx`, `VoiceVisualizer.jsx`
  - `AvatarCanvas.jsx`, `Avatar3D.jsx`

## Data flow (frontend perspective)

1) User logs in → tokens stored → socket connects with token
2) User selects chat session → fetches history via socket (`chat:history`)
3) User sends message → emits `chat:message` (text + attachments metadata)
4) UI receives stream chunks → merges into assistant message
5) UI receives optional attachments → displays images/audio/pdf links
6) UI periodically refreshes memory profile via REST (`/api/memory/profile`)

