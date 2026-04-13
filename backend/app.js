import express from "express";
import { createServer } from "http";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import config from "./src/config/env.js";
import logger from "./src/utils/logger.js";
import { connectDB } from "./src/config/database.js";
import { initSocket } from "./src/config/socket.js";
import { attachListeners } from "./src/sockets/index.js";
import { initWorker } from "./src/queues/worker.js";
import { errorHandler, notFoundHandler } from "./src/middleware/errorHandler.js";
import { getConfiguredModels } from "./src/services/chatRouter.js";

import chatRoutes from "./src/routes/chat.js";
import memoryRoutes from "./src/routes/memory.js";
import uploadRoutes from "./src/routes/upload.js";
import sandboxRoutes from "./src/routes/sandbox.js";
import authRoutes from "./src/routes/auth.js";
import { requireAuth } from "./src/middleware/auth.js";

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

const createLimiter = (options) => rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.app.nodeEnv === "development",
  ...options,
  keyGenerator: (req) => {
    const userId = req.user?.id || req.headers["x-user-id"] || "anonymous";
    return `${req.ip || "unknown"}-${userId}`;
  }
});

const chatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: { code: "RATE_LIMIT", message: "Too many chat requests. Please wait before trying again." }
  }
});

const uploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: { code: "RATE_LIMIT", message: "Too many upload requests. Please wait before trying again." }
  }
});

const sandboxLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: {
    success: false,
    error: { code: "RATE_LIMIT", message: "Too many sandbox requests. Please wait before trying again." }
  }
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: { code: "RATE_LIMIT", message: "Too many authentication attempts. Please wait 15 minutes." }
  }
});

const genericLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: { code: "RATE_LIMIT", message: "Too many requests. Please wait before trying again." }
  }
});

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

app.get("/api/config", (req, res) => {
  res.json({
    operatorName: config.app.operatorName,
    ollamaModel: config.ollama.model,
    version: "2.0.0-neural",
    models: getConfiguredModels()
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/chat", requireAuth, chatLimiter, chatRoutes);
app.use("/api/memory", requireAuth, genericLimiter, memoryRoutes);
app.use("/api/upload", requireAuth, uploadLimiter, uploadRoutes);
app.use("/api/sandbox", requireAuth, sandboxLimiter, sandboxRoutes);

app.use(errorHandler);
app.use(notFoundHandler);

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
