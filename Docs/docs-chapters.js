// Synapse Detailed Chapters Data
window.SYNAPSE_CHAPTERS = {
  "overview": {
    title: "Architecture Overview",
    subtitle: "High-level topology, repository boundaries, and multi-layer orchestration",
    readTime: "4 min read",
    badge: "Core Architecture",
    content: `
      <div class="doc-card highlight-card">
        <div class="card-glow"></div>
        <h3>🧠 What is Synapse?</h3>
        <p>Synapse is a <strong>local-first, multi-model AI assistant platform</strong> designed to execute directly on the operator's machine. It bridges the gap between passive chatbots and proactive software companions by uniting real-time streaming, persistent dual-tier memory, and policy-guarded agent execution.</p>
        <div class="stats-grid">
          <div class="stat-badge"><span class="stat-num">100%</span><span class="stat-label">Local Data Privacy</span></div>
          <div class="stat-badge"><span class="stat-num">7</span><span class="stat-label">Backend Subsystems</span></div>
          <div class="stat-badge"><span class="stat-num">5</span><span class="stat-label">Guarded Tools</span></div>
          <div class="stat-badge"><span class="stat-num">&lt;10ms</span><span class="stat-label">Socket Event Latency</span></div>
        </div>
      </div>

      <h2>Core Capabilities at a Glance</h2>
      <div class="feature-grid">
        <div class="feature-box">
          <div class="icon-wrap"><svg class="icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
          <h4>Chat Orchestration</h4>
          <p>Real-time streaming via Socket.IO, multi-modal attachments (images, PDFs, audio), and automatic model preference routing.</p>
        </div>
        <div class="feature-box">
          <div class="icon-wrap"><svg class="icon" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></div>
          <h4>Policy-Gated Agent</h4>
          <p>Read-only tools execute instantly, while write and destructive operations require operator confirmation tokens.</p>
        </div>
        <div class="feature-box">
          <div class="icon-wrap"><svg class="icon" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <h4>Dual-Tier Memory</h4>
          <p>Durable fact extraction merged into living user profiles, combined with background episodic summarization in MongoDB.</p>
        </div>
        <div class="feature-box">
          <div class="icon-wrap"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg></div>
          <h4>Hybrid RAG & Vectorstore</h4>
          <p>FAISS on-disk vector index backed by LangChain embeddings, paired with lexical overlap filtering to eliminate hallucinations.</p>
        </div>
      </div>

      <h2>Repository Structural Layout</h2>
      <div class="code-preview-block">
        <div class="code-header">
          <span class="file-name">Synapse Workspace Hierarchy</span>
          <button class="copy-btn" onclick="copySnippet(this, 'repo-tree')">Copy Tree</button>
        </div>
        <pre><code id="repo-tree">Synapse/
├── backend/          # Node.js (ESM) + Express 5 + Socket.IO + MongoDB
│   ├── app.js        # Main server entry & middleware pipeline
│   ├── src/
│   │   ├── config/   # Zod environment schemas, DB, Socket configs
│   │   ├── models/   # Mongoose schemas (User, Chat, Memory, Audit)
│   │   ├── routes/   # REST fallback & auth endpoints
│   │   ├── services/ # LLM, Voice, RAG, Agent Executor & Policy
│   │   └── sockets/  # Realtime Socket.IO event handlers
├── frontend/         # React 19 + Vite + TailwindCSS + Three.js HUD
│   ├── src/
│   │   ├── App.jsx   # Client orchestrator & token state
│   │   ├── components/ # ChatWindow, MemoryPanel, AgentConsole
│   │   └── context/  # SocketContext & AuthContext
├── Docs/             # Comprehensive architectural reports & guides
├── cli/              # Command-line execution entrypoints
└── desktop/          # Future Electron/Tauri desktop wrapper</code></pre>
      </div>

      <h2>Backend Layered Architecture</h2>
      <div class="interactive-steps">
        <div class="step-card">
          <div class="step-number">1</div>
          <div class="step-body">
            <h4>App & Runtime</h4>
            <p>Handles Express 5 initialization, rate-limiting per route group, Helmet security headers, compression, static asset serving, and graceful teardown.</p>
          </div>
        </div>
        <div class="step-card">
          <div class="step-number">2</div>
          <div class="step-body">
            <h4>Socket Orchestration</h4>
            <p>Manages authenticated WebSocket connections, event rate-limits per IP/user, chunked streaming pipelines, and mid-stream cancellation signals.</p>
          </div>
        </div>
        <div class="step-card">
          <div class="step-number">3</div>
          <div class="step-body">
            <h4>Services & Routing</h4>
            <p>Classifies queries into casual, reasoning, coding, or vision models. Coordinates Whisper STT, Python-backed TTS, and PDF parsing.</p>
          </div>
        </div>
        <div class="step-card">
          <div class="step-number">4</div>
          <div class="step-body">
            <h4>Agent & Policy Engine</h4>
            <p>Evaluates requested tool actions against safety rules. Generates cryptographic approval tokens for write actions and writes immutable audit logs.</p>
          </div>
        </div>
        <div class="step-card">
          <div class="step-number">5</div>
          <div class="step-body">
            <h4>Memory & Vector RAG</h4>
            <p>Maintains persistent user profile facts, creates background episodic session summaries, and conducts FAISS similarity searches.</p>
          </div>
        </div>
      </div>
    `
  },

  "tech-stack": {
    title: "Tech Stack & Runtime Dependencies",
    subtitle: "Runtimes, libraries, inference bridges, and persistence engines",
    readTime: "3 min read",
    badge: "Stack Specs",
    content: `
      <div class="stack-table-container">
        <table class="synapse-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Technology</th>
              <th>Version / Spec</th>
              <th>Role in Synapse</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="tag tag-be">Backend</span></td>
              <td><strong>Node.js</strong></td>
              <td>v20+ (ES Modules)</td>
              <td>Core server runtime with native async/await and ESM imports</td>
            </tr>
            <tr>
              <td><span class="tag tag-be">Backend</span></td>
              <td><strong>Express</strong></td>
              <td>v5.0.0</td>
              <td>HTTP REST API routing, middleware, rate-limiting</td>
            </tr>
            <tr>
              <td><span class="tag tag-be">Backend</span></td>
              <td><strong>Socket.IO</strong></td>
              <td>v4.8.1</td>
              <td>Bidirectional realtime transport for token streaming and tool approvals</td>
            </tr>
            <tr>
              <td><span class="tag tag-db">Database</span></td>
              <td><strong>MongoDB & Mongoose</strong></td>
              <td>v7.0 / v8.x ODM</td>
              <td>Document storage for accounts, chats, memory facts, and audit logs</td>
            </tr>
            <tr>
              <td><span class="tag tag-ai">Inference</span></td>
              <td><strong>Ollama HTTP Daemon</strong></td>
              <td>Localhost :11434</td>
              <td>Local model execution (Llama 3, DeepSeek, Llava) with zero cloud egress</td>
            </tr>
            <tr>
              <td><span class="tag tag-ai">RAG</span></td>
              <td><strong>FAISS + LangChain</strong></td>
              <td>faiss-node / @langchain</td>
              <td>On-disk vectorstore indexing with Ollama embeddings</td>
            </tr>
            <tr>
              <td><span class="tag tag-fe">Frontend</span></td>
              <td><strong>React + Vite</strong></td>
              <td>React 19 / Vite 6</td>
              <td>High-performance UI rendering with sub-second HMR</td>
            </tr>
            <tr>
              <td><span class="tag tag-fe">Styling</span></td>
              <td><strong>TailwindCSS + Framer Motion</strong></td>
              <td>Tailwind 4 + Motion</td>
              <td>Hardware-accelerated reactive animations and dark mode theme</td>
            </tr>
            <tr>
              <td><span class="tag tag-multimodal">Media</span></td>
              <td><strong>Whisper + PDFKit</strong></td>
              <td>whisper-node / pdfkit</td>
              <td>Audio speech-to-text transcription and programmatic PDF reports</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Concurrency & Heavy Work Isolation</h2>
      <div class="interactive-callout">
        <div class="callout-icon">⚡</div>
        <div class="callout-body">
          <h4>Worker Threads & Queue Architecture</h4>
          <p>Synapse ensures high responsiveness by preventing CPU-intensive operations from blocking the Node.js event loop:</p>
          <ul>
            <li><strong>p-queue</strong> throttles local inference calls so Ollama GPU/CPU limits are never overwhelmed.</li>
            <li><strong>Worker Threads (heavyTasks.js)</strong> isolates lexical vector crunching and heavy string matching from the main server process.</li>
            <li><strong>simpleQueue.js</strong> manages asynchronous background jobs for web searches and image reference queries.</li>
          </ul>
        </div>
      </div>
    `
  },

  "hld": {
    title: "High-Level Design (HLD & C4)",
    subtitle: "System Context, Container Architecture, and Component Responsibilities",
    readTime: "5 min read",
    badge: "C4 Architecture",
    content: `
      <h2>System Context (C4 Level 1)</h2>
      <p>The following diagram depicts the operational boundaries of the Synapse platform with its internal and external actors:</p>

      <div class="diagram-canvas-box">
        <div class="diagram-svg-wrap">
          <svg viewBox="0 0 800 360" class="responsive-svg">
            <defs>
              <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.9"/>
                <stop offset="100%" stop-color="#4facfe" stop-opacity="0.9"/>
              </linearGradient>
              <linearGradient id="purpleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#7928ca" stop-opacity="0.9"/>
                <stop offset="100%" stop-color="#ff0080" stop-opacity="0.9"/>
              </linearGradient>
              <linearGradient id="emeraldGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0.9"/>
                <stop offset="100%" stop-color="#059669" stop-opacity="0.9"/>
              </linearGradient>
              <filter id="neonFilter">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <!-- User -->
            <rect x="40" y="140" width="130" height="80" rx="12" fill="#161e2e" stroke="#00f2fe" stroke-width="2"/>
            <text x="105" y="175" fill="#ffffff" font-weight="bold" text-anchor="middle" font-size="14">Developer / User</text>
            <text x="105" y="195" fill="#94a3b8" text-anchor="middle" font-size="11">Browser Session</text>

            <!-- Line User -> UI -->
            <path d="M 170 180 L 230 180" stroke="#00f2fe" stroke-width="2" marker-end="url(#arrow)" stroke-dasharray="4 2"/>

            <!-- Frontend UI -->
            <rect x="230" y="120" width="160" height="120" rx="14" fill="#1a1c35" stroke="#7928ca" stroke-width="2"/>
            <text x="310" y="160" fill="#ffffff" font-weight="bold" text-anchor="middle" font-size="15">Synapse UI HUD</text>
            <text x="310" y="180" fill="#a78bfa" text-anchor="middle" font-size="11">React 19 + Vite</text>
            <text x="310" y="205" fill="#64748b" text-anchor="middle" font-size="10">Streaming & Controls</text>

            <!-- Line UI -> Backend -->
            <path d="M 390 180 L 460 180" stroke="#00f2fe" stroke-width="2" stroke-dasharray="4 2"/>
            <text x="425" y="170" fill="#00f2fe" font-size="9" text-anchor="middle">Socket / REST</text>

            <!-- Backend -->
            <rect x="460" y="80" width="170" height="200" rx="16" fill="#131e33" stroke="#00f2fe" stroke-width="2.5" filter="url(#neonFilter)"/>
            <text x="545" y="120" fill="#ffffff" font-weight="bold" text-anchor="middle" font-size="16">Synapse Backend</text>
            <text x="545" y="140" fill="#38bdf8" text-anchor="middle" font-size="11">Express 5 + Socket.IO</text>
            <text x="545" y="170" fill="#94a3b8" text-anchor="middle" font-size="11">Pipeline Orchestrator</text>
            <text x="545" y="195" fill="#94a3b8" text-anchor="middle" font-size="11">Policy & Tool Gates</text>
            <text x="545" y="220" fill="#94a3b8" text-anchor="middle" font-size="11">Memory & RAG Services</text>

            <!-- Mongo DB -->
            <path d="M 630 130 L 690 90" stroke="#10b981" stroke-width="2"/>
            <rect x="690" y="50" width="90" height="65" rx="8" fill="#132a22" stroke="#10b981" stroke-width="1.5"/>
            <text x="735" y="80" fill="#34d399" font-weight="bold" text-anchor="middle" font-size="12">MongoDB</text>
            <text x="735" y="98" fill="#6ee7b7" text-anchor="middle" font-size="10">Durable State</text>

            <!-- Ollama -->
            <path d="M 630 180 L 690 180" stroke="#f59e0b" stroke-width="2"/>
            <rect x="690" y="150" width="90" height="65" rx="8" fill="#2d2212" stroke="#f59e0b" stroke-width="1.5"/>
            <text x="735" y="180" fill="#fbbf24" font-weight="bold" text-anchor="middle" font-size="12">Ollama</text>
            <text x="735" y="198" fill="#fde68a" text-anchor="middle" font-size="10">Local Inference</text>

            <!-- FAISS / Disk -->
            <path d="M 630 230 L 690 270" stroke="#8b5cf6" stroke-width="2"/>
            <rect x="690" y="245" width="90" height="65" rx="8" fill="#24143a" stroke="#8b5cf6" stroke-width="1.5"/>
            <text x="735" y="275" fill="#c084fc" font-weight="bold" text-anchor="middle" font-size="12">FAISS Disk</text>
            <text x="735" y="293" fill="#e9d5ff" text-anchor="middle" font-size="10">Vector Index</text>
          </svg>
        </div>
      </div>

      <h2>Container Responsibilities (C4 Level 2)</h2>
      <div class="comparison-cards">
        <div class="c-card">
          <div class="c-header"><span class="badge badge-purple">Frontend Container</span></div>
          <h4>Vite + React Single-Page Application</h4>
          <ul>
            <li>Manages local JWT auth persistence and silent token rotation</li>
            <li>Maintains duplex Socket.IO connection with buffered token flushing</li>
            <li>Renders mission-control panels: Chat, Memory Profile, Agent Console, and JS Sandbox</li>
            <li>Emits interruption signals (<code>chat:stop</code>) and interactive tool approvals</li>
          </ul>
        </div>
        <div class="c-card">
          <div class="c-header"><span class="badge badge-cyan">Backend Container</span></div>
          <h4>Node.js Express + Socket Server</h4>
          <ul>
            <li>Enforces JWT validation across REST routes and WebSocket handshakes</li>
            <li>Orchestrates chat pipeline: normalizes input, picks models, retrieves RAG context</li>
            <li>Gated agent executor: evaluates policy, triggers confirmation tokens, logs audits</li>
            <li>Upload security: extension allowlists and sanitized path access</li>
          </ul>
        </div>
      </div>
    `
  },

  "lld-backend": {
    title: "Low-Level Design (LLD) — Backend",
    subtitle: "In-depth breakdown of server startup, pipelines, tool policy, and memory",
    readTime: "6 min read",
    badge: "Backend Deep Dive",
    content: `
      <h2>Server Bootstrap & Middleware Stack</h2>
      <p>The backend server initialization in <code>backend/app.js</code> adheres to a strictly ordered middleware pipeline:</p>

      <div class="pipeline-flow">
        <div class="pipe-node">
          <div class="pipe-title">1. Security Layer</div>
          <div class="pipe-desc">Helmet security headers, strict CORS validation, response compression, and JSON body parsing with bounded limits.</div>
        </div>
        <div class="pipe-node">
          <div class="pipe-title">2. Rate Limiting</div>
          <div class="pipe-desc">Separate memory buckets for chat, authentication, uploads, and sandboxed code execution to guard against DoS.</div>
        </div>
        <div class="pipe-node">
          <div class="pipe-title">3. REST Routing</div>
          <div class="pipe-desc">Mounts <code>/api/auth</code>, <code>/api/chat</code>, <code>/api/memory</code>, <code>/api/upload</code>, <code>/api/sandbox</code>, and <code>/metrics</code>.</div>
        </div>
        <div class="pipe-node">
          <div class="pipe-title">4. Socket.IO Binding</div>
          <div class="pipe-desc">Attaches the WebSocket server to the HTTP instance, registering connection throttling and token auth middlewares.</div>
        </div>
      </div>

      <h2>Agent Execution Pipeline & Policy Gate</h2>
      <div class="doc-card">
        <h3>How Agent Tool Safety is Enforced</h3>
        <p>When natural language indicates an actionable system task, execution flows through the guarded agent engine:</p>
        <pre><code class="language-javascript">// Conceptual Flow from backend/src/services/agent/
1. User Intent -> Intent Classifier detects tool requirement
2. Planner identifies tool: { tool: "fs:write", params: { path: "...", content: "..." } }
3. toolPolicy.evaluate(tool, params):
   - If action == "read" -> Allowed immediately
   - If action == "write" / "destroy" -> Blocked! Generate confirmationToken
4. If token required:
   - Emit 'agent:confirmation_request' to UI with token
   - Pause execution until 'agent:confirm' is received
5. Execute under isolated try-catch with timeout
6. Log execution params and result to MongoDB 'audit_logs'</code></pre>
      </div>

      <h2>Memory Persistence Architecture</h2>
      <p>The memory engine operates simultaneously on two distinct time horizons:</p>
      <div class="feature-grid">
        <div class="feature-box">
          <h4>Fact Memory (Heuristic & Stated)</h4>
          <p>Extracts user name, preferences, project dependencies, and tech stack from conversation turns. Stores active facts in <code>memory_facts</code> and consolidates them into <code>user_profiles</code>.</p>
        </div>
        <div class="feature-box">
          <h4>Episodic Memory (Session Context)</h4>
          <p>Upon conversation completion, generates structured episodic summaries stored in <code>memory_episodes</code>. Injected into prompts to maintain context across days or weeks.</p>
        </div>
      </div>
    `
  },

  "lld-frontend": {
    title: "Low-Level Design (LLD) — Frontend",
    subtitle: "React application lifecycle, streaming buffers, and mission control panels",
    readTime: "4 min read",
    badge: "Frontend Deep Dive",
    content: `
      <h2>React Runtime Architecture</h2>
      <p>The frontend is designed as a mission-control HUD with sub-millisecond responsiveness, managed in <code>frontend/src/App.jsx</code>:</p>

      <div class="component-hierarchy">
        <div class="comp-box">
          <div class="comp-tag">Context</div>
          <h4>SocketContext & AuthContext</h4>
          <p>Stores JWT tokens in localStorage, automatically performs refresh calls on 401s, and handles connection state transitions (Connected, Connecting, Offline).</p>
        </div>
        <div class="comp-box">
          <div class="comp-tag">Core UI</div>
          <h4>ChatWindow & Stream Buffer</h4>
          <p>Renders conversation threads with markdown formatting, syntax highlighting, and audio playback. Buffers incoming stream chunks to avoid frame drops.</p>
        </div>
        <div class="comp-box">
          <div class="comp-tag">Controls</div>
          <h4>Sidebar & Layout Switcher</h4>
          <p>Provides session switching, layout presets (Focus, Developer, Mission Control), and memory preview panels.</p>
        </div>
        <div class="comp-box">
          <div class="comp-tag">Panels</div>
          <h4>Agent Console & JS Sandbox</h4>
          <p>Interactive tool execution dashboard, tool approval prompts, and sandboxed code execution testing environment.</p>
        </div>
      </div>

      <h2>Stream Token Flush Buffer Mechanism</h2>
      <div class="code-preview-block">
        <div class="code-header">
          <span class="file-name">Buffered Token Rendering Pattern</span>
        </div>
        <pre><code class="language-javascript">// Avoids re-rendering the full virtual DOM on every tiny LLM chunk:
let tokenQueue = [];
let flushInterval = setInterval(() => {
  if (tokenQueue.length > 0) {
    const chunk = tokenQueue.join("");
    tokenQueue = [];
    setCurrentMessage(prev => prev + chunk);
  }
}, STREAM_CHUNK_FLUSH_MS); // 25-50ms optimal cadence</code></pre>
      </div>
    `
  },

  "data-flow": {
    title: "Data Flow & Sequence Flows",
    subtitle: "End-to-end event lifecycles across client, sockets, LLM, and storage",
    readTime: "5 min read",
    badge: "Sequences",
    content: `
      <h2>1. Realtime Chat Streaming Lifecycle</h2>
      <div class="sequence-box">
        <div class="seq-step">
          <span class="seq-num">1</span>
          <span class="seq-actor">Frontend</span>
          <span class="seq-action">Emits <code>chat:message</code> with text, optional attachments, and model choice.</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">2</span>
          <span class="seq-actor">Backend</span>
          <span class="seq-action">Saves user message to MongoDB, queries active memory facts, and retrieves RAG chunks.</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">3</span>
          <span class="seq-actor">Ollama</span>
          <span class="seq-action">Receives assembled prompt via HTTP POST <code>/api/chat</code> with <code>stream=true</code>.</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">4</span>
          <span class="seq-actor">Sockets</span>
          <span class="seq-action">Streams <code>chat:reply:chunk</code> events to the browser at 30-50 tokens/sec.</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">5</span>
          <span class="seq-actor">Persistence</span>
          <span class="seq-action">Saves assistant message, updates episodic memory, and emits <code>chat:reply:end</code>.</span>
        </div>
      </div>

      <h2>2. Agent Tool Confirmation Flow</h2>
      <div class="sequence-box">
        <div class="seq-step">
          <span class="seq-num">1</span>
          <span class="seq-actor">User Message</span>
          <span class="seq-action">"Update database config with new replica set URL."</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">2</span>
          <span class="seq-actor">Policy Gate</span>
          <span class="seq-action">Filesystem write detected! Blocks execution and generates <code>confirmationToken</code>.</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">3</span>
          <span class="seq-actor">UI Prompt</span>
          <span class="seq-action">Operator sees: "Authorise modification to config.js? [Approve] / [Reject]".</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">4</span>
          <span class="seq-actor">Confirmation</span>
          <span class="seq-action">Operator clicks Approve -> emits <code>agent:confirm</code> with signed token.</span>
        </div>
        <div class="seq-step">
          <span class="seq-num">5</span>
          <span class="seq-actor">Audit Log</span>
          <span class="seq-action">Tool executes safely; parameters, duration, and operator identity logged to <code>audit_logs</code>.</span>
        </div>
      </div>
    `
  },

  "data-model": {
    title: "Data Models & MongoDB Schemas",
    subtitle: "Mongoose schema definitions, field indexes, and persistent relationships",
    readTime: "4 min read",
    badge: "Database",
    content: `
      <h2>Persistent Collections Overview</h2>
      <div class="schema-grid">
        <div class="schema-card">
          <div class="schema-header">
            <h4>users</h4>
            <span class="badge">Identity</span>
          </div>
          <ul>
            <li><code>email</code> (unique string, indexed)</li>
            <li><code>passwordHash</code> (bcrypt hash)</li>
            <li><code>displayName</code> (string)</li>
            <li><code>role</code> ('user' | 'admin')</li>
            <li><code>refreshTokenHash</code> (sha256 token hash)</li>
          </ul>
        </div>
        <div class="schema-card">
          <div class="schema-header">
            <h4>chats</h4>
            <span class="badge">Conversations</span>
          </div>
          <ul>
            <li><code>userId</code> (ObjectId, indexed)</li>
            <li><code>title</code> (session title)</li>
            <li><code>messages[]</code>:
              <br/>• <code>role</code> ('user' | 'assistant' | 'system')
              <br/>• <code>content</code> (string)
              <br/>• <code>imageUrls[]</code> / <code>audioUrl</code>
              <br/>• <code>feedback</code> ('positive' | 'negative')
            </li>
          </ul>
        </div>
        <div class="schema-card">
          <div class="schema-header">
            <h4>memory_facts</h4>
            <span class="badge">Knowledge</span>
          </div>
          <ul>
            <li><code>userId</code> (ObjectId, indexed)</li>
            <li><code>key</code> & <code>value</code> (string)</li>
            <li><code>confidence</code> (0.0 to 1.0)</li>
            <li><code>source</code> ('user_stated' | 'inferred')</li>
            <li><code>active</code> (boolean flag)</li>
          </ul>
        </div>
        <div class="schema-card">
          <div class="schema-header">
            <h4>audit_logs</h4>
            <span class="badge">Security</span>
          </div>
          <ul>
            <li><code>userId</code> (ObjectId)</li>
            <li><code>tool</code> & <code>action</code> (string)</li>
            <li><code>inputParams</code> (object)</li>
            <li><code>policyDecision</code> ('allowed' | 'gated')</li>
            <li><code>executionTimeMs</code> (number)</li>
          </ul>
        </div>
      </div>
    `
  },

  "features": {
    title: "Feature Matrix & Capabilities",
    subtitle: "Full inventory of platform features, agent capabilities, and modalities",
    readTime: "3 min read",
    badge: "Features",
    content: `
      <div class="feature-matrix">
        <div class="matrix-col">
          <h3>Core Conversational Engine</h3>
          <ul class="check-list">
            <li>Multi-session persistent chat management</li>
            <li>Streaming responses with low-latency token chunking</li>
            <li>Intent-based model routing (Casual, Reasoning, Coding, Vision)</li>
            <li>Realtime prompt autocompletion & query suggestions</li>
            <li>Message quality feedback rating (thumbs up / down)</li>
          </ul>
        </div>
        <div class="matrix-col">
          <h3>Memory & Contextual Intelligence</h3>
          <ul class="check-list">
            <li>Automatic extraction of durable user facts & preferences</li>
            <li>Living user profile synthesis</li>
            <li>Episodic session summarization via background worker</li>
            <li>FAISS vectorstore retrieval with lexical overlap verification</li>
            <li>Visual memory inspection control panel</li>
          </ul>
        </div>
        <div class="matrix-col">
          <h3>Multimodal & Agent Tooling</h3>
          <ul class="check-list">
            <li>Local Whisper audio transcription (STT)</li>
            <li>Server-side Text-to-Speech (TTS) generation</li>
            <li>PDF document parsing & automated report generation</li>
            <li>Policy-gated Git, Filesystem, Terminal, and Browser tools</li>
            <li>Isolated JavaScript sandbox execution engine</li>
          </ul>
        </div>
      </div>
    `
  },

  "security": {
    title: "Security & Safety Gates",
    subtitle: "Defense-in-depth architecture, tool governance, SSRF protection, and sandboxing",
    readTime: "5 min read",
    badge: "Zero Trust",
    content: `
      <div class="security-banner">
        <h3>🛡️ Defense-in-Depth Security Framework</h3>
        <p>Synapse strictly prohibits unchecked autonomous system modifications. All actions pass through layered policy enforcement gates.</p>
      </div>

      <div class="gates-list">
        <div class="gate-item">
          <div class="gate-icon">🔒</div>
          <div class="gate-content">
            <h4>Cryptographic Confirmation Gates</h4>
            <p>Destructive and write actions (modifying files, running build scripts, taking desktop screenshots) return a cryptographically signed approval token. Execution halts until the operator validates the intent via the UI.</p>
          </div>
        </div>
        <div class="gate-item">
          <div class="gate-icon">🌐</div>
          <div class="gate-content">
            <h4>SSRF Network Protection</h4>
            <p>The integrated browser tool verifies target URLs and blocks access to local loopbacks (<code>127.0.0.1</code>), RFC1918 private subnets (<code>10.0.0.0/8</code>, <code>192.168.0.0/16</code>), and internal hostnames.</p>
          </div>
        </div>
        <div class="gate-item">
          <div class="gate-icon">🧪</div>
          <div class="gate-content">
            <h4>Sandboxed Code Execution</h4>
            <p>The JavaScript sandbox inspects incoming code for dangerous patterns (<code>process.exit</code>, <code>child_process</code>, <code>eval</code>) and enforces strict CPU timeouts, memory caps, and truncated output buffers.</p>
          </div>
        </div>
        <div class="gate-item">
          <div class="gate-icon">📜</div>
          <div class="gate-content">
            <h4>Immutable Audit Logging</h4>
            <p>Every tool call, policy decision, input parameter, duration, and output is recorded to the MongoDB <code>audit_logs</code> collection for forensics and traceability.</p>
          </div>
        </div>
      </div>
    `
  },

  "ops-runbook": {
    title: "Ops Runbook & Quickstart",
    subtitle: "Environment setup, local prerequisites, and operational commands",
    readTime: "3 min read",
    badge: "Runbook",
    content: `
      <h2>Prerequisites</h2>
      <ul class="req-list">
        <li><strong>Node.js</strong> v20.x or higher</li>
        <li><strong>MongoDB</strong> running locally or via cloud URI (default: <code>mongodb://127.0.0.1:27017/synapse</code>)</li>
        <li><strong>Ollama</strong> running locally (<code>http://127.0.0.1:11434</code>) with models pulled (e.g. <code>llama3</code>, <code>deepseek-r1</code>)</li>
      </ul>

      <h2>Quickstart Commands</h2>
      <div class="code-preview-block">
        <div class="code-header">
          <span class="file-name">Terminal Setup</span>
          <button class="copy-btn" onclick="copySnippet(this, 'ops-cmd')">Copy</button>
        </div>
        <pre><code id="ops-cmd"># 1. Start Ollama and pull model
ollama run llama3

# 2. Boot Backend Server
cd backend
npm install
npm run dev      # Boots on http://localhost:3001

# 3. Boot Frontend Mission Control
cd ../frontend
npm install
npm run dev      # Boots on http://localhost:5173</code></pre>
      </div>

      <h2>Key Environment Variables</h2>
      <div class="stack-table-container">
        <table class="synapse-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>PORT</code></td>
              <td><code>3001</code></td>
              <td>Backend HTTP and WebSocket port</td>
            </tr>
            <tr>
              <td><code>MONGO_URI</code></td>
              <td><code>mongodb://127.0.0.1:27017/synapse</code></td>
              <td>MongoDB connection string</td>
            </tr>
            <tr>
              <td><code>OLLAMA_BASE_URL</code></td>
              <td><code>http://127.0.0.1:11434</code></td>
              <td>Ollama inference API endpoint</td>
            </tr>
            <tr>
              <td><code>OLLAMA_MODEL</code></td>
              <td><code>llama3</code></td>
              <td>Default conversational model</td>
            </tr>
            <tr>
              <td><code>JWT_SECRET</code></td>
              <td><code>(random string)</code></td>
              <td>Secret key for signing access tokens</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  },

  "interfaces": {
    title: "REST & Socket.IO Interfaces",
    subtitle: "Complete API specification for endpoints and bidirectional socket events",
    readTime: "4 min read",
    badge: "API Reference",
    content: `
      <h2>REST Endpoints Summary</h2>
      <div class="api-card-list">
        <div class="api-pill-card">
          <span class="http-badge http-get">GET</span>
          <code>/health</code>
          <p>Liveness check returning process status, uptime, and system time.</p>
        </div>
        <div class="api-pill-card">
          <span class="http-badge http-get">GET</span>
          <code>/metrics</code>
          <p>Observability probe with heap memory stats, queue lengths, and active sockets.</p>
        </div>
        <div class="api-pill-card">
          <span class="http-badge http-post">POST</span>
          <code>/api/auth/login</code>
          <p>Authenticates operator credentials and returns access + refresh tokens.</p>
        </div>
        <div class="api-pill-card">
          <span class="http-badge http-get">GET</span>
          <code>/api/memory/profile</code>
          <p>Retrieves durable fact memory, episodic summaries, and profile traits.</p>
        </div>
        <div class="api-pill-card">
          <span class="http-badge http-post">POST</span>
          <code>/api/sandbox</code>
          <p>Executes JavaScript snippets within resource-capped constraints.</p>
        </div>
      </div>

      <h2>Primary Socket.IO Events</h2>
      <div class="stack-table-container">
        <table class="synapse-table">
          <thead>
            <tr>
              <th>Direction</th>
              <th>Event Name</th>
              <th>Payload</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="tag tag-fe">Client → Server</span></td>
              <td><code>chat:message</code></td>
              <td><code>{ chatId, message, modelPreference }</code></td>
              <td>Initiates conversational streaming session</td>
            </tr>
            <tr>
              <td><span class="tag tag-be">Server → Client</span></td>
              <td><code>chat:reply:chunk</code></td>
              <td><code>{ chunk, chatId }</code></td>
              <td>Streams individual token fragments in real time</td>
            </tr>
            <tr>
              <td><span class="tag tag-fe">Client → Server</span></td>
              <td><code>chat:stop</code></td>
              <td><code>{ chatId }</code></td>
              <td>Interrupts active inference stream immediately</td>
            </tr>
            <tr>
              <td><span class="tag tag-fe">Client → Server</span></td>
              <td><code>agent:confirm</code></td>
              <td><code>{ token }</code></td>
              <td>Provides cryptographic authorization for gated tools</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  }
};
