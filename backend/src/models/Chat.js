import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { 
    type: String, 
    enum: ["user", "assistant", "system"], 
    required: true,
    index: false
  },
  content: { 
    type: String,
    default: "",
    maxlength: 100000
  },
  imageUrls: [{ 
    type: String,
    maxlength: 2000
  }],
  audioUrl: { 
    type: String,
    maxlength: 500
  },
  feedback: { 
    type: String, 
    enum: ["positive", "negative", null], 
    default: null
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, { _id: true });

const chatSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  title: { 
    type: String, 
    default: "New Chat",
    maxlength: 200,
    index: false
  },
  messages: [messageSchema]
}, { 
  timestamps: true,
  collection: "chats"
});

chatSchema.index({ updatedAt: -1 });
chatSchema.index({ userId: 1, updatedAt: -1 });

chatSchema.pre("save", async function() {
  if (this.title && this.title.length > 30) {
    this.title = this.title.substring(0, 30) + "...";
  }
  
  if (this.messages && this.messages.length > 500) {
    this.messages = this.messages.slice(-500);
  }
});

chatSchema.methods.getRecentMessages = function(count = 10) {
  return this.messages.slice(-count);
};

chatSchema.methods.getTotalTokens = function() {
  return this.messages.reduce((acc, msg) => {
    return acc + (msg.content?.length || 0);
  }, 0);
};

chatSchema.methods.clearMessages = function() {
  this.messages = [];
  return this.save();
};

chatSchema.methods.addMessage = function(role, content, metadata = {}) {
  const message = {
    role,
    content: content?.substring(0, 100000) || "",
    timestamp: new Date(),
    ...metadata
  };
  this.messages.push(message);
  return message;
};

chatSchema.statics.findByUserId = function(userId, limit = 50) {
  return this.find({ userId })
    .select("_id title updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .limit(limit);
};

chatSchema.statics.cleanupOldChats = async function(daysOld = 90, keepCount = 100) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const oldChats = await this.find({
    updatedAt: { $lt: cutoffDate }
  }).sort({ updatedAt: 1 }).limit(keepCount);

  const idsToDelete = oldChats.slice(0, Math.max(0, oldChats.length - keepCount)).map(c => c._id);
  
  if (idsToDelete.length > 0) {
    const result = await this.deleteMany({ _id: { $in: idsToDelete } });
    return result.deletedCount;
  }
  
  return 0;
};

const Chat = mongoose.model("Chat", chatSchema);

Chat.on("index", (err) => {
  if (err) {
    console.error("Chat model index error:", err.message);
  } else {
    console.log("Chat model indexes created successfully");
  }
});

export default Chat;
