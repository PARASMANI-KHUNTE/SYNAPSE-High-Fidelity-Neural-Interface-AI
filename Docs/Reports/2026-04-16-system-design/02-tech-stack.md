# Tech Stack

## Backend

- Runtime: **Node.js** (ES modules)
- Web: **Express 5**
- Realtime: **Socket.IO 4**
- Database: **MongoDB** via **Mongoose**
- Validation: **zod** (env validation)
- Logging: **pino** (+ `pino-pretty`)
- Security middleware: **helmet**, **cors**, **express-rate-limit**, **compression**
- Uploads: **multer**

### AI / LLM integration

- Local inference: **Ollama** (HTTP API)
- LangChain:
  - `@langchain/ollama` — embeddings
  - `@langchain/community` — FAISS store load/save
- RAG vectorstore: **FAISS** (`faiss-node`)

### Multi-modal

- Audio STT: `whisper-node`
- TTS: Python scripts in `backend/src/scripts/` (invoked by `voice.js`)
- PDF parsing: `pdf-parse`
- PDF generation: `pdfkit`

### Web retrieval

- HTTP: `axios`, `node-fetch`
- HTML extraction: `cheerio`

### Concurrency & background work

- In-memory background queue: `backend/src/utils/simpleQueue.js`
- Model/job throttling: `p-queue`
- CPU-heavy work isolation: Node `worker_threads` (`backend/src/services/workers/heavyTasks.js`)

## Frontend

- Framework: **React** (Vite)
- Build tooling: **Vite**
- Styling: **TailwindCSS 4**, plus custom CSS tokens/utilities
- Animation/UI motion: **Framer Motion**
- Icons: **lucide-react**
- Markdown rendering: `react-markdown` + `remark-gfm`
- Realtime: **socket.io-client**
- 3D/Canvas: **three**, `@react-three/fiber`, `@react-three/drei`

## Storage / artifacts

- Mongo collections (see `07-data-model.md`)
- Local artifact directories:
  - `backend/uploads/` (uploads + generated assets)
  - `backend/vectorstore/` (FAISS)

## Optional / external dependencies

- Ollama daemon running locally (default `http://127.0.0.1:11434`)
- MongoDB running locally or remote (`MONGO_URI`)
- Docker (optional): sandbox can execute in Docker in production mode

