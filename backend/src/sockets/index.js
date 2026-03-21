import { sessionEvents } from "./events/sessionEvents.js";
import { chatEvents } from "./events/chatEvents.js";

export const attachListeners = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Attach domain events
    sessionEvents(io, socket);
    chatEvents(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Client disconnected: ${socket.id} (${reason})`);
    });
  });
};
