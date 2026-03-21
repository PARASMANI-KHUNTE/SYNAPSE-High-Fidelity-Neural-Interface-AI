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

---

## 🛠️ Technical Stack

- **Frontend**: React, Vite, Framer Motion, Tailwind CSS, Lucide Icons, Socket.io-client.
- **Backend**: Node.js, Express, Socket.io, Mongoose (MongoDB).
- **AI Core**: Ollama (Llama3/Llava), Local Whisper Bridge (Python), Stable Diffusion (Local API).
- **Processing**: Cheerio (Scraping), PDF-parse, Axios.

---

## 📂 Project Structure

```text
/backend
  /models       - Mongoose schemas (Chat, Memory)
  /rag          - Vector storage and retrieval logic
  /routes       - REST APIs (Upload, Sandbox, Config)
  /services     - LLM, Image Gen, Search, and PDF logic
  /sockets      - Real-time chatHandler and event logic
/frontend
  /src/components - Reusable UI components (InputBar, Visualizer, etc.)
  /src/App.jsx    - Main application state and socket logic
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** (Local or Atlas)
- **Ollama** (Running locally with `llama3` and `llava` models)
- **Python** (For local Whisper and TTS services)

### 2. Environment Setup
Create a `.env` file in the `/backend` directory:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/synapse
OLLAMA_BASE_URL=http://localhost:11434
OPERATOR_NAME=YourName
BASE_URL=http://localhost:3000
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

## 🐳 Docker Deployment

For a streamlined setup, you can run the entire **SYNAPSE** stack using Docker Compose. This handles the Frontend, Backend, and MongoDB automatically.

### 1. Prerequisites
- **Docker** and **Docker Compose** installed.
- **Ollama** running on your host machine (if using local LLM).

### 2. Launching with Docker
```powershell
docker-compose up --build
```

### 3. Accessing the Application
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

> [!NOTE]
> The Docker setup is configured to communicate with Ollama and Stable Diffusion services running on your **host machine** via `host.docker.internal`. Ensure these services are accessible.

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
- ✅ **3D Neural Sphere**: Redesigned the voice visualizer for a symmetrical 3D orbital effect.
- ✅ **Energy Ring Portal**: Implemented a high-fidelity glowing portal visualizer with swirl particles.
- ✅ **Flexible Media Storage**: Fixed chat validation to allow messages with only media (images/audio).
- ✅ **Internet Research Pro**: Enhanced automated search triggers for real-time context.
- ✅ **Docker Readiness**: Added full Docker support with health checks and streamlined deployment.

---

*“Bridging the gap between human intent and neural intelligence.”*
