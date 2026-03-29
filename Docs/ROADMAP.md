# Synapse Roadmap

## Goal

Turn Synapse into a local-first assistant platform that can perceive, remember, act, and report safely on the user's machine.

## Current Phase Snapshot

Completed or partly completed foundations:

- backend stabilization
- agent tool layer
- safe read-only tools
- planner-based chat routing
- persistent fact and episodic memory
- daily memory consolidation
- trigger registry and scheduler
- file-trigger alerts
- system awareness UI
- browser page reading

## Roadmap by Phase

### Phase 0. Foundation and Stabilization

Status: largely completed

Scope:

- config centralization
- structured logging
- STT ownership cleanup
- thinner socket orchestration
- chat pipeline extraction

### Phase 1. Safe Agent Tooling

Status: completed first slice

Scope completed:

- tool registry
- tool policy
- audit logging
- safe read-only tools

Remaining:

- stronger validation schemas
- better confirmation UX
- richer tool metadata

### Phase 2. Memory Foundation

Status: active foundation completed

Scope completed:

- memory facts
- user profile sync
- episodic memory
- memory routing into prompts

Remaining:

- editable memory viewer
- memory correction workflow
- stronger ranking and pruning strategy

### Phase 3. Proactive Engine

Status: started

Scope completed:

- trigger persistence
- scheduler
- daily consolidation
- file watcher alerts

Remaining:

- clipboard triggers
- system threshold triggers
- custom trigger creation UI
- notification prioritization

### Phase 4. Machine and Repo Awareness

Status: started

Scope completed:

- system status API
- system panel
- process tool
- git awareness

Remaining:

- process list snapshots
- repo diff awareness in context
- smarter developer-state injection

### Phase 5. Browser Capability

Status: started with safe read-only slice

Scope completed:

- page fetch and readable text extraction

Remaining:

- multi-step browsing
- DOM interaction
- authenticated sessions
- confirmation gates for submissions and mutations

### Phase 6. Perception Layer

Status: not started

Target scope:

- screenshot capture
- screen analysis
- webcam capture
- optional emotion or fatigue cues

### Phase 7. OS Hooks and Desktop Automation

Status: not started

Target scope:

- clipboard hooks
- notifications
- keyboard and mouse automation
- app/window awareness

### Phase 8. Interface Upgrade

Status: partially started

Scope completed:

- debug/control panels
- memory panel
- trigger panel
- system panel

Remaining:

- Command Orb
- Thinking Panel
- Report Card
- Tool Feed
- Status Ring
- full HUD layout

### Phase 9. Multi-Agent Delegation

Status: not started

Target scope:

- planner agent
- researcher agent
- executor agent
- summarizer agent

### Phase 10. Trust and Operator Controls

Status: not started

Target scope:

- permission dashboard
- secrets manager
- per-tool controls
- action history viewer
- persona configuration

## Recommended Next Build Order

1. screenshot capture tool
2. clipboard and system event hooks
3. safer active terminal/filesystem actions with confirmation
4. trigger authoring UI and APIs
5. HUD replacement for remaining chat-first surfaces

## Risks to Watch

- adding write-capable tools before confirmation UX is solid
- overloading `chatEvents.js` again with new logic
- mixing document RAG and personal memory too loosely
- adding perception features before safety and observability are strong enough

## Practical Success Criteria

The next meaningful checkpoint should prove all of these:

- Synapse can observe part of the desktop
- Synapse can notice at least one OS-level event without a prompt
- Synapse can ask for confirmation before a higher-risk action
- Synapse can surface actions and alerts in a more mission-control style UI
