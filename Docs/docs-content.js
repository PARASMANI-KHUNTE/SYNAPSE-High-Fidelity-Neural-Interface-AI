// Synapse Interactive Documentation Data Store
// Code-backed, comprehensive system documentation

window.SYNAPSE_DOCS = {
  meta: {
    title: "SYNAPSE Neural Architecture Documentation",
    version: "2.4.0-local",
    systemDate: "2026-04-16",
    tagline: "Local-First, Multi-Model Neural AI Assistant Platform"
  },

  // Sections navigation hierarchy
  navigation: [
    {
      group: "Architecture & System Design",
      items: [
        { id: "overview", title: "01. Architecture Overview", icon: "cpu", badge: "Core" },
        { id: "tech-stack", title: "02. Tech Stack & Modules", icon: "layers" },
        { id: "hld", title: "03. High-Level Design (HLD)", icon: "box", badge: "C4" },
        { id: "lld-backend", title: "04. Low-Level Backend (LLD)", icon: "server" },
        { id: "lld-frontend", title: "05. Low-Level Frontend (LLD)", icon: "layout" },
        { id: "data-flow", title: "06. Data Flow & Sequences", icon: "git-commit" },
        { id: "data-model", title: "07. Data Models & Schemas", icon: "database" },
        { id: "features", title: "08. Feature Matrix", icon: "check-circle" },
        { id: "security", title: "09. Security & Safety Gates", icon: "shield" },
        { id: "ops-runbook", title: "10. Ops Runbook & Local Run", icon: "terminal" },
        { id: "interfaces", title: "11. REST & Socket Interfaces", icon: "activity", badge: "API" }
      ]
    },
    {
      group: "Interactive Workbenches",
      items: [
        { id: "sim-explorer", title: "Architecture Flow Simulator", icon: "play", badge: "Interactive" },
        { id: "api-playground", title: "API & Socket Playground", icon: "zap", badge: "Live Mock" },
        { id: "qa-bank", title: "Viva & QA Question Bank", icon: "help-circle", badge: "60+ Qs" },
        { id: "presentation", title: "Presentation Stage Mode", icon: "monitor", badge: "Slides" },
        { id: "test-checklist", title: "Testing Verification Suite", icon: "check-square" },
        { id: "roadmap", title: "Evolution Roadmap", icon: "map" }
      ]
    }
  ],

  // System Nodes for the Visual Simulator
  nodes: [
    {
      id: "client",
      name: "React / Vite UI",
      type: "Frontend",
      port: ":5173",
      tech: "React 19 + Framer Motion + TailwindCSS + Socket.IO Client",
      desc: "Mission-control HUD handling streaming token rendering, tool confirmations, audio/image uploads, and memory exploration.",
      files: ["frontend/src/App.jsx", "frontend/src/components/Chat.jsx", "frontend/src/context/SocketContext.jsx"],
      status: "Online",
      metrics: { latency: "< 5ms", protocol: "WebSocket / HTTP" }
    },
    {
      id: "gateway",
      name: "Express Gateway & Sockets",
      type: "Backend Core",
      port: ":5000",
      tech: "Node.js (ESM) + Express 5 + Socket.IO 4 + Helmet",
      desc: "App entrypoint with rate-limiting, JWT authentication, chat pipeline orchestration, event routing, and worker queue dispatcher.",
      files: ["backend/app.js", "backend/src/config/socket.js", "backend/src/sockets/events/chatEvents.js"],
      status: "Active",
      metrics: { latency: "~8ms", protocol: "Event-driven duplex" }
    },
    {
      id: "pipeline",
      name: "Chat & Agent Pipeline",
      type: "Orchestrator",
      port: "Internal",
      tech: "Classifier + Router + Policy Guard + Audit Logger",
      desc: "Determines intent (casual, reasoning, code, vision, agent tool), verifies tool permissions, and assembles multi-turn context.",
      files: ["backend/src/services/chatPipeline.js", "backend/src/services/agent/executor.js", "backend/src/services/agent/policy.js"],
      status: "Guarded",
      metrics: { policy: "Confirmation-gated", isolation: "Worker threads" }
    },
    {
      id: "ollama",
      name: "Ollama Inference Engine",
      type: "Local LLM",
      port: ":11434",
      tech: "Ollama HTTP Daemon (Llama 3, DeepSeek, Llava)",
      desc: "Local-first LLM inference engine streaming chunks via HTTP POST /api/chat. Zero cloud egress for private operations.",
      files: ["backend/src/services/llm.js", "backend/src/config/env.js"],
      status: "Ready",
      metrics: { tokensPerSec: "35-50 t/s", egress: "0 KB (Localhost)" }
    },
    {
      id: "mongodb",
      name: "MongoDB Persistence",
      type: "Database",
      port: ":27017",
      tech: "MongoDB 7.0 + Mongoose ODM",
      desc: "Durable storage for user accounts, chat sessions, extracted memory facts, user profiles, episodic summaries, and audit logs.",
      files: ["backend/src/models/Chat.js", "backend/src/models/MemoryFact.js", "backend/src/models/AuditLog.js"],
      status: "Connected",
      metrics: { poolSize: "10 conn", durability: "ReplSet / Standalone" }
    },
    {
      id: "faiss",
      name: "FAISS Vector Store",
      type: "Vector Memory / RAG",
      port: "Disk FS",
      tech: "FAISS Node + LangChain Ollama Embeddings",
      desc: "High-performance vector search over localized knowledge documents with out-of-domain lexical overlap filtering.",
      files: ["backend/src/services/rag.js", "backend/vectorstore/"],
      status: "Indexed",
      metrics: { dim: "1024-d / 4096-d", searchTime: "< 12ms" }
    },
    {
      id: "tools",
      name: "Sandboxed System Tools",
      type: "Agent Execution",
      port: "Local OS",
      tech: "Git + Filesystem + Terminal + Safe Browser + Whisper",
      desc: "Policy-governed tools with confirmation gates for write actions, sanitized command execution, and internal network blocking.",
      files: ["backend/src/services/agent/tools/fs.js", "backend/src/services/agent/tools/git.js", "backend/src/services/sandbox.js"],
      status: "Constrained",
      metrics: { writeConfirm: "Enforced", networkGate: "SSRF-blocked" }
    }
  ],

  // Interactive REST APIs & Socket events
  apiEndpoints: [
    {
      method: "GET",
      path: "/health",
      type: "REST",
      desc: "Basic liveness probe returning system status, timestamp, and process uptime.",
      request: null,
      response: { status: "ok", uptime: 4281.3, timestamp: "2026-04-16T10:14:22.180Z" }
    },
    {
      method: "GET",
      path: "/metrics",
      type: "REST",
      desc: "Observability probe returning process memory, event-loop stats, active sockets, and queue length.",
      request: null,
      response: {
        memory: { heapUsedMb: 68.4, heapTotalMb: 112.0, rssMb: 142.2 },
        activeSockets: 3,
        queue: { waiting: 0, active: 1, processedTotal: 184 },
        ollamaConnected: true
      }
    },
    {
      method: "POST",
      path: "/api/auth/login",
      type: "REST",
      desc: "Authenticates an operator and returns short-lived access JWT + rotated refresh token.",
      request: { email: "operator@synapse.local", password: "••••••••••••" },
      response: {
        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        refreshToken: "b89f81a179e0a811c7595d2c...",
        user: { id: "usr_99a8b1", email: "operator@synapse.local", role: "admin" }
      }
    },
    {
      method: "POST",
      path: "/api/chat",
      type: "REST (Fallback)",
      desc: "Stateless REST chat execution with RAG retrieval fallback when Socket.IO is disconnected.",
      request: { message: "Summarize the latest memory profile for user", modelPreference: "reasoning" },
      response: {
        reply: "Based on Synapse persistent memory facts, the user prefers TypeScript, local inference with DeepSeek, and strict security gates.",
        chatId: "chat_883fb1",
        model: "deepseek-r1:8b"
      }
    },
    {
      method: "POST",
      path: "/api/sandbox",
      type: "REST",
      desc: "Isolated JavaScript runtime evaluation with code sanitization, timeout ceiling, and capped output buffers.",
      request: { code: "const arr = [1, 2, 3, 4, 5]; arr.reduce((a, b) => a * b, 1);", language: "javascript" },
      response: { output: "120", executionTimeMs: 14, timedOut: false, error: null }
    },
    {
      method: "EMIT",
      path: "chat:message",
      type: "Socket.IO",
      desc: "Primary bidirectional chat initiation event. Triggers contextual routing, memory synthesis, and chunked streaming.",
      request: {
        chatId: "chat_c04918e",
        message: "Check git status and summarize active uncommitted changes",
        modelPreference: "coding",
        voice: false
      },
      response: {
        event: "chat:reply:chunk (streamed) -> chat:reply:end",
        sampleStream: [
          "Inspecting repository git state...",
          " Detected 2 modified files in backend/src/services/agent/.",
          " No merge conflicts detected."
        ]
      }
    },
    {
      method: "EMIT",
      path: "agent:run",
      type: "Socket.IO",
      desc: "Direct invocation of an agent tool. If dangerous action (e.g. disk write), returns confirmation request token.",
      request: { tool: "filesystem:write", params: { path: "src/config.json", content: "{}" }, sessionId: "sess_41" },
      response: {
        status: "CONFIRMATION_REQUIRED",
        confirmationToken: "gate_99fa712ec",
        warning: "Modifying local filesystem requires explicit operator authorization."
      }
    }
  ],

  // Comprehensive QA Bank with category grouping, difficulty, and answers
  qaBank: [
    {
      id: 1,
      category: "Pitch & Vision",
      difficulty: "Foundational",
      vivaScore: 5,
      q: "What is SYNAPSE in one line?",
      a: "SYNAPSE is a local-first AI assistant platform that combines multi-model intelligence, persistent memory, safe tool execution, and real-time interaction in an integrated full-stack architecture.",
      takeaway: "Emphasize local-first + memory + safe tools + full-stack."
    },
    {
      id: 2,
      category: "Pitch & Vision",
      difficulty: "Foundational",
      vivaScore: 5,
      q: "What problem does SYNAPSE solve?",
      a: "It bridges the gap between shallow, ephemeral chatbots and actionable developer assistants by adding persistent memory, policy-gated tool execution, multi-model contextual routing, and proactive triggers—while preserving 100% privacy on local hardware.",
      takeaway: "Solves privacy, lack of actionability, and loss of conversational context."
    },
    {
      id: 3,
      category: "Pitch & Vision",
      difficulty: "Foundational",
      vivaScore: 4,
      q: "What makes SYNAPSE different from ChatGPT or standard LLM wrappers?",
      a: "Standard chatbots are stateless prompt-response wrappers sending data to cloud servers. SYNAPSE runs inference locally through Ollama, maintains a structured two-tier memory hierarchy (facts + episodic summaries in MongoDB), enforces an audit-logged security policy gate for system actions, and features a dual-stream Socket.IO control UI.",
      takeaway: "Local inference + 2-tier memory + policy guard + agentic tooling."
    },
    {
      id: 4,
      category: "Architecture & Systems",
      difficulty: "Advanced",
      vivaScore: 5,
      q: "Explain the backend architectural layers and module boundaries.",
      a: "The backend is structured into seven distinct layers: (1) App & Runtime (Express, Helmet, config, database init), (2) Sockets & Realtime Orchestration (Socket.IO rate limits, streaming event pump), (3) Services (LLM streaming, voice STT/TTS, PDF parsers, search), (4) Agent Layer (intent classifier, planner, tool registry, policy evaluator, audit log), (5) Memory & RAG (fact extractor, user profile sync, episodic summarizer, FAISS vectorstore), (6) Background Work (in-memory async queues for search/indexing and worker threads for CPU tasks), and (7) Triggers & Proactive Engine.",
      takeaway: "Clean separation of responsibilities prevents monolithic controller bloat."
    },
    {
      id: 5,
      category: "Architecture & Systems",
      difficulty: "Advanced",
      vivaScore: 5,
      q: "Why did you choose Socket.IO over standard HTTP streaming (SSE or Chunked REST)?",
      a: "While SSE is unidirectional (server-to-client only), Synapse requires bidirectional real-time communication. Socket.IO allows interactive client interruptions (`chat:stop`), mid-turn tool approval tokens (`agent:confirm`), live suggestion autocompletes, and full state synchronization over a single authenticated WebSocket connection with automatic HTTP fallback.",
      takeaway: "Bi-directional control: streaming out + client interruption and approval tokens coming in."
    },
    {
      id: 6,
      category: "Memory & RAG",
      difficulty: "Core",
      vivaScore: 5,
      q: "How does SYNAPSE handle long-term memory across sessions?",
      a: "SYNAPSE implements a dual-tier memory system: (1) Fact Memory: heuristic and LLM extraction of durable user entities (names, preferences, stack, projects) stored in `memory_facts` and aggregated into a cached `user_profiles` document; (2) Episodic Memory: automatic session summarization stored in `memory_episodes` refreshed in the background. Relevant facts and recent episodic context are dynamically injected into the system prompt for every turn.",
      takeaway: "Fact memory (durable traits) + Episodic memory (chronological summaries)."
    },
    {
      id: 7,
      category: "Memory & RAG",
      difficulty: "Advanced",
      vivaScore: 4,
      q: "How does the RAG pipeline handle Out-of-Domain (OOD) queries?",
      a: "The RAG retriever evaluates FAISS vector cosine similarity alongside lexical keyword overlap. If both scores fall below a calibrated threshold, the query is flagged as out-of-domain and the vector context is omitted, preventing the LLM from hallucinating answers based on irrelevant document chunks.",
      takeaway: "Dual threshold: vector distance + lexical overlap filtering."
    },
    {
      id: 8,
      category: "Agent & Security",
      difficulty: "Critical",
      vivaScore: 5,
      q: "What security measures prevent an LLM agent from running harmful commands?",
      a: "Synapse follows a Defense-in-Depth model: (1) Tool Policy Evaluator gates read-only vs mutating actions; (2) Write operations (filesystem write, terminal npm run, desktop screenshot) require user approval via cryptographic confirmation tokens; (3) Terminal execution uses a strict command allowlist; (4) Web tools prohibit RFC1918 private IPs and localhost to prevent SSRF attacks; (5) Every tool decision is logged with tamper-evident records to MongoDB `audit_logs`.",
      takeaway: "Policy matrix + token confirmation gates + allowlists + SSRF prevention + audit logs."
    },
    {
      id: 9,
      category: "LLM & Routing",
      difficulty: "Core",
      vivaScore: 4,
      q: "How does Synapse select which LLM model to run?",
      a: "Through an automatic intent router: user queries are classified into casual, code, reasoning, or vision categories. If an image is attached, the vision model (e.g. Llava) is automatically prioritized. Users can also manually override preferences in the UI or select custom installed Ollama models.",
      takeaway: "Classifier maps query features to optimized models (coding vs reasoning vs vision)."
    },
    {
      id: 10,
      category: "Operations & DevOps",
      difficulty: "Practical",
      vivaScore: 4,
      q: "What happens if MongoDB or Ollama is offline when Synapse starts?",
      a: "Synapse is built with graceful degradation: If MongoDB is unavailable, it boots with an in-memory session fallback; if Ollama is unreachable, health checks immediately signal degraded status to the UI, and the RAG engine switches to lexical text search over local files rather than crashing the process.",
      takeaway: "Graceful degradation ensures platform uptime and explicit operator feedback."
    }
  ],

  // Presentation slides data with timing and speaker notes
  presentationSlides: [
    {
      num: 1,
      title: "Title & Hook",
      duration: "0:45",
      headline: "SYNAPSE: Local-First Neural Assistant Platform",
      points: [
        "Private, low-latency intelligence directly on developer hardware",
        "Breaks free from ephemeral, cloud-only chatbot limits",
        "Four pillars: Perceive, Reason, Act Safely, Remember"
      ],
      speakerNotes: "Start with high energy. Point out that most AI assistants are cloud-only text generators that forget everything you said yesterday and can't interact with your local development environment safely. Synapse changes that."
    },
    {
      num: 2,
      title: "The Problem Space",
      duration: "1:00",
      headline: "The Gap Between Chatbots and True Assistants",
      points: [
        "Cloud lock-in and intellectual property privacy risks",
        "Stateless interactions: Context resets upon browser refresh",
        "Inability to take real-world system actions or read local code",
        "Uncontrolled automation risks without confirmation gates"
      ],
      speakerNotes: "Highlight developer friction: having to paste confidential proprietary code into third-party cloud servers, and having to manually execute terminal steps because tools lack safety guardrails."
    },
    {
      num: 3,
      title: "System Architecture",
      duration: "1:30",
      headline: "Two-Plane Full-Stack Architecture",
      points: [
        "Interaction Plane: React 19, Socket.IO duplex HUD, Three.js visualization",
        "Execution Plane: Express 5, Ollama inference, FAISS vectorstore, Mongo persistence",
        "Strict module boundaries: Policy gate, Memory engine, Background worker queues"
      ],
      speakerNotes: "Walk through the C4 container design. Emphasize that the backend is layered cleanly into seven modules, making it extensible for new tools, triggers, and inference providers."
    },
    {
      num: 4,
      title: "Dual-Tier Memory & RAG",
      duration: "1:15",
      headline: "How Synapse Remembers Context Across Time",
      points: [
        "Durable Fact Extraction: Automatically builds living user profiles",
        "Episodic Memory: Background summarization of multi-turn sessions",
        "Hybrid RAG: FAISS vectorstore + lexical overlap guard against hallucinations"
      ],
      speakerNotes: "Demonstrate that Synapse recognizes returning users, knows their preferred language, past project paths, and continues previous workflows without requiring repetitive prompting."
    },
    {
      num: 5,
      title: "Safe Agent Execution",
      duration: "1:15",
      headline: "Defense-in-Depth Action Engine",
      points: [
        "Read-only tools run instantly; mutating operations trigger cryptographic confirmation tokens",
        "Strict command allowlists and SSRF protection against intranet exfiltration",
        "Audit trail logged into MongoDB for total post-hoc traceability"
      ],
      speakerNotes: "This is a key differentiator for technical reviews and vivas. Emphasize that we do not let an autonomous agent freely modify files without an explicit approval handshake."
    },
    {
      num: 6,
      title: "Live Demo Highlights & Future Scope",
      duration: "1:00",
      headline: "Current State & Horizon Roadmap",
      points: [
        "Demonstrated: Realtime token stream, Memory profile HUD, Git status tool execution",
        "Roadmap: Multi-agent coordination, local fine-tuning pipeline, cross-device P2P sync",
        "Conclusion: A robust, production-oriented foundation for private AI"
      ],
      speakerNotes: "Close with conviction. Reiterate that Synapse is built today with scalable engineering practices, ready to evolve from an assistant into a proactive autonomous companion."
    }
  ],

  // Testing checklist for verification
  testingSuite: [
    { id: "t1", category: "Auth & Gateways", name: "Operator Registration & Token Refresh", cmd: "POST /api/auth/register", status: "passed", notes: "Returns signed JWT and stores hashed refresh token." },
    { id: "t2", category: "Auth & Gateways", name: "Socket Connection Auth Guard", cmd: "socket.connect({ auth: { token } })", status: "passed", notes: "Rejects unauthenticated socket handshakes with 401." },
    { id: "t3", category: "Chat Pipeline", name: "Streaming Token Reception", cmd: "emit('chat:message')", status: "passed", notes: "Emits sequence of chat:reply:chunk ending in chat:reply:end." },
    { id: "t4", category: "Chat Pipeline", name: "Mid-Stream Interruption (Stop Generation)", cmd: "emit('chat:stop')", status: "passed", notes: "Aborts Ollama fetch stream immediately and saves partial message." },
    { id: "t5", category: "Memory System", name: "Automatic Fact Extraction", cmd: "GET /api/memory/profile", status: "passed", notes: "Heuristic parser updates user_profiles document correctly." },
    { id: "t6", category: "Memory System", name: "Episodic Session Summarization", cmd: "background queue worker", status: "passed", notes: "Generates structured summary upon session completion." },
    { id: "t7", category: "Agent Security", name: "Read-Only Tool Execution (Git Status)", cmd: "emit('agent:run', { tool: 'git:status' })", status: "passed", notes: "Executes without confirmation gate; logs to audit_logs." },
    { id: "t8", category: "Agent Security", name: "Mutating Tool Confirmation Gate (FS Write)", cmd: "emit('agent:run', { tool: 'fs:write' })", status: "passed", notes: "Returns confirmationToken; blocks execution until operator approves." },
    { id: "t9", category: "Agent Security", name: "Network SSRF Prevention", cmd: "emit('agent:run', { tool: 'browser', url: 'http://192.168.1.1' })", status: "passed", notes: "Policy rejects internal/private RFC1918 IP addresses." },
    { id: "t10", category: "RAG & Vectorstore", name: "FAISS Retrieval & OOD Rejection", cmd: "node tests/rag.test.js", status: "passed", notes: "Returns relevant chunks; discards below-threshold noise." }
  ],

  // Roadmap phases
  roadmapPhases: [
    {
      phase: "Phase 0",
      title: "Foundation & Stabilization",
      status: "completed",
      items: ["Centralized Zod environment configuration", "Pino structured logging", "Cleaned socket event listeners", "Express 5 migration"]
    },
    {
      phase: "Phase 1",
      title: "Safe Agent Tooling",
      status: "completed",
      items: ["Tool registry & declarative schema", "Policy evaluation matrix", "Audit logging to MongoDB", "Confirmation tokens for file writes"]
    },
    {
      phase: "Phase 2",
      title: "Dual-Tier Memory & RAG",
      status: "completed",
      items: ["Persistent user profile facts", "Episodic session summarizer", "FAISS vectorstore with lexical fallback", "Memory inspection control HUD"]
    },
    {
      phase: "Phase 3",
      title: "Multimodal & Voice Pipeline",
      status: "completed",
      items: ["Whisper STT integration", "Server-side TTS generation", "PDF parsing & automated report generation", "Vision LLM routing"]
    },
    {
      phase: "Phase 4",
      title: "Proactive Triggers & Background Automations",
      status: "in-progress",
      items: ["In-memory cron scheduler", "File-system watcher alerts", "Scheduled system health digests", "Background knowledge ingestion"]
    },
    {
      phase: "Phase 5",
      title: "Autonomous Swarms & Edge Packaging",
      status: "upcoming",
      items: ["Multi-agent cooperative planner", "Electron / Tauri desktop bundle", "Local model fine-tuning with LoRA", "P2P encrypted workspace sync"]
    }
  ]
};
