# Synapse Changelog

## Unreleased

### Added

- centralized backend config validation in `backend/src/utils/config.js`
- structured logging in `backend/src/utils/logger.js`
- agent planner, registry, policy, executor, and audit log modules
- `AuditLog`, `MemoryFact`, `MemoryEpisode`, `UserProfile`, and `TriggerRule` models
- read-only tools for `git`, `filesystem`, `terminal`, `process`, and `browser`
- agent socket events for tool execution, confirmation, and result streaming
- extracted `chatPipeline.js` service for chat orchestration
- memory services for fact extraction, profile sync, episodic memory, and memory routing
- memory API route and frontend memory panel
- trigger registry, scheduler, event bus, and file watcher handler
- trigger API route and frontend trigger panel
- system status API and frontend system panel
- browser page extraction capability
- proactive trigger alerts streamed to the frontend
- implementation report, architecture doc, roadmap, and changelog docs

### Changed

- `chatEvents.js` was thinned to focus more on orchestration
- `voice.js` became the sole owner of transcription/TTS responsibilities
- prompt context now includes durable memory and episodic memory inputs
- the frontend app now fetches and displays memory, trigger, and system state

### Verified

- backend smoke checks for new services, routes, and tool modules
- tool execution smoke checks for safe read-only tools
- planner routing checks for agentic chat patterns
- browser URL normalization checks

### Known Constraints

- frontend production build verification became inconsistent in the current sandbox because of native Vite/Tailwind dependency loading and PowerShell execution-policy issues
- many larger Jarvis-level capabilities are still roadmap items, not implemented features
