import Chat from "../../models/Chat.js";

export const sessionEvents = (io, socket) => {
  socket.on("chat:list", async () => {
    const userId = socket.auth.userId;

    try {
      const chats = await Chat.findByUserId(userId);
      socket.emit("chat:list:reply", { chats });
    } catch (err) {
      console.error("Failed to list chats:", err.message);
    }
  });

  socket.on("chat:history", async ({ chatId }) => {
    const userId = socket.auth.userId;

    try {
      const chat = await Chat.findOne({ _id: chatId, userId });
      if (chat) {
        socket.emit("chat:history:reply", { messages: chat.messages });
      }
    } catch (err) {
      console.error("Failed to get chat history:", err.message);
    }
  });

  socket.on("chat:delete", async ({ chatId }) => {
    const userId = socket.auth.userId;

    try {
      const deleted = await Chat.findOneAndDelete({ _id: chatId, userId });
      if (deleted) {
        socket.emit("chat:deleted", { chatId });
      }
    } catch (err) {
      console.error("Failed to delete chat:", err.message);
    }
  });
};
