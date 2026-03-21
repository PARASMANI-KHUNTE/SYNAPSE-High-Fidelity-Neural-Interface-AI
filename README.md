# 🧠 SYNAPSE: High-Fidelity Neural Interface AI

SYNAPSE is a cutting-edge, multi-modal AI assistant designed for seamless interaction and deep research. It integrates real-time internet search, vector memory, and multimedia processing into a premium, futuristic interface.

---

## 🚀 Key Features

### 📡 Advanced Intelligence & RAG
- **Neural Memory (RAG)**: Integrates Local Vector Search (FAISS) for precise retrieval from personal documents.
- **Real-time Internet Research**: Automated trigger for time-sensitive queries, fetching the latest news and data.
- **Cross-Chat Context**: Remembers prior interactions across different sessions for a unified user experience.

### 🍱 Multi-modal Capabilities
- **Multimedia Input**: Supports Image Analysis, Audio Transcription (Local Whisper), and PDF Processing.
- **Dynamic Content Generation**: Local Image Generation (Stable Diffusion) and Professional PDF Report creation.
- **Web Surfing**: Automated scraping and summarization of shared URLs.

### 🎭 Premium User Experience
- **Neural Interface UI**: Sleek, glassmorphic design with vibrant animations and sci-fi aesthetics.
- **Energy Ring Portal**: A symmetrical, glowing energy ring with a dense, swirling particle cloud that reacts to the assistant's voice.
- **Interactive Code Sandbox**: Execute JavaScript and Python code directly within the chat interface.
- **Voice Synthesis (TTS)**: High-quality neural voices for immersive interaction.

### 🛠️ Developer Tools
- **Synaptic Feedback**: Loop-back feedback system for continuous AI refinement.
- **Neural Autocomplete**: Debounced completions and suggestions for faster interaction.
- **Task Queuing (Redis)**: Robust background processing for mission-critical responses.

---

## 🛠️ Technical Stack

- **Frontend**: React, Vite, Framer Motion, Tailwind CSS, Lucide Icons, Socket.io-client.
- **Backend**: Node.js, Express, Socket.io, Mongoose (MongoDB).
- **Architecture**: Modular Domain-Driven Design with BullMQ (Redis) task queuing.
- **AI Core**: Ollama (Llama3.2:1b/Llava), Local Whisper Bridge (Python), Stable Diffusion (Local API).
- **Processing**: Cheerio (Scraping), PDF-parse, Axios.

---

## 📂 Project Structure

```text
/backend
  /src
    /config     - Database, Socket, and Redis initialization
    /middleware - Express error handling and uploads
    /queues     - BullMQ task processing and workers
    /sockets    - Domain-specific event listeners
  /models       - Mongoose schemas (Chat, Memory)
  /services     - LLM, Image Gen, Search, and PDF logic
/frontend
  /src/components - Reusable UI components (InputBar, Visualizer, etc.)
  /src/App.jsx    - Main application state and socket logic
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** (Local instance on port 27017)
- **Ollama** (Running locally with `llama3.2:1b`, `llama3`, and `llava` models)
- **Redis** (Optional, for advanced task queuing)
- **Python** (For local Whisper and TTS services)

### 2. Environment Setup
Create a `.env` file in the `/backend` directory:
```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/
DbName=LLMmemory
OLLAMA_MODEL=llama3.2:1b
OLLAMA_BASE_URL=http://localhost:11434
BASE_URL=http://localhost:3001
```

Create a `.env` file in the `/frontend` directory:
```env
VITE_API_URL=http://localhost:3001
```

### 3. Installation
```powershell
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 4. Run Development Servers
```powershell
# Start Backend
cd backend
npm run dev

# Start Frontend
cd frontend
npm run dev
```

---

## 🧪 Automated Testing

SYNAPSE includes a comprehensive 8-step automated test suite to verify the integrity of the RAG pipeline, check for hallucinations, and ensure memory recall.

To run the automated tests:
```powershell
cd backend
npm test
```
The test suite will check:
1. RAG Integrity
2. Out-of-Domain Rejection
3. Context Override
4. Prompt Strength (Empty Context)
5. Relevance Noise Filtering
6. Real-Time Routing Triggers
7. Chunk Quality
8. Multi-turn Memory

---

## 🛡️ Recent Achievements & Fixes
- ✅ **Local Optimization**: Migrated to a lightweight `llama3.2:1b` model for systems with limited RAM.
- ✅ **Port Conflict Resolution**: Moved backend to `3001` and synchronized frontend `.env` configuration.
- ✅ **Mongoose Stability**: Modernized database middleware to prevent `next()` function errors.
- ✅ **Modular Backend**: Restructured `app.js` and `chatHandler.js` into domain-specific modules.
- ✅ **Redis Integration**: Introduced BullMQ for high-reliability background task processing.

---

*“Bridging the gap between human intent and neural intelligence.”*
