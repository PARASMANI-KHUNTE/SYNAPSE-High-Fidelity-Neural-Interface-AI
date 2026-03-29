import { getSystemStatus } from "../services/systemStatus.js";

const ACTIONS = new Set(["status"]);

const processTool = {
  name: "process",
  description: "Inspect local machine status and repository state",
  risk: "low",
  requiresConfirmation: false,
  readOnly: true,
  schema: {
    action: { type: "string", required: true }
  },
  validate(params = {}) {
    const action = String(params.action || "").trim().toLowerCase();

    if (!ACTIONS.has(action)) {
      throw new Error(`Unsupported process action: ${action}`);
    }

    return { action };
  },
  async execute(params = {}) {
    const { action } = processTool.validate(params);
    const status = await getSystemStatus();

    return {
      success: true,
      output: [
        `Memory used: ${status.memory.usedPercent}%`,
        `Memory footprint: ${Math.round(status.memory.usedBytes / (1024 ** 3) * 10) / 10} GB / ${Math.round(status.memory.totalBytes / (1024 ** 3) * 10) / 10} GB`,
        `Logical cores: ${status.system.cpuCount}`,
        `Uptime: ${Math.round(status.system.uptimeSeconds / 60)} minutes`,
        `Platform: ${status.system.platform}`,
        `Git branch: ${status.repo.branch}`,
        `Last commit: ${status.repo.lastCommit}`
      ].join("\n"),
      metadata: {
        action,
        status
      }
    };
  }
};

export default processTool;
