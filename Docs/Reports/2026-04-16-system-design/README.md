# Synapse System Design Report (2026-04-16)

This folder is a generated, code-backed system-design report for the Synapse repository as of **2026-04-16**.

If you want the most compact “single doc” view first, start with:
- `01-architecture.md`
- `03-hld.md`
- `06-data-flow.md`

## Contents

- `01-architecture.md` — Architecture overview (what exists, how it fits together)
- `02-tech-stack.md` — Tech stack, libraries, runtimes, tooling
- `03-hld.md` — High-level design (C4-style diagrams, NFRs, deployment)
- `04-lld-backend.md` — Low-level design: backend modules, APIs, sockets, internals
- `05-lld-frontend.md` — Low-level design: frontend modules, components, state flows
- `06-data-flow.md` — End-to-end data-flow and sequence diagrams
- `07-data-model.md` — MongoDB collections & key fields (from Mongoose models)
- `08-features.md` — Feature inventory (user-facing + platform capabilities)
- `09-security-safety.md` — Auth, sandboxing, tool policy, network safety
- `10-ops-runbook.md` — Setup, env vars, local run, tests, troubleshooting

## Sources in this repo (primary)

- `SYNAPSE_REFERENCE.md` (high-level reference + event tables)
- `Docs/ARCHITECTURE.md` (architecture shape and intended layering)
- Backend entry: `backend/app.js`
- Backend config: `backend/src/config/env.js`
- Frontend entry: `frontend/src/App.jsx`

