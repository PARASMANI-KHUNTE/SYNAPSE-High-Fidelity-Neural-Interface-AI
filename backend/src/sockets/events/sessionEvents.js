import Chat from "../../models/Chat.js";
import fs from "fs";
import path from "path";

const collectUploadFilenames = (chat) => {
  const files = new Set();
  const uploadRegex = /\/uploads\/([^\s)"'`]+)/gi;

  for (const msg of chat?.messages || []) {
    if (msg?.audioUrl) {
      const name = path.basename(String(msg.audioUrl));
      if (name && name !== ".") files.add(name);
    }

    for (const imageUrl of msg?.imageUrls || []) {
      const name = path.basename(String(imageUrl));
      if (name && name !== ".") files.add(name);
    }

    const content = String(msg?.content || "");
    let match;
    while ((match = uploadRegex.exec(content)) !== null) {
      const name = path.basename(match[1] || "");
      if (name && name !== ".") files.add(name);
    }
  }

  return Array.from(files);
};

const deleteUploadFile = (filename) => {
  try {
    const fullPath = path.join(process.cwd(), "uploads", filename);
    fs.unlink(fullPath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.warn(`Failed deleting upload file ${filename}:`, err.message);
      }
    });
  } catch (err) {
    console.warn(`Failed resolving upload file ${filename}:`, err.message);
  }
};

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
        const files = collectUploadFilenames(deleted);
        files.forEach(deleteUploadFile);
        socket.emit("chat:deleted", { chatId });
      }
    } catch (err) {
      console.error("Failed to delete chat:", err.message);
    }
  });
};
