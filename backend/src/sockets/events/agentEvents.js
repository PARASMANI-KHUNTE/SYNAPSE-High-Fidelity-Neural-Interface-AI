import { randomUUID } from "crypto";
import { executeTool } from "../../agent/toolExecutor.js";
import { getAllTools } from "../../agent/toolRegistry.js";
import logger from "../../utils/logger.js";

const pendingConfirmations = new Map();

export const agentEvents = (io, socket) => {
  const runAgentTool = async (payload = {}) => {
    const {
      tool,
      params = {},
      userId = "",
      sessionId = "",
      confirmationToken = ""
    } = payload;

    const runId = randomUUID();
    socket.emit("agent:thinking", {
      runId,
      step: "plan",
      message: `Preparing ${tool || "agent"} task`
    });

    try {
      socket.emit("agent:tool:start", { runId, tool, params });

      const confirmationGranted = Boolean(
        confirmationToken && pendingConfirmations.get(confirmationToken)?.socketId === socket.id
      );

      const execution = await executeTool({
        toolName: tool,
        params,
        context: {
          io,
          socket,
          userId,
          sessionId,
          projectRoot: process.cwd(),
          userContext: {}
        },
        confirmationGranted
      });

      if (execution.status === "needs_confirmation") {
        const token = randomUUID();
        pendingConfirmations.set(token, {
          socketId: socket.id,
          tool,
          params,
          userId,
          sessionId,
          createdAt: Date.now()
        });

        socket.emit("agent:confirm:req", {
          runId,
          token,
          tool,
          params,
          risk: execution.tool?.risk || "high"
        });
        return;
      }

      if (execution.status === "denied") {
        socket.emit("agent:tool:error", {
          runId,
          tool,
          error: execution.policy.reason
        });
        socket.emit("agent:done", {
          runId,
          success: false,
          error: execution.policy.reason
        });
        return;
      }

      socket.emit("agent:tool:result", {
        runId,
        tool,
        output: execution.result?.output ?? execution.result,
        duration: execution.result?.metadata?.durationMs || null
      });
      socket.emit("agent:done", {
        runId,
        success: true,
        tool,
        result: execution.result
      });
    } catch (err) {
      logger.error({ err, tool, socketId: socket.id }, "Agent tool execution failed");
      socket.emit("agent:tool:error", { runId, tool, error: err.message });
      socket.emit("agent:done", { runId, success: false, error: err.message });
    }
  };

  socket.on("agent:tools:list", () => {
    socket.emit("agent:tools:list:reply", { tools: getAllTools() });
  });

  socket.on("agent:run", runAgentTool);

  socket.on("agent:confirm", async ({ token }) => {
    const pending = pendingConfirmations.get(token);
    if (!pending || pending.socketId !== socket.id) {
      socket.emit("agent:tool:error", {
        tool: "confirmation",
        error: "Confirmation request expired or not found"
      });
      return;
    }

    pendingConfirmations.delete(token);
    await runAgentTool({
      tool: pending.tool,
      params: pending.params,
      userId: pending.userId,
      sessionId: pending.sessionId,
      confirmationToken: token
    });
  });

  socket.on("agent:cancel", ({ token }) => {
    const pending = pendingConfirmations.get(token);
    if (pending?.socketId === socket.id) {
      pendingConfirmations.delete(token);
      socket.emit("agent:done", {
        success: false,
        error: "Agent action cancelled"
      });
    }
  });
};

export default agentEvents;
