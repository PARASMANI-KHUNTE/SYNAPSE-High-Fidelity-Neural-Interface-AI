# Data Flow & Sequences

This doc focuses on end-to-end flows across frontend ↔ backend ↔ dependencies.

## Auth: login + socket connect

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant BE as Backend
  participant DB as MongoDB

  U->>FE: Enter email/password
  FE->>BE: POST /api/auth/login
  BE->>DB: users.findOne(email)
  DB-->>BE: user
  BE-->>FE: accessToken + refreshToken
  FE->>BE: Socket.IO connect (token in auth)
  BE-->>FE: connection established (socket.auth populated)
```

## Chat: standard message (streaming)

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant BE as Backend
  participant DB as MongoDB
  participant O as Ollama

  FE->>BE: socket emit chat:message
  BE->>DB: chats.findOne/create + save user message
  BE->>DB: memory_facts upsert + user_profiles sync
  BE->>BE: classifyQuery + resolveModelPreference
  alt RAG enabled
    BE->>BE: getRelevantDocs (FAISS or fallback)
  end
  opt Web search triggered
    BE->>BE: enqueue web-search job
    BE-->>BE: search results returned
  end
  BE->>O: POST /api/chat (stream=true)
  loop stream tokens
    O-->>BE: chunk
    BE-->>FE: chat:reply:chunk
  end
  BE->>DB: chats.save assistant message
  BE->>DB: memory_episodes upsert + background summary refresh
  BE-->>FE: chat:reply:end
```

## Chat: agentic tool turn

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant BE as Backend
  participant DB as MongoDB

  FE->>BE: socket emit chat:message
  BE->>BE: planner.decompose()
  BE-->>FE: agent:thinking + agent:tool:start
  BE->>BE: evaluateToolPolicy()
  alt needs confirmation
    BE-->>FE: agent:confirm:req
    BE-->>FE: chat:reply:end (with message)
  else allowed
    BE->>BE: tool.execute()
    BE->>DB: audit_logs.create (if Mongo connected)
    BE-->>FE: agent:tool:result
    BE-->>FE: chat:reply:chunk + chat:reply:end
  end
```

## Upload: file → context injection

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant BE as Backend
  participant FS as uploads/

  FE->>BE: POST /api/upload (multipart)
  BE->>FS: write file (multer)
  BE-->>FE: { url, mimetype, size }
  FE->>BE: socket emit chat:message (fileUrl + fileType)
  alt audio file
    BE->>BE: transcribeAudio()
    BE->>FS: deleteUploadedFile()
  else pdf file
    BE->>BE: parsePDF() + inject excerpt into prompt
  else image file
    BE->>BE: build image payload (base64) for vision model
  end
```

## Sandbox: run JS (HTTP)

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant BE as Backend
  participant OS as Local runtime
  participant D as Docker (optional)

  FE->>BE: POST /api/sandbox { code, language }
  BE->>BE: sanitizeCode() + write temp file
  alt local mode
    BE->>OS: execFile(node temp.js) with timeout
  else docker mode (prod)
    BE->>D: docker run --network none --read-only ...
  end
  BE-->>FE: stdout/stderr/timedOut
```

## Triggers: scheduler → alert

```mermaid
sequenceDiagram
  participant BE as Backend
  participant T as TriggerScheduler
  participant B as TriggerEventBus

  BE->>T: start()
  BE->>T: scheduleInterval()
  T->>B: emitAlert({type:"scheduled"| "error"})
```

