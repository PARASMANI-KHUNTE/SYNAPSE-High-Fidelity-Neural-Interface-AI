# Security & Safety Design

## Authentication

- JWT access token for REST and socket connections.
- Refresh tokens are hashed and stored in `users.refreshTokenHash`.
- Access token required on:
  - `/api/chat`, `/api/memory`, `/api/upload`, `/api/sandbox`
  - Socket.IO via `requireSocketAuth`

## Rate limiting

HTTP:
- Express route-level limiters in `backend/app.js` for:
  - chat, upload, sandbox, auth, generic

Socket:
- `backend/src/config/socket.js` implements:
  - connections-per-IP throttling
  - events-per-user throttling

## Tool safety (agent tools)

- Tool calls go through:
  1) Registry (`toolRegistry.js`)
  2) Policy evaluation (`toolPolicy.js`)
  3) Executor with audit logging (`toolExecutor.js`)

Policy highlights:
- Denylist terminal keywords (example: `terminal:rm`, `terminal:del`)
- Filesystem writes require confirmation
- Terminal commands are allowlisted; `npm test/build/dev` require confirmation

## Audit logging

- Tool executions write to `audit_logs` when Mongo is connected.
- Logged fields include tool, action, input, output, policy decision, duration, error.

## Network safety

- Browser tool blocks internal and local network hostnames via `isInternalHostname()`.

## Upload safety

- Multer allowlists:
  - file extensions
  - MIME types
- Static serving for `/uploads` applies an extension allowlist gate in `backend/app.js`.

## Sandbox safety

- Sanitization step attempts to neutralize dangerous patterns (process exit, child_process, imports, filesystem, network primitives).
- Enforced controls:
  - max input size
  - max output size
  - timeout
- Optional Docker execution path:
  - `--network none`, `--read-only`, resource limits, optional seccomp profile

