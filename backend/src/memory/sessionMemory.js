export const getSessionWindow = (chat, limit = 12) => {
  if (!chat?.messages?.length) return [];
  return chat.messages.slice(-limit).map((message) => ({
    role: message.role,
    content: message.content || "",
    timestamp: message.timestamp
  }));
};

export default { getSessionWindow };
