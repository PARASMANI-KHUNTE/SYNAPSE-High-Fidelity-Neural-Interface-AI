# Interfaces (REST + Socket.IO)

This is the “how to talk to Synapse” reference for **implemented** interfaces in this repo.

## REST (Express)

### Health / meta

- `GET /health` → `{ status, uptime }`
- `GET /metrics` → process memory + socket count + queue metrics
- `GET /api/config` → `{ operatorName, ollamaModel, version, models }`

### Auth (`/api/auth`)

- `POST /api/auth/register` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/login` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` → `{ accessToken, refreshToken }`
- `POST /api/auth/logout` → `204`
- `GET /api/auth/me` → `{ user }`

Auth headers:
- `Authorization: Bearer <accessToken>`

### Chat REST fallback (`/api/chat`)

- `POST /api/chat` → `{ reply, chatId, model }`

### Memory (`/api/memory`)

- `GET /api/memory/profile` → `{ profile, facts, episodes }`

### Upload (`/api/upload`)

- `POST /api/upload` (multipart `file`) → `{ url, filename, mimetype, size }`

### Sandbox (`/api/sandbox`)

- `POST /api/sandbox` JSON `{ code, language }` → `{ output, error, timedOut, mode? }`

## Socket.IO events

### Client → Server

Chat/session:
- `chat:list` → lists chat sessions for authenticated user
- `chat:history` `{ chatId }` → gets message history for a session
- `chat:delete` `{ chatId }` → deletes a session
- `chat:message` `{ chatId?, message?, voice?, fileUrl?, fileType?, images?, modelPreference?, customModel? }`
- `chat:stop` → aborts streaming generation
- `chat:feedback` `{ chatId, messageId, feedback }`
- `chat:suggest` `{ input }`

Agent:
- `agent:tools:list`
- `agent:run` `{ tool, params, sessionId }`
- `agent:confirm` `{ token }`
- `agent:cancel` `{ token }`

Socket auth:
- connect with `handshake.auth.token` (Bearer token or raw token)

### Server → Client

Chat/session replies:
- `chat:list:reply` `{ chats }`
- `chat:history:reply` `{ messages }`
- `chat:deleted` `{ chatId }`
- `chat:created` `{ chatId, title }`
- `chat:error` `{ message }`
- `chat:stopped`
- `chat:suggestion` `{ suggestion }`

Streaming reply lifecycle:
- `chat:reply:start`
- `chat:reply:chunk` `{ chunk }`
- `chat:reply:end`

Attachments:
- `chat:reply:file` `{ type, url, name }` (e.g., screenshot image, generated PDF)

Agent events:
- `agent:thinking` `{ runId, step, message }`
- `agent:tool:start` `{ runId, tool, params }`
- `agent:tool:result` `{ runId, tool, output, duration? }`
- `agent:tool:error` `{ runId?, tool, error }`
- `agent:confirm:req` `{ runId, token?, tool, params, risk }`
- `agent:done` `{ runId?, success, tool?, result?, error? }`
- `agent:tools:list:reply` `{ tools }`

