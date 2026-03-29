import { getTool } from "./toolRegistry.js";
import { evaluateToolPolicy } from "./toolPolicy.js";
import { writeAuditLog } from "./auditLog.js";

export const executeTool = async ({
  toolName,
  params = {},
  context = {},
  confirmationGranted = false
}) => {
  const tool = getTool(toolName);
  const policy = evaluateToolPolicy({
    tool,
    params,
    userContext: context.userContext
  });

  if (policy.decision === "deny") {
    await writeAuditLog({
      sessionId: context.sessionId,
      userId: context.userId,
      tool: toolName,
      action: params?.action || "execute",
      input: params,
      output: null,
      policyDecision: "denied",
      error: policy.reason
    });
    return { status: "denied", policy, tool: null };
  }

  if (policy.decision === "confirm" && !confirmationGranted) {
    return { status: "needs_confirmation", policy, tool };
  }

  const start = Date.now();

  try {
    const result = await tool.execute(params, context);
    await writeAuditLog({
      sessionId: context.sessionId,
      userId: context.userId,
      tool: tool.name,
      action: params?.action || "execute",
      input: params,
      output: result,
      policyDecision: policy.decision === "confirm" ? "confirmed" : "allowed",
      durationMs: Date.now() - start
    });

    return {
      status: "completed",
      policy,
      tool,
      result
    };
  } catch (err) {
    await writeAuditLog({
      sessionId: context.sessionId,
      userId: context.userId,
      tool: tool?.name || toolName,
      action: params?.action || "execute",
      input: params,
      output: null,
      policyDecision: policy.decision === "confirm" ? "confirmed" : "allowed",
      durationMs: Date.now() - start,
      error: err.message
    });

    throw err;
  }
};

export default { executeTool };
