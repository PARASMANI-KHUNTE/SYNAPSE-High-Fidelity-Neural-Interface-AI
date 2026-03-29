import { Server } from "socket.io";
import config from "../utils/config.js";
import logger from "../utils/logger.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.cors.origins,
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"]
  });

  logger.info({ origins: config.cors.origins }, "Socket.io initialized");
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
