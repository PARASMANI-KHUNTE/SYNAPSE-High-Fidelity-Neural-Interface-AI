import { execFile } from "child_process";
import { promisify } from "util";
import { getProjectRoot } from "./pathUtils.js";

const execFileAsync = promisify(execFile);

const COMMAND_MAP = {
  pwd: {
    command: process.platform === "win32" ? "powershell" : "pwd",
    args: process.platform === "win32" ? ["-NoProfile", "-Command", "Get-Location | Select-Object -ExpandProperty Path"] : []
  },
  ls: {
    command: process.platform === "win32" ? "powershell" : "ls",
    args: process.platform === "win32" ? ["-NoProfile", "-Command", "Get-ChildItem -Force | Select-Object Name, Mode, Length"] : ["-la"]
  },
  cat: {
    command: process.platform === "win32" ? "powershell" : "cat",
    buildArgs: (target) =>
      process.platform === "win32"
        ? ["-NoProfile", "-Command", `Get-Content -Raw -- '${target.replace(/'/g, "''")}'`]
        : [target]
  },
  echo: {
    command: process.platform === "win32" ? "powershell" : "echo",
    buildArgs: (text) =>
      process.platform === "win32"
        ? ["-NoProfile", "-Command", `Write-Output '${text.replace(/'/g, "''")}'`]
        : [text]
  },
  "node --version": {
    command: "node",
    args: ["--version"]
  },
  "npm list": {
    command: "npm",
    args: ["list", "--depth=0"]
  },
  "npm test": {
    command: "npm",
    args: ["test"]
  },
  "npm run build": {
    command: "npm",
    args: ["run", "build"]
  },
  "npm run dev": {
    command: "npm",
    args: ["run", "dev"]
  },
  git: {
    command: "git",
    buildArgs: (subcommand = "status") => {
      const allowedSubcommands = new Set(["status", "branch", "log", "diff"]);
      if (!allowedSubcommands.has(subcommand)) {
        throw new Error(`Git subcommand not allowed: ${subcommand}`);
      }
      return subcommand === "status"
        ? ["status", "--short"]
        : subcommand === "branch"
          ? ["branch", "--show-current"]
          : subcommand === "log"
            ? ["log", "--oneline", "-10"]
            : ["diff", "--stat", "HEAD"];
    }
  }
};

const parseCommand = (input = "") => {
  const command = String(input || "").trim();
  if (!command) {
    throw new Error("Terminal command is required");
  }

  if (command.startsWith("cat ")) {
    return { key: "cat", value: command.slice(4).trim() };
  }

  if (command.startsWith("echo ")) {
    return { key: "echo", value: command.slice(5) };
  }

  if (command.startsWith("git ")) {
    return { key: "git", value: command.slice(4).trim().split(/\s+/)[0] };
  }

  if (COMMAND_MAP[command]) {
    return { key: command, value: "" };
  }

  throw new Error(`Command not in allowlist: ${command}`);
};

const terminalTool = {
  name: "terminal",
  description: "Run a tightly allowlisted set of project-local shell commands",
  risk: "high",
  requiresConfirmation: true,
  readOnly: false,
  schema: {
    command: { type: "string", required: true }
  },
  validate(params = {}) {
    return {
      command: String(params.command || "").trim()
    };
  },
  async execute(params = {}, context = {}) {
    const { command } = terminalTool.validate(params);
    const parsed = parseCommand(command);
    const entry = COMMAND_MAP[parsed.key];
    const cwd = context.projectRoot || getProjectRoot();
    const args = entry.buildArgs ? entry.buildArgs(parsed.value) : (entry.args || []);
    const { stdout, stderr } = await execFileAsync(entry.command, args, {
      cwd,
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });

    return {
      success: true,
      output: stdout.trim() || "(no output)",
      error: stderr?.trim() || null,
      metadata: {
        command,
        cwd
      }
    };
  }
};

export default terminalTool;
