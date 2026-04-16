import { sessionEvents } from "./events/sessionEvents.js";
import { chatEvents } from "./events/chatEvents.js";
import { agentEvents } from "./events/agentEvents.js";
import logger from "../utils/logger.js";

const activeStreams = new Map();

export const cleanupClient = (socketId, streamsMap = activeStreams) => {
  if (streamsMap.has(socketId)) {
    try {
      streamsMap.get(socketId).abort();
    } catch (e) {
      logger.warn({ socketId, err: e }, "Failed to abort stream");
    }
    streamsMap.delete(socketId);
  }
};

export { activeStreams };

export const attachListeners = (io) => {
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    sessionEvents(io, socket);
    chatEvents(io, socket, activeStreams);
    agentEvents(io, socket);


    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Client disconnected");
      cleanupClient(socket.id, activeStreams);
    });
  });
};
