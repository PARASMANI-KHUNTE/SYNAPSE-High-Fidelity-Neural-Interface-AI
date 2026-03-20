// ⚡ Load .env FIRST — before any other imports that read process.env
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import chatRoute from "./routes/chat.js";
import sandboxRoute from "./routes/sandbox.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { chatSocketHandler } from "./sockets/chatHandler.js";
import multer from "multer";
import fs from "fs";

const app = express();
const httpServer = createServer(app);

// 🔌 Socket.IO
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// 📁 File Upload Handling
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ url });
});
app.use("/uploads", express.static(uploadDir));

// 🔌 MongoDB
mongoose.connect(`${process.env.MONGO_URI}${process.env.DbName}`)
  .then(() => console.log("✅ Mongo Connected"))
  .catch(err => {
    console.error("❌ Mongo Failed:", err.message);
    process.exit(1);
  });

// 📡 Routes & Sockets
app.use("/chat", chatRoute);
app.use("/api/sandbox", sandboxRoute);
chatSocketHandler(io);

// 🛡️ Global error handler
app.use((err, req, res, _next) => {
  console.error("🔥 Unhandled Error:", err.message);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// 🚀 Start
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🧠 LLM_MODE: ${process.env.LLM_MODE}`);
  console.log(`🦙 OLLAMA_MODEL: ${process.env.OLLAMA_MODEL}`);
});

// 💀 Catch uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("💀 Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("💀 Unhandled Rejection:", reason);
});