import { Server } from "socket.io";

let io;

/**
 * Create and return the Socket.io server instance.
 * Event listeners are attached separately via sockets/index.js
 */
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"]
  });

  console.log("🚀 Socket.io initialized");
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};
