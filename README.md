# 🧠 SYNAPSE: High-Fidelity Neural Interface AI

**SYNAPSE** is a premium, high-performance AI assistant ecosystem designed for deep research, multi-modal interaction, and real-time computation. It bridges the gap between local hardware performance and advanced agentic intelligence through a modular, high-fidelity neural architecture.

---

## 🚀 Visionary Features

### 📡 Intelligence & Smart Routing
- **Neural Preference Routing**: Optimized triple-model setup (`Qwen2.5 7B` for reasoning, `DeepSeek-Coder` for software tasks, and `Llama 3.2 3B` for high-speed casual interaction).
- **Neural Memory (RAG)**: Advanced Vector Search (FAISS) with **Out-of-Domain Rejection** and context overriding.
- **Deep Search Protocol**: Automated internet research triggers for grounding AI responses in real-time verified data.

### 🍱 Multi-Modal Hub
- **Llava Vision**: Seamless analysis of user-uploaded imagery integrated into the conversational flow.
- **Whisper & Qwen-TTS**: Local audio transcription paired with **Emotion-Aware Speech Synthesis** (Detects happy/sad/excited/professional tones).
- **Neural PDF Engine**:
    - **Parsing**: Advanced extraction of context from user-uploaded PDFs.
    - **Generation**: Clean, professional PDF report creation from AI interactions.

### 🍱 Developer Ecosystem
- **Interactive Sandbox**: Isolated backend execution environment for **JavaScript and Python**, allowing real-time algorithm testing.
- **Stable Diffusion Portal**: Integration for local text-to-image generation via optimized API bridges.
- **Session Continuity**: Multi-turn persistence with cross-chat memory and synaptic feedback loops.

---

## 📂 System Architecture

### ⚙️ Backend Module Map (`/backend`)
- **`src/config`**: Dedicated handlers for MongoDB, Socket.io, and Redis-less task queuing.
- **`src/services`**: Domain-specific logic for LLM orchestration, Voice (Whisper/Qwen), PDF generation, and Web Research.
- **`src/sockets`**: High-performance event handlers for real-time streaming and state synchronization.

### 🎨 Frontend Module Map (`/frontend`)
- **`src/components`**: Glassmorphic UI library (Particles, Energy Ring, Sandbox Panel, Neural Input).
- **`src/App.jsx`**: Central Neural Interface managing socket state, audio queues, and model preferences.

---

## ⚡ Multi-Model Deployment Guide

SYNAPSE is optimized for systems with **6GB+ VRAM (e.g., RTX 4050)**.

| Component | Target Model | Resource Profile |
|---|---|---|
| **Reasoning** | `qwen2.5:7b` | ~4GB VRAM |
| **Coding** | `deepseek-coder:6.7b` | ~4GB VRAM |
| **Casual** | `llama3.2:3b` | ~2B VRAM |
| **Vision** | `llava` | ~5GB VRAM |
| **Audio** | `Qwen3-TTS-0.6B` | ~1.5GB VRAM |

---

## 🛠️ Quick Start

### 1. Prerequisites
- **Node.js** (v18+) & **Python 3.10+** (with `pip install qwen-tts torch soundfile`)
- **Ollama** running locally with the models listed above.
- **MongoDB** local instance.

### 2. Initialization
```bash
# Clone and setup backend
cd backend && npm install
# Clone and setup frontend
cd frontend && npm install
```

### 3. Run
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 🧪 RAG Integrity Audit
SYNAPSE includes a rigorous 8-point test suite for RAG validation:
```bash
cd backend && npm test
```
Tests: *Integrity, OOD Rejection, Context Override, Prompt Strength, Relevance Filtering, Real-Time Routing, Chunk Quality, and Multi-turn Memory.*

---

## 🛡️ Recent Achievements (V3.0)
- ✅ **Fixed React Loop**: Optimized state dependencies in `InputBar` and `ChatWindow` to eliminate re-render cycles.
- ✅ **Dual-Model Routing**: Fully implemented intent-based switching between Reasoning and Coding models.
- ✅ **Emotional TTS**: Migrated from Edge-TTS to a local Qwen3-TTS system with dynamic tone detection.
- ✅ **Sandbox Integration**: Launched the Interactive Code Sandbox for live JS/Python execution.
- ✅ **Storage Cleanup**: Automated asset lifecycle management (Auto-deletion of processed uploads).

---

*“Engineering the future of neural interaction.”*
