import { Server } from "socket.io";
import config from "./env.js";
import logger from "../utils/logger.js";
import { requireSocketAuth } from "../middleware/auth.js";

let io;

const connectionLimits = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_CONNECTIONS_PER_IP = 10;
const MAX_EVENTS_PER_USER = 100;

const cleanExpiredLimits = () => {
  const now = Date.now();
  for (const [key, data] of connectionLimits.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      connectionLimits.delete(key);
    }
  }
};

setInterval(cleanExpiredLimits, RATE_LIMIT_WINDOW);

const checkConnectionLimit = (ip) => {
  const key = `conn_${ip}`;
  const now = Date.now();
  
  if (!connectionLimits.has(key)) {
    connectionLimits.set(key, { count: 0, windowStart: now });
  }
  
  const data = connectionLimits.get(key);
  
  if (now - data.windowStart > RATE_LIMIT_WINDOW) {
    data.count = 0;
    data.windowStart = now;
  }
  
  if (data.count >= MAX_CONNECTIONS_PER_IP) {
    return false;
  }
  
  data.count++;
  return true;
};

const userEventCounts = new Map();

const checkEventRateLimit = (userId) => {
  const key = `events_${userId}`;
  const now = Date.now();
  
  if (!userEventCounts.has(key)) {
    userEventCounts.set(key, { count: 0, windowStart: now });
  }
  
  const data = userEventCounts.get(key);
  
  if (now - data.windowStart > RATE_LIMIT_WINDOW) {
    data.count = 0;
    data.windowStart = now;
  }
  
  if (data.count >= MAX_EVENTS_PER_USER) {
    return false;
  }
  
  data.count++;
  return true;
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.cors.origins,
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 10 * 1024 * 1024
  });

  io.use(requireSocketAuth);

  io.on("connection", (socket) => {
    const ip = socket.handshake.address || socket.handshake.headers["x-forwarded-for"] || "unknown";
    const userId = socket.user?.id || "anonymous";

    if (!checkConnectionLimit(ip)) {
      logger.warn({ ip, userId }, "Connection rate limit exceeded");
      socket.emit("error", { message: "Too many connections from this IP" });
      socket.disconnect(true);
      return;
    }

    logger.info({ socketId: socket.id, userId, ip }, "Client connected");

    socket.on("chat:message", (data, callback) => {
      if (!checkEventRateLimit(userId)) {
        const error = { success: false, error: { code: "RATE_LIMIT", message: "Too many requests. Please slow down." } };
        if (typeof callback === "function") callback(error);
        return;
      }
      socket.handles?.chatMessage?.(socket, data, callback);
    });

    socket.on("agent:run", (data, callback) => {
      if (!checkEventRateLimit(userId)) {
        const error = { success: false, error: { code: "RATE_LIMIT", message: "Too many requests. Please slow down." } };
        if (typeof callback === "function") callback(error);
        return;
      }
      socket.handles?.agentRun?.(socket, data, callback);
    });

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, "Client disconnected");
    });
  });

  logger.info({ origins: config.cors.origins }, "Socket.io initialized with rate limiting");
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
