import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import logger from "../utils/logger.js";

export const writeAuditLog = async ({
  sessionId = "",
  userId = "",
  tool,
  action = "execute",
  input = null,
  output = null,
  policyDecision = "allowed",
  durationMs = 0,
  error = null
}) => {
  if (mongoose.connection.readyState !== 1) {
    logger.debug({ tool, action }, "Skipping audit log write because Mongo is not connected");
    return;
  }

  try {
    await AuditLog.create({
      sessionId,
      userId,
      tool,
      action,
      input,
      output,
      policyDecision,
      durationMs,
      error
    });
  } catch (err) {
    logger.warn({ err, tool, action }, "Failed to persist audit log");
  }
};

export default { writeAuditLog };
