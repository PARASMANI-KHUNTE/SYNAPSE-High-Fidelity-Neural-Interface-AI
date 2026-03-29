import mongoose from "mongoose";

const memoryFactSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  key: {
    type: String,
    required: true,
    maxlength: 120
  },
  value: {
    type: String,
    required: true,
    maxlength: 500
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  source: {
    type: String,
    enum: ["user_stated", "inferred", "observed"],
    default: "user_stated"
  },
  sessionId: {
    type: String,
    maxlength: 200,
    default: ""
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  collection: "memory_facts"
});

memoryFactSchema.index({ userId: 1, key: 1, active: 1, timestamp: -1 });

const MemoryFact = mongoose.model("MemoryFact", memoryFactSchema);

export default MemoryFact;
