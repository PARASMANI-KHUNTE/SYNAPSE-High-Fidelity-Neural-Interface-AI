# Data Model (MongoDB)

This section is derived from `backend/src/models/*` Mongoose schemas.

## `users` (`backend/src/models/User.js`)

Fields:
- `email` (unique, indexed)
- `passwordHash`
- `displayName`
- `role` (`user|admin`)
- `refreshTokenHash`
- timestamps: `createdAt`, `updatedAt`

## `chats` (`backend/src/models/Chat.js`)

Chat fields:
- `userId` (indexed)
- `title`
- `messages[]`
- timestamps

Message fields:
- `role` (`user|assistant|system`)
- `content`
- `imageUrls[]`
- `audioUrl`
- `feedback` (`positive|negative|null`)
- `timestamp` (indexed)

Indexes:
- `updatedAt` descending
- compound: `{ userId, updatedAt }`

## `memory_facts` (`backend/src/models/MemoryFact.js`)

Fields:
- `userId` (indexed)
- `key`
- `value`
- `confidence` (0..1)
- `source` (`user_stated|inferred|observed`)
- `sessionId`
- `timestamp` (indexed)
- `active` (boolean)

Index:
- `{ userId, key, active, timestamp }`

## `user_profiles` (`backend/src/models/UserProfile.js`)

Fields:
- `userId` (unique, indexed)
- `name`
- `preferences`:
  - `responseStyle`
  - `voice`
  - `wakeWord`
- `facts[]` (embedded)
- `routines[]` (embedded)
- timestamps

## `memory_episodes` (`backend/src/models/MemoryEpisode.js`)

Fields:
- `userId` (indexed)
- `date` (indexed)
- `sessionIds[]`
- `kind` (`session|daily`)
- `label`
- `summary`
- `topics[]`
- `decisions[]`
- `actions[]`
- `embedding[]` (number array; currently optional/empty)
- timestamps

Index:
- `{ userId, date, kind }`

## `audit_logs` (`backend/src/models/AuditLog.js`)

Fields:
- `timestamp` (indexed)
- `sessionId` (indexed)
- `userId` (indexed)
- `tool`
- `action`
- `input` (mixed)
- `output` (mixed)
- `policyDecision` (`allowed|denied|confirmed`)
- `durationMs`
- `error` (string)

Indexes:
- `{ tool, timestamp }`
- `{ userId, timestamp }`

