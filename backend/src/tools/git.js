import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();

const COMMANDS = {
  status: ["status", "--short"],
  branch: ["branch", "--show-current"],
  log: ["log", "--oneline", "-10"],
  diff: ["diff", "--stat", "HEAD"]
};

const normalizeOutput = (stdout) => stdout.trim() || "(no output)";

const gitTool = {
  name: "git",
  description: "Inspect the current repository state safely",
  risk: "low",
  requiresConfirmation: false,
  readOnly: true,
  schema: {
    action: { type: "string", required: true }
  },
  validate(params = {}) {
    const action = String(params.action || "").trim().toLowerCase();
    if (!COMMANDS[action]) {
      throw new Error(`Unsupported git action: ${action}`);
    }

    return { action };
  },
  async execute(params = {}, context = {}) {
    const { action } = gitTool.validate(params);
    const cwd = context.projectRoot || PROJECT_ROOT;
    const args = COMMANDS[action];
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });

    return {
      success: true,
      output: normalizeOutput(stdout),
      error: stderr?.trim() || null,
      metadata: {
        action,
        cwd
      }
    };
  }
};

export default gitTool;
