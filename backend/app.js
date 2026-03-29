import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import config from "./src/utils/config.js";
import logger from "./src/utils/logger.js";
import { connectDB } from "./src/config/database.js";
import { initSocket } from "./src/config/socket.js";
import { attachListeners } from "./src/sockets/index.js";
import { initWorker } from "./src/queues/worker.js";
import { initScheduler } from "./src/triggers/scheduler.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { getConfiguredModels } from "./src/services/chatRouter.js";

import chatRoutes from "./src/routes/chat.js";
import memoryRoutes from "./src/routes/memory.js";
import systemRoutes from "./src/routes/system.js";
import triggerRoutes from "./src/routes/triggers.js";
import uploadRoutes from "./src/routes/upload.js";
import sandboxRoutes from "./src/routes/sandbox.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
let serverStarted = false;

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

app.use(cors({
  origin: config.cors.origins,
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));

const ALLOWED_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.webm', '.mp3', '.wav', '.ogg'];

app.use("/uploads", (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return res.status(403).json({ error: "File type not allowed" });
  }
  next();
}, express.static(path.join(__dirname, "uploads"), {
  maxAge: "1d",
  etag: true,
  index: false
}));

connectDB();

const io = initSocket(httpServer);
attachListeners(io);

initWorker();
void initScheduler();

app.get("/api/config", (req, res) => {
  res.json({
    operatorName: config.app.operatorName,
    ollamaModel: config.ollama.model,
    version: "2.0.0-neural",
    models: getConfiguredModels()
  });
});

app.use("/api/chat", chatRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/triggers", triggerRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/sandbox", sandboxRoutes);

app.use(errorHandler);

export const startServer = () => {
  if (serverStarted) {
    return httpServer;
  }

  httpServer.listen(config.app.port, () => {
    logger.info({ port: config.app.port, env: config.app.nodeEnv }, "SYNAPSE server running");
  });
  serverStarted = true;
  return httpServer;
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  startServer();
}

export { app, httpServer, io };
