import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    maxlength: 200,
    index: true
  },
  userId: {
    type: String,
    maxlength: 100,
    index: true
  },
  tool: {
    type: String,
    required: true,
    maxlength: 100
  },
  action: {
    type: String,
    maxlength: 200,
    default: "execute"
  },
  input: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  output: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  policyDecision: {
    type: String,
    enum: ["allowed", "denied", "confirmed"],
    required: true
  },
  durationMs: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null,
    maxlength: 5000
  }
}, {
  collection: "audit_logs"
});

auditLogSchema.index({ tool: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
