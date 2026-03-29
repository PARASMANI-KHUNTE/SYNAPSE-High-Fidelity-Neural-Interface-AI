# Synapse Architecture

## North Star

Synapse is evolving from a local AI chat app into a local assistant platform that can:

- perceive context
- reason across tools and memory
- act safely on the local machine
- remember across time
- surface state through a mission-control style interface

## Current Architecture Shape

The codebase is now organized around five main backend layers and a growing frontend control layer.

## Backend Layers

### 1. App and Runtime Layer

Primary files:

- `backend/app.js`
- `backend/src/config/database.js`
- `backend/src/config/socket.js`
- `backend/src/utils/config.js`
- `backend/src/utils/logger.js`

Responsibilities:

- application startup
- environment validation
- database initialization
- socket server initialization
- route mounting
- scheduler startup
- structured logging

### 2. Chat and Orchestration Layer

Primary files:

- `backend/src/sockets/events/chatEvents.js`
- `backend/src/services/chatPipeline.js`
- `backend/src/services/chatContext.js`
- `backend/src/services/chatRouter.js`
- `backend/src/services/llm.js`
- `backend/src/services/voice.js`

Responsibilities:

- receiving chat messages
- normalizing inputs
- routing between standard chat and agentic execution
- assembling context
- invoking LLMs
- handling audio transcription and TTS

Design intent:

- socket handlers stay thin
- orchestration moves into dedicated services

### 3. Agent Layer

Primary files:

- `backend/src/agent/planner.js`
- `backend/src/agent/toolRegistry.js`
- `backend/src/agent/toolPolicy.js`
- `backend/src/agent/toolExecutor.js`
- `backend/src/agent/auditLog.js`

Responsibilities:

- interpreting supported tool-backed intents
- registering available tools
- enforcing safety/policy decisions
- executing tools
- recording audit traces

Current tool categories:

- repo inspection
- project filesystem inspection
- allowlisted terminal inspection
- system status inspection
- webpage fetching and extraction

### 4. Memory Layer

Primary files:

- `backend/src/memory/factExtractor.js`
- `backend/src/memory/profileMemory.js`
- `backend/src/memory/sessionMemory.js`
- `backend/src/memory/episodicMemory.js`
- `backend/src/memory/memoryRouter.js`

Supporting models:

- `backend/src/models/UserProfile.js`
- `backend/src/models/MemoryFact.js`
- `backend/src/models/MemoryEpisode.js`

Responsibilities:

- extracting durable user facts
- syncing a user profile summary
- creating session-level memory episodes
- refining memory episodes in the background
- routing memory into prompt context

### 5. Proactive Trigger Layer

Primary files:

- `backend/src/triggers/registry.js`
- `backend/src/triggers/scheduler.js`
- `backend/src/triggers/eventBus.js`
- `backend/src/triggers/handlers/fileWatcher.js`

Supporting model:

- `backend/src/models/TriggerRule.js`

Responsibilities:

- storing trigger definitions
- initializing built-in triggers
- running scheduled actions
- syncing live file watchers
- publishing proactive alerts to the frontend

## Backend Data Model

Main persisted entities now include:

- chats
- audit logs
- memory facts
- memory episodes
- user profiles
- trigger rules

This is an important shift: Synapse is no longer storing only chat history and RAG data. It now has assistant-oriented state.

## Frontend Layers

Primary files:

- `frontend/src/App.jsx`
- `frontend/src/components/AgentDebugPanel.jsx`
- `frontend/src/components/MemoryPanel.jsx`
- `frontend/src/components/TriggerPanel.jsx`
- `frontend/src/components/SystemPanel.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/components/ChatWindow.jsx`
- `frontend/src/components/AvatarCanvas.jsx`

Responsibilities:

- maintaining socket connectivity
- showing chat and tool activity
- surfacing memory
- surfacing triggers and proactive alerts
- surfacing system state
- exposing a debug/control surface for tools

## Current End-to-End Flow

### Standard Chat Flow

1. Frontend emits `chat:message`
2. `chatEvents.js` normalizes request and loads session
3. `chatPipeline.js` assembles context and runs normal LLM flow
4. response streams back over socket chunks
5. chat and memory are updated

### Agentic Chat Flow

1. Frontend emits `chat:message`
2. planner inspects the message
3. if a supported tool-backed intent is found, the tool path is selected
4. tool executor runs policy evaluation and execution
5. tool events stream to the frontend
6. final tool output is returned as the assistant reply
7. chat and memory are updated

### Proactive Trigger Flow

1. scheduler initializes built-in triggers
2. cron triggers run on schedule
3. file triggers sync into active watchers
4. watcher events publish proactive alerts through the event bus
5. frontend receives `trigger:alert`
6. Trigger panel displays recent alerts

## Current Strengths

- cleaner backend separation than before
- a real tool execution seam
- policy and audit checkpoints
- memory beyond raw chat logs
- proactive event foundation
- visible machine and repo awareness

## Current Architectural Gaps

- no screenshot or webcam perception pipeline yet
- no write-capable tool layer yet
- no dedicated OS integration layer yet
- no multi-agent orchestration layer yet
- UI is still partly chat-first instead of fully HUD-first
- trigger authoring is still basic

## Recommended Near-Term Architecture Additions

1. `backend/src/tools/screenshot.js`
2. `backend/src/triggers/handlers/clipboardWatch.js`
3. `backend/src/tools/filesystemWrite.js` or write-safe expansion of existing filesystem tool
4. richer planner decomposition beyond single-task rule matching
5. frontend HUD container layer to gradually replace chat-first layout
