/**
 * Synapse Interactive Documentation Engine
 * Handles Chapter Navigation, Visual Flow Simulation, API Sandbox,
 * QA Bank Flashcards, Presentation Stage, and Audio Effects.
 */

// Sound synthesizer using Web Audio API
class SynapseAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playTone(freq = 440, duration = 0.08, type = 'sine') {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  click() { this.playTone(800, 0.04, 'triangle'); }
  success() { this.playTone(600, 0.06); setTimeout(() => this.playTone(900, 0.09), 60); }
  node() { this.playTone(350, 0.1, 'sine'); }
}

const audio = new SynapseAudio();

// Application State
const state = {
  currentSection: 'overview',
  theme: 'cyber', // cyber, light, oled
  activeApiIndex: 0,
  currentSlide: 0,
  qaFilter: 'all',
  qaMode: 'reader', // reader or flashcard
  qaSearch: '',
  tests: {},
  simRunning: false
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  initCanvas();
  loadSavedPreferences();
  navigate(state.currentSection, false);
  setupEventListeners();
});

// Build Sidebar Navigation
function renderSidebar() {
  const container = document.getElementById('sidebar-nav');
  if (!container || !window.SYNAPSE_DOCS) return;

  let html = '';
  window.SYNAPSE_DOCS.navigation.forEach(group => {
    html += `<div class="nav-group">
      <div class="nav-group-title">${group.group}</div>
      <ul class="nav-list">`;
    group.items.forEach(item => {
      const badge = item.badge ? `<span class="nav-item-badge">${item.badge}</span>` : '';
      html += `
        <li class="nav-item" data-id="${item.id}" onclick="navigate('${item.id}')">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${getIconSvg(item.icon)}</svg>
          <span>${item.title}</span>
          ${badge}
        </li>
      `;
    });
    html += `</ul></div>`;
  });
  container.innerHTML = html;
}

// Icon SVG path dictionary
function getIconSvg(icon) {
  switch (icon) {
    case 'cpu': return '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>';
    case 'layers': return '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>';
    case 'box': return '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>';
    case 'server': return '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>';
    case 'layout': return '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>';
    case 'git-commit': return '<circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>';
    case 'database': return '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>';
    case 'check-circle': return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
    case 'shield': return '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
    case 'terminal': return '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>';
    case 'activity': return '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>';
    case 'play': return '<polygon points="5 3 19 12 5 21 5 3"/>';
    case 'zap': return '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>';
    case 'help-circle': return '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
    case 'monitor': return '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
    case 'check-square': return '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>';
    case 'map': return '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>';
    default: return '<circle cx="12" cy="12" r="8"/>';
  }
}

// Navigation Dispatcher
function navigate(sectionId, playSfx = true) {
  if (playSfx) audio.click();
  state.currentSection = sectionId;

  // Update active state in sidebar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === sectionId);
  });

  const mainArea = document.getElementById('doc-display-area');
  if (!mainArea) return;

  // Render appropriate view
  switch (sectionId) {
    case 'sim-explorer':
      mainArea.innerHTML = renderSimulatorView();
      initSimulatorHandlers();
      break;
    case 'api-playground':
      mainArea.innerHTML = renderApiPlaygroundView();
      initApiPlaygroundHandlers();
      break;
    case 'qa-bank':
      mainArea.innerHTML = renderQaBankView();
      initQaBankHandlers();
      break;
    case 'presentation':
      mainArea.innerHTML = renderPresentationView();
      initPresentationHandlers();
      break;
    case 'test-checklist':
      mainArea.innerHTML = renderTestingChecklistView();
      initTestingHandlers();
      break;
    case 'roadmap':
      mainArea.innerHTML = renderRoadmapView();
      break;
    default:
      // Standard markdown chapter
      const chapter = window.SYNAPSE_CHAPTERS && window.SYNAPSE_CHAPTERS[sectionId];
      if (chapter) {
        mainArea.innerHTML = `
          <div class="chapter-hero">
            <div class="chapter-meta-row">
              <span class="chapter-badge">${chapter.badge || 'Chapter'}</span>
              <span class="chapter-readtime">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${chapter.readTime || '3 min'}
              </span>
            </div>
            <h1 class="chapter-title">${chapter.title}</h1>
            <p class="chapter-subtitle">${chapter.subtitle}</p>
          </div>
          <div class="doc-content">
            ${chapter.content}
          </div>
        `;
      } else {
        mainArea.innerHTML = `<h2>Section not found</h2>`;
      }
      break;
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   1. Interactive Architecture Flow Simulator
   ========================================================================== */
function renderSimulatorView() {
  return `
    <div class="chapter-hero">
      <div class="chapter-meta-row">
        <span class="chapter-badge">Live System Simulator</span>
        <span class="chapter-readtime">Interactive</span>
      </div>
      <h1 class="chapter-title">Architecture Flow Simulator</h1>
      <p class="chapter-subtitle">Click system nodes to inspect runtime metrics, and run interactive packet flows to observe event lifecycles in real time.</p>
    </div>

    <div class="simulator-hud">
      <div class="sim-controls-card">
        <div>
          <h4>Simulation Controls</h4>
          <p style="font-size:0.85rem; color:var(--text-dim); margin-bottom:0;">Trigger end-to-end data pipelines to trace packets through the system</p>
        </div>
        <div class="sim-btn-group">
          <button class="action-btn" id="btn-run-sim-chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Simulate Chat Stream
          </button>
          <button class="action-btn action-btn-secondary" id="btn-run-sim-tool">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Simulate Tool Gate
          </button>
          <button class="action-btn action-btn-secondary" id="btn-run-sim-rag">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/></svg>
            Simulate RAG Retrieval
          </button>
        </div>
      </div>

      <!-- Interactive Node SVG Canvas -->
      <div class="interactive-canvas-box">
        <svg id="sim-svg-canvas" viewBox="0 0 900 420" style="width:100%; height:auto;">
          <defs>
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <!-- Animated Flow Marker -->
            <circle id="live-packet" r="6" fill="#00f2fe" class="packet-anim" style="display:none;"/>
          </defs>

          <!-- Interconnection Paths -->
          <path id="path-client-gateway" d="M 140 210 L 300 210" stroke="rgba(56,189,248,0.3)" stroke-width="3" stroke-dasharray="6 4"/>
          <path id="path-gateway-pipeline" d="M 390 210 L 490 210" stroke="rgba(56,189,248,0.3)" stroke-width="3" stroke-dasharray="6 4"/>
          <path id="path-pipeline-ollama" d="M 570 180 L 690 90" stroke="rgba(245,158,11,0.3)" stroke-width="3" stroke-dasharray="6 4"/>
          <path id="path-pipeline-mongo" d="M 580 210 L 690 210" stroke="rgba(16,185,129,0.3)" stroke-width="3" stroke-dasharray="6 4"/>
          <path id="path-pipeline-faiss" d="M 570 240 L 690 320" stroke="rgba(139,92,246,0.3)" stroke-width="3" stroke-dasharray="6 4"/>

          <!-- Node: Client UI -->
          <g class="node-group" onclick="inspectNode('client')" transform="translate(40, 160)">
            <rect width="120" height="90" rx="12" fill="#131c2d" stroke="#00f2fe" stroke-width="2"/>
            <text x="60" y="38" fill="#ffffff" font-weight="700" text-anchor="middle" font-size="13">React / Vite UI</text>
            <text x="60" y="58" fill="#38bdf8" text-anchor="middle" font-size="10">Port 5173</text>
            <text x="60" y="74" fill="#94a3b8" text-anchor="middle" font-size="9">Socket Client</text>
          </g>

          <!-- Node: Gateway -->
          <g class="node-group" onclick="inspectNode('gateway')" transform="translate(290, 150)">
            <rect width="120" height="110" rx="14" fill="#152136" stroke="#38bdf8" stroke-width="2"/>
            <text x="60" y="36" fill="#ffffff" font-weight="700" text-anchor="middle" font-size="13">Express Gateway</text>
            <text x="60" y="56" fill="#38bdf8" text-anchor="middle" font-size="10">Port 3001</text>
            <text x="60" y="76" fill="#94a3b8" text-anchor="middle" font-size="9">Socket.IO 4</text>
            <text x="60" y="94" fill="#64748b" text-anchor="middle" font-size="8">Auth & Rate Limit</text>
          </g>

          <!-- Node: Pipeline -->
          <g class="node-group" onclick="inspectNode('pipeline')" transform="translate(480, 140)">
            <rect width="120" height="130" rx="14" fill="#1b1c36" stroke="#8b5cf6" stroke-width="2.5" filter="url(#neon-glow)"/>
            <text x="60" y="36" fill="#ffffff" font-weight="700" text-anchor="middle" font-size="13">Chat Pipeline</text>
            <text x="60" y="56" fill="#c084fc" text-anchor="middle" font-size="10">Router & Policy</text>
            <text x="60" y="78" fill="#94a3b8" text-anchor="middle" font-size="9">Intent Classifier</text>
            <text x="60" y="96" fill="#94a3b8" text-anchor="middle" font-size="9">Tool Registry</text>
            <text x="60" y="114" fill="#94a3b8" text-anchor="middle" font-size="9">Confirmation Gate</text>
          </g>

          <!-- Node: Ollama Inference -->
          <g class="node-group" onclick="inspectNode('ollama')" transform="translate(680, 45)">
            <rect width="130" height="85" rx="12" fill="#291e12" stroke="#f59e0b" stroke-width="2"/>
            <text x="65" y="34" fill="#ffffff" font-weight="700" text-anchor="middle" font-size="13">Ollama Engine</text>
            <text x="65" y="52" fill="#fbbf24" text-anchor="middle" font-size="10">Port 11434 (Local)</text>
            <text x="65" y="70" fill="#94a3b8" text-anchor="middle" font-size="9">Llama 3 / DeepSeek</text>
          </g>

          <!-- Node: MongoDB -->
          <g class="node-group" onclick="inspectNode('mongodb')" transform="translate(680, 165)">
            <rect width="130" height="85" rx="12" fill="#11291f" stroke="#10b981" stroke-width="2"/>
            <text x="65" y="34" fill="#ffffff" font-weight="700" text-anchor="middle" font-size="13">MongoDB State</text>
            <text x="65" y="52" fill="#34d399" text-anchor="middle" font-size="10">Port 27017</text>
            <text x="65" y="70" fill="#94a3b8" text-anchor="middle" font-size="9">Facts & Summaries</text>
          </g>

          <!-- Node: FAISS Vectorstore -->
          <g class="node-group" onclick="inspectNode('faiss')" transform="translate(680, 280)">
            <rect width="130" height="85" rx="12" fill="#201533" stroke="#8b5cf6" stroke-width="2"/>
            <text x="65" y="34" fill="#ffffff" font-weight="700" text-anchor="middle" font-size="13">FAISS Vectorstore</text>
            <text x="65" y="52" fill="#c084fc" text-anchor="middle" font-size="10">Local Disk Index</text>
            <text x="65" y="70" fill="#94a3b8" text-anchor="middle" font-size="9">Ollama Embeddings</text>
          </g>
        </svg>
      </div>

      <!-- Selected Node Inspection Card -->
      <div id="node-inspector-card" class="doc-card" style="display:none;">
        <div id="inspector-content"></div>
      </div>

      <!-- Realtime Simulation Console Logs -->
      <div class="sim-console-box" id="sim-console">
        <div class="console-line">
          <span class="console-time">[00:00:00]</span>
          <span class="console-source">SYSTEM:</span>
          <span class="console-msg">Simulator ready. Click any node above to inspect or trigger a live flow simulation.</span>
        </div>
      </div>
    </div>
  `;
}

function initSimulatorHandlers() {
  document.getElementById('btn-run-sim-chat')?.addEventListener('click', () => runSimulation('chat'));
  document.getElementById('btn-run-sim-tool')?.addEventListener('click', () => runSimulation('tool'));
  document.getElementById('btn-run-sim-rag')?.addEventListener('click', () => runSimulation('rag'));
}

// Inspect Node Details
function inspectNode(nodeId) {
  audio.node();
  const node = window.SYNAPSE_DOCS?.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const card = document.getElementById('node-inspector-card');
  const content = document.getElementById('inspector-content');
  if (!card || !content) return;

  card.style.display = 'block';
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div>
        <span class="pill-badge">${node.type}</span>
        <h3 style="margin-top:6px; margin-bottom:0;">${node.name}</h3>
      </div>
      <span class="tag tag-be">${node.status}</span>
    </div>
    <p style="color:var(--text-muted);">${node.desc}</p>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin:14px 0;">
      <div class="stat-badge"><span class="stat-label">Port / Channel</span><strong style="color:var(--text-main); font-size:0.9rem;">${node.port}</strong></div>
      <div class="stat-badge"><span class="stat-label">Stack</span><strong style="color:var(--text-main); font-size:0.8rem;">${node.tech}</strong></div>
      <div class="stat-badge"><span class="stat-label">Latency / Perf</span><strong style="color:var(--accent-cyan); font-size:0.9rem;">${Object.values(node.metrics)[0]}</strong></div>
    </div>
    <div style="margin-top:12px;">
      <span style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Key Implementation Files:</span>
      <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
        ${node.files.map(f => `<code>${f}</code>`).join('')}
      </div>
    </div>
  `;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Log message to simulation terminal
function logSim(source, message) {
  const consoleEl = document.getElementById('sim-console');
  if (!consoleEl) return;
  const now = new Date().toTimeString().split(' ')[0];
  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = `
    <span class="console-time">[${now}]</span>
    <span class="console-source">${source}:</span>
    <span class="console-msg">${message}</span>
  `;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Run Step-by-Step Interactive Flow Simulation
function runSimulation(flowType) {
  if (state.simRunning) return;
  state.simRunning = true;
  audio.success();

  const steps = [];
  if (flowType === 'chat') {
    steps.push({ src: 'CLIENT', msg: 'User inputs query: "Explain Synapse persistent memory architecture."', delay: 400 });
    steps.push({ src: 'SOCKETS', msg: 'Emitting event [chat:message] with Bearer token authentication verified.', delay: 700 });
    steps.push({ src: 'PIPELINE', msg: 'Intent Classifier -> Category: REASONING | Model Preference: DeepSeek R1', delay: 1100 });
    steps.push({ src: 'MEMORY', msg: 'Querying memory_facts -> Injected facts: Preferred tech stack, active project directory.', delay: 1600 });
    steps.push({ src: 'OLLAMA', msg: 'Invoking local Ollama POST /api/chat with stream=true (Zero cloud egress).', delay: 2100 });
    steps.push({ src: 'SOCKETS', msg: 'Streaming 48 chunks via [chat:reply:chunk] to client buffer at 42 t/s.', delay: 2800 });
    steps.push({ src: 'DB_SAVE', msg: 'Saving assistant response to MongoDB chats collection & triggering episodic summary.', delay: 3400 });
    steps.push({ src: 'CLIENT', msg: 'Stream completed -> Emitted [chat:reply:end]. Client render complete.', delay: 3900 });
  } else if (flowType === 'tool') {
    steps.push({ src: 'CLIENT', msg: 'User prompt: "Write updated environment config to .env file."', delay: 400 });
    steps.push({ src: 'PIPELINE', msg: 'Intent Classifier routes to AGENT LAYER -> Identified tool: fs:write', delay: 800 });
    steps.push({ src: 'POLICY', msg: 'toolPolicy.evaluate("fs:write") -> MUTATING OPERATION DETECTED!', delay: 1300 });
    steps.push({ src: 'POLICY', msg: 'Generated cryptographic confirmationToken: [gate_7b82f91a]', delay: 1700 });
    steps.push({ src: 'CLIENT', msg: 'UI displays confirmation dialog: "Approve file modification to .env?"', delay: 2200 });
    steps.push({ src: 'OPERATOR', msg: 'Operator approves -> Emits [agent:confirm] with token.', delay: 2800 });
    steps.push({ src: 'EXECUTOR', msg: 'Safely executed filesystem write within path sandboxing boundary.', delay: 3300 });
    steps.push({ src: 'AUDIT', msg: 'Logged execution parameters, status, and duration to MongoDB audit_logs.', delay: 3800 });
  } else if (flowType === 'rag') {
    steps.push({ src: 'CLIENT', msg: 'User queries repository docs: "What port does the backend listen on?"', delay: 400 });
    steps.push({ src: 'PIPELINE', msg: 'RAG Retriever triggered -> Computing LangChain Ollama embeddings for query.', delay: 900 });
    steps.push({ src: 'FAISS', msg: 'Executing vector similarity search on local FAISS index (search time: 8.2ms).', delay: 1400 });
    steps.push({ src: 'FILTER', msg: 'Lexical overlap check: Cosine score 0.88 > threshold (In-Domain confirmed).', delay: 2000 });
    steps.push({ src: 'PIPELINE', msg: 'Injecting top 3 retrieved text chunks into LLM system prompt context.', delay: 2600 });
    steps.push({ src: 'OLLAMA', msg: 'Generating ground-truth grounded reply without hallucinations.', delay: 3200 });
    steps.push({ src: 'CLIENT', msg: 'Answer streamed to UI: "The backend server listens on default port 3001."', delay: 3800 });
  }

  steps.forEach(step => {
    setTimeout(() => {
      logSim(step.src, step.msg);
      audio.click();
    }, step.delay);
  });

  setTimeout(() => {
    state.simRunning = false;
    logSim('SYSTEM', 'Simulation sequence complete.');
  }, steps[steps.length - 1].delay + 400);
}

/* ==========================================================================
   2. Interactive API & Socket Playground
   ========================================================================== */
function renderApiPlaygroundView() {
  const endpoints = window.SYNAPSE_DOCS?.apiEndpoints || [];
  const current = endpoints[state.activeApiIndex] || endpoints[0];

  return `
    <div class="chapter-hero">
      <div class="chapter-meta-row">
        <span class="chapter-badge">API Playground</span>
        <span class="chapter-readtime">Live Mock</span>
      </div>
      <h1 class="chapter-title">REST & Socket.IO Playground</h1>
      <p class="chapter-subtitle">Explore live simulated requests for all implemented REST routes and WebSocket event channels.</p>
    </div>

    <div class="api-playground-hud">
      <!-- Endpoint Selector Sidebar -->
      <div class="api-sidebar">
        ${endpoints.map((ep, idx) => `
          <div class="api-nav-pill ${idx === state.activeApiIndex ? 'active' : ''}" onclick="selectApiEndpoint(${idx})">
            <span class="http-badge ${ep.method === 'GET' ? 'http-get' : ep.method === 'POST' ? 'http-post' : 'http-emit'}">${ep.method}</span>
            <span style="font-family:var(--font-mono); font-size:0.8rem;">${ep.path}</span>
          </div>
        `).join('')}
      </div>

      <!-- Execution Panel -->
      <div class="api-runner-panel">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="http-badge ${current.method === 'GET' ? 'http-get' : current.method === 'POST' ? 'http-post' : 'http-emit'}" style="font-size:0.8rem; padding:4px 8px;">${current.method}</span>
            <code style="font-size:1.1rem; color:var(--text-main);">${current.path}</code>
          </div>
          <button class="action-btn" id="btn-fire-api" onclick="executeApiSimulation()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Send Simulated Call
          </button>
        </div>
        <p style="color:var(--text-muted); font-size:0.9rem;">${current.desc}</p>

        <!-- Request Body -->
        <div style="margin-top:16px;">
          <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-dim); font-weight:700;">Request Payload:</span>
          <div class="code-preview-block" style="margin-top:6px;">
            <div class="code-header">
              <span class="file-name">${current.request ? 'application/json' : 'No Body (GET)'}</span>
              <button class="copy-btn" onclick="copySnippet(this, 'req-code')">Copy</button>
            </div>
            <pre><code id="req-code">${current.request ? JSON.stringify(current.request, null, 2) : '// No request payload required'}</code></pre>
          </div>
        </div>

        <!-- Simulated Response -->
        <div style="margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-dim); font-weight:700;">Simulated Server Response:</span>
            <span id="api-status-badge" class="tag tag-be">200 OK (Latency: 6ms)</span>
          </div>
          <div class="code-preview-block" style="margin-top:6px;">
            <div class="code-header">
              <span class="file-name">application/json</span>
              <button class="copy-btn" onclick="copySnippet(this, 'resp-code')">Copy JSON</button>
            </div>
            <pre><code id="resp-code">${JSON.stringify(current.response, null, 2)}</code></pre>
          </div>
        </div>
      </div>
    </div>
  `;
}

function selectApiEndpoint(idx) {
  audio.click();
  state.activeApiIndex = idx;
  const mainArea = document.getElementById('doc-display-area');
  if (mainArea) mainArea.innerHTML = renderApiPlaygroundView();
}

function executeApiSimulation() {
  audio.success();
  showToast('API call simulated successfully');
  const badge = document.getElementById('api-status-badge');
  if (badge) {
    const lat = Math.floor(Math.random() * 8) + 4;
    badge.innerText = `200 OK (Latency: ${lat}ms)`;
  }
}

/* ==========================================================================
   3. Interactive QA Bank & Viva Preparation Mode
   ========================================================================== */
function renderQaBankView() {
  const allQs = window.SYNAPSE_DOCS?.qaBank || [];
  const categories = ['all', ...new Set(allQs.map(q => q.category))];

  const filtered = allQs.filter(q => {
    const matchesCat = state.qaFilter === 'all' || q.category === state.qaFilter;
    const matchesSearch = !state.qaSearch || q.q.toLowerCase().includes(state.qaSearch.toLowerCase()) || q.a.toLowerCase().includes(state.qaSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return `
    <div class="chapter-hero">
      <div class="chapter-meta-row">
        <span class="chapter-badge">Viva & Interview Prep</span>
        <span class="chapter-readtime">${allQs.length} Questions</span>
      </div>
      <h1 class="chapter-title">Interactive Project Question Bank</h1>
      <p class="chapter-subtitle">Comprehensive question bank for defense presentations, technical interviews, and system design reviews.</p>
    </div>

    <!-- Controls Bar -->
    <div class="qa-controls-bar">
      <!-- Category Filter Tabs -->
      <div class="qa-filter-tabs">
        ${categories.map(cat => `
          <button class="filter-chip ${state.qaFilter === cat ? 'active' : ''}" onclick="setQaFilter('${cat}')">
            ${cat === 'all' ? 'All Categories' : cat}
          </button>
        `).join('')}
      </div>

      <!-- Mode Toggle -->
      <div style="display:flex; gap:8px;">
        <button class="filter-chip ${state.qaMode === 'reader' ? 'active' : ''}" onclick="setQaMode('reader')">📖 List Mode</button>
        <button class="filter-chip ${state.qaMode === 'flashcard' ? 'active' : ''}" onclick="setQaMode('flashcard')">🃏 Flashcard Quiz</button>
      </div>
    </div>

    <!-- Questions Display -->
    <div class="qa-card-list">
      ${filtered.map(item => `
        <div class="qa-card" onclick="toggleQaCard(${item.id})">
          <div class="qa-header">
            <div>
              <span class="pill-badge" style="margin-bottom:8px; display:inline-block;">${item.category} • ${item.difficulty}</span>
              <div class="qa-q">${item.id}. ${item.q}</div>
            </div>
            <span class="tag tag-be">Viva Score: ${item.vivaScore}/5</span>
          </div>
          <div class="qa-ans" id="qa-ans-${item.id}" style="${state.qaMode === 'flashcard' ? 'display:none;' : ''}">
            <p>${item.a}</p>
            <div class="qa-takeaway"><strong>Key Defense Anchor:</strong> ${item.takeaway}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setQaFilter(cat) {
  audio.click();
  state.qaFilter = cat;
  const mainArea = document.getElementById('doc-display-area');
  if (mainArea) mainArea.innerHTML = renderQaBankView();
}

function setQaMode(mode) {
  audio.click();
  state.qaMode = mode;
  const mainArea = document.getElementById('doc-display-area');
  if (mainArea) mainArea.innerHTML = renderQaBankView();
}

function toggleQaCard(id) {
  audio.click();
  const ans = document.getElementById(`qa-ans-${id}`);
  if (ans) {
    ans.style.display = ans.style.display === 'none' ? 'block' : 'none';
  }
}

/* ==========================================================================
   4. Presentation Stage Mode
   ========================================================================== */
function renderPresentationView() {
  const slides = window.SYNAPSE_DOCS?.presentationSlides || [];
  const slide = slides[state.currentSlide] || slides[0];

  return `
    <div class="chapter-hero">
      <div class="chapter-meta-row">
        <span class="chapter-badge">Demo Mode</span>
        <span class="chapter-readtime">Slide ${slide.num} of ${slides.length}</span>
      </div>
      <h1 class="chapter-title">Presentation Stage & Teleprompter</h1>
      <p class="chapter-subtitle">Interactive slide deck and speaker notes for demo delivery, reviews, and faculty vivas.</p>
    </div>

    <div class="presentation-stage">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="pill-badge">Stage Slide ${slide.num}</span>
          <span class="tag tag-ai">Target Duration: ${slide.duration}</span>
        </div>
        <div class="slide-headline">${slide.headline}</div>
        <ul class="slide-bullet-list">
          ${slide.points.map(pt => `<li>${pt}</li>`).join('')}
        </ul>
      </div>

      <!-- Speaker Teleprompter -->
      <div class="speaker-teleprompter">
        <div class="speaker-title">🎙️ Speaker Teleprompter Notes (What to say)</div>
        <p style="color:#e2e8f0; font-size:0.95rem; line-height:1.6; margin-bottom:0;">
          "${slide.speakerNotes}"
        </p>
      </div>

      <!-- Navigation Bar -->
      <div class="slide-nav-bar">
        <button class="action-btn action-btn-secondary" onclick="prevSlide()" ${state.currentSlide === 0 ? 'disabled' : ''}>
          ← Previous Slide
        </button>
        <span style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-dim);">
          ${state.currentSlide + 1} / ${slides.length}
        </span>
        <button class="action-btn" onclick="nextSlide()" ${state.currentSlide === slides.length - 1 ? 'disabled' : ''}>
          Next Slide →
        </button>
      </div>
    </div>
  `;
}

function nextSlide() {
  const slides = window.SYNAPSE_DOCS?.presentationSlides || [];
  if (state.currentSlide < slides.length - 1) {
    audio.click();
    state.currentSlide++;
    const mainArea = document.getElementById('doc-display-area');
    if (mainArea) mainArea.innerHTML = renderPresentationView();
  }
}

function prevSlide() {
  if (state.currentSlide > 0) {
    audio.click();
    state.currentSlide--;
    const mainArea = document.getElementById('doc-display-area');
    if (mainArea) mainArea.innerHTML = renderPresentationView();
  }
}

/* ==========================================================================
   5. Interactive Testing Verification Suite
   ========================================================================== */
function renderTestingChecklistView() {
  const suite = window.SYNAPSE_DOCS?.testingSuite || [];

  return `
    <div class="chapter-hero">
      <div class="chapter-meta-row">
        <span class="chapter-badge">Testing & Verification</span>
        <span class="chapter-readtime">Interactive Suite</span>
      </div>
      <h1 class="chapter-title">Testing Verification Checklist</h1>
      <p class="chapter-subtitle">Verification steps for manual and automated validation of all core platform capabilities.</p>
    </div>

    <div class="checklist-container">
      ${suite.map(item => {
        const isDone = !!state.tests[item.id];
        return `
          <div class="check-item ${isDone ? 'done' : ''}" onclick="toggleTest('${item.id}')">
            <div class="custom-checkbox ${isDone ? 'checked' : ''}">
              ${isDone ? '✓' : ''}
            </div>
            <div style="flex:1;">
              <span class="pill-badge" style="font-size:0.65rem; margin-bottom:4px; display:inline-block;">${item.category}</span>
              <div class="check-title" style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${item.name}</div>
              <p style="font-size:0.82rem; color:var(--text-dim); margin-bottom:0;">${item.notes}</p>
            </div>
            <code style="font-size:0.8rem;">${item.cmd}</code>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function toggleTest(id) {
  audio.click();
  state.tests[id] = !state.tests[id];
  localStorage.setItem('synapse_tests', JSON.stringify(state.tests));
  const mainArea = document.getElementById('doc-display-area');
  if (mainArea) mainArea.innerHTML = renderTestingChecklistView();
}

/* ==========================================================================
   6. Roadmap View
   ========================================================================== */
function renderRoadmapView() {
  const phases = window.SYNAPSE_DOCS?.roadmapPhases || [];

  return `
    <div class="chapter-hero">
      <div class="chapter-meta-row">
        <span class="chapter-badge">Platform Milestones</span>
        <span class="chapter-readtime">Phases 0 - 5</span>
      </div>
      <h1 class="chapter-title">Synapse Evolution Roadmap</h1>
      <p class="chapter-subtitle">Chronological progression from foundation stabilization into autonomous edge companion.</p>
    </div>

    <div class="timeline-track">
      ${phases.map(p => `
        <div class="timeline-phase">
          <div class="timeline-node"></div>
          <div class="timeline-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <span class="pill-badge">${p.phase}</span>
                <h3 style="margin:4px 0 0 0;">${p.title}</h3>
              </div>
              <span class="tag ${p.status === 'completed' ? 'tag-db' : p.status === 'in-progress' ? 'tag-ai' : 'tag-fe'}">
                ${p.status.toUpperCase()}
              </span>
            </div>
            <ul class="check-list">
              ${p.items.map(it => `<li>${it}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ==========================================================================
   7. Background Neural Canvas
   ========================================================================== */
function initCanvas() {
  const canvas = document.getElementById('synapse-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const count = Math.floor(width / 35);

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1
    });
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 242, 254, 0.35)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
}

/* ==========================================================================
   8. Search Modal & Global Utilities
   ========================================================================== */
function setupEventListeners() {
  // Reading progress indicator
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const progress = total > 0 ? (window.scrollY / total) * 100 : 0;
    const bar = document.getElementById('reading-progress');
    if (bar) bar.style.width = `${progress}%`;
  });

  // Keyboard shortcut Ctrl+K / Cmd+K for search
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleSearchModal(true);
    }
    if (e.key === 'Escape') {
      toggleSearchModal(false);
    }
  });

  // Theme switch button
  document.getElementById('btn-theme-toggle')?.addEventListener('click', cycleTheme);

  // Audio switch button
  document.getElementById('btn-audio-toggle')?.addEventListener('click', toggleAudio);

  // Search input
  const searchInput = document.getElementById('search-modal-input');
  searchInput?.addEventListener('input', (e) => handleSearchQuery(e.target.value));

  // Mobile menu toggle
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });
}

function toggleSearchModal(show) {
  audio.click();
  const modal = document.getElementById('search-modal');
  if (!modal) return;
  modal.classList.toggle('open', show);
  if (show) {
    const input = document.getElementById('search-modal-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    handleSearchQuery('');
  }
}

function handleSearchQuery(query) {
  const list = document.getElementById('search-results-list');
  if (!list) return;

  const results = [];
  const qLower = query.toLowerCase().trim();

  // Search through chapters
  if (window.SYNAPSE_DOCS?.navigation) {
    window.SYNAPSE_DOCS.navigation.forEach(group => {
      group.items.forEach(item => {
        if (!qLower || item.title.toLowerCase().includes(qLower)) {
          results.push({ id: item.id, title: item.title, type: group.group });
        }
      });
    });
  }

  // Search through questions
  if (window.SYNAPSE_DOCS?.qaBank && qLower) {
    window.SYNAPSE_DOCS.qaBank.forEach(qa => {
      if (qa.q.toLowerCase().includes(qLower) || qa.a.toLowerCase().includes(qLower)) {
        results.push({ id: 'qa-bank', title: qa.q, type: 'QA Bank: ' + qa.category });
      }
    });
  }

  if (results.length === 0) {
    list.innerHTML = `<div style="padding:16px; color:var(--text-dim); text-align:center;">No matching documentation items found</div>`;
    return;
  }

  list.innerHTML = results.slice(0, 8).map(res => `
    <div class="search-result-item" onclick="navigate('${res.id}'); toggleSearchModal(false);">
      <span style="font-size:0.75rem; color:var(--accent-cyan);">${res.type}</span>
      <span style="font-weight:600; color:var(--text-main);">${res.title}</span>
    </div>
  `).join('');
}

function cycleTheme() {
  audio.click();
  const body = document.body;
  if (state.theme === 'cyber') {
    state.theme = 'light';
    body.className = 'theme-light';
    showToast('Theme: Laboratory Clean Light');
  } else if (state.theme === 'light') {
    state.theme = 'oled';
    body.className = 'theme-oled';
    showToast('Theme: Midnight OLED');
  } else {
    state.theme = 'cyber';
    body.className = '';
    showToast('Theme: Cyber Obsidian Neon');
  }
  localStorage.setItem('synapse_theme', state.theme);
}

function toggleAudio() {
  audio.enabled = !audio.enabled;
  const btn = document.getElementById('btn-audio-toggle');
  if (btn) btn.classList.toggle('active', audio.enabled);
  if (audio.enabled) audio.click();
  showToast(audio.enabled ? 'Audio effects enabled' : 'Audio muted');
}

function copySnippet(btn, codeId) {
  const codeEl = document.getElementById(codeId);
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.innerText).then(() => {
    audio.success();
    const orig = btn.innerText;
    btn.innerText = 'Copied!';
    setTimeout(() => btn.innerText = orig, 1800);
    showToast('Code copied to clipboard');
  });
}

function showToast(message) {
  let toast = document.getElementById('synapse-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'synapse-toast';
    toast.className = 'toast-msg';
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function loadSavedPreferences() {
  try {
    const savedTests = localStorage.getItem('synapse_tests');
    if (savedTests) state.tests = JSON.parse(savedTests);

    const savedTheme = localStorage.getItem('synapse_theme');
    if (savedTheme) {
      state.theme = savedTheme;
      if (savedTheme === 'light') document.body.className = 'theme-light';
      if (savedTheme === 'oled') document.body.className = 'theme-oled';
    }
  } catch (e) {}
}
