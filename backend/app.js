import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Modular Configs
import { connectDB } from "./src/config/database.js";
import { initSocket } from "./src/config/socket.js";
import { attachListeners } from "./src/sockets/index.js";
import { initWorker } from "./src/queues/worker.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { getConfiguredModels } from "./src/services/chatRouter.js";

// Routes
import chatRoutes from "./src/routes/chat.js";
import uploadRoutes from "./src/routes/upload.js";
import sandboxRoutes from "./src/routes/sandbox.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Middlewares
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect Database
connectDB();

// Initialize Socket.io
const io = initSocket(httpServer);
attachListeners(io);

// Initialize Workers
initWorker();

// API Config Endpoint
app.get("/api/config", (req, res) => {
  const models = getConfiguredModels();
  res.json({
    operatorName: process.env.OPERATOR_NAME || "Operator",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3",
    version: "2.0.0-neural",
    models
  });
});

// Routes
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/sandbox", sandboxRoutes);

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 SYNAPSE Server running on port ${PORT}`);
});

export { io };
