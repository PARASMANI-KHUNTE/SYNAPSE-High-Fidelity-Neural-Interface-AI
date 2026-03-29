import mongoose from "mongoose";

const memoryEpisodeSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  sessionIds: {
    type: [String],
    default: []
  },
  kind: {
    type: String,
    enum: ["session", "daily"],
    default: "session",
    index: true
  },
  label: {
    type: String,
    default: "",
    maxlength: 160
  },
  summary: {
    type: String,
    required: true,
    maxlength: 5000
  },
  topics: {
    type: [String],
    default: []
  },
  decisions: {
    type: [String],
    default: []
  },
  actions: {
    type: [String],
    default: []
  },
  embedding: {
    type: [Number],
    default: []
  }
}, {
  timestamps: true,
  collection: "memory_episodes"
});

memoryEpisodeSchema.index({ userId: 1, date: -1, kind: 1 });

const MemoryEpisode = mongoose.model("MemoryEpisode", memoryEpisodeSchema);

export default MemoryEpisode;
