import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false // Optional if global system alert
  },
  type: {
    type: String,
    enum: ["scheduled", "system", "monitoring", "error"],
    required: true,
    default: "monitoring"
  },
  label: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["unread", "read", "dismissed"],
    default: "unread"
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Avoid duplicate alerts (e.g., same message within last hour)
alertSchema.index({ label: 1, message: 1, timestamp: -1 });

const Alert = mongoose.model("Alert", alertSchema);

export default Alert;
