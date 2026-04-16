import { execFile } from "child_process";
import { promisify } from "util";
import { getProjectRoot } from "./pathUtils.js";

const execFileAsync = promisify(execFile);

const SAFE_SUBCOMMANDS = new Set(["status", "branch", "log", "diff", "stash", "stash list", "remote", "remote -v"]);

const COMMAND_MAP = {
  pwd: {
    command: process.platform === "win32" ? "powershell" : "pwd",
    args: process.platform === "win32" ? ["-NoProfile", "-Command", "Get-Location | Select-Object -ExpandProperty Path"] : [],
    readOnly: true
  },
  ls: {
    command: process.platform === "win32" ? "powershell" : "ls",
    args: process.platform === "win32" ? ["-NoProfile", "-Command", "Get-ChildItem -Force | Select-Object Name, Mode, Length"] : ["-la"],
    readOnly: true
  },
  "ls -la": {
    command: process.platform === "win32" ? "powershell" : "ls",
    args: process.platform === "win32" ? ["-NoProfile", "-Command", "Get-ChildItem -Force | Select-Object Name, Mode, Length, LastWriteTime"] : ["-la"],
    readOnly: true
  },
  "ls -l": {
    command: process.platform === "win32" ? "powershell" : "ls",
    args: process.platform === "win32" ? ["-NoProfile", "-Command", "Get-ChildItem -Force | Select-Object Name, Mode, Length"] : ["-l"],
    readOnly: true
  },
  cat: {
    command: process.platform === "win32" ? "powershell" : "cat",
    buildArgs: (target) =>
      process.platform === "win32"
        ? ["-NoProfile", "-Command", `Get-Content -Raw -- '${target.replace(/'/g, "''")}'`]
        : [target],
    readOnly: true
  },
  head: {
    command: process.platform === "win32" ? "powershell" : "head",
    buildArgs: (args) => {
      const parts = args.trim().split(/\s+/);
      const n = parts[0] || 10;
      const file = parts[1] || "";
      return process.platform === "win32"
        ? ["-NoProfile", "-Command", `(Get-Content -Path '${file.replace(/'/g, "''")}' -Head ${n}) -join [System.Environment]::NewLine`]
        : ["-" + n, file];
    },
    readOnly: true
  },
  tail: {
    command: process.platform === "win32" ? "powershell" : "tail",
    buildArgs: (args) => {
      const parts = args.trim().split(/\s+/);
      const n = parts[0] || 10;
      const file = parts[1] || "";
      return process.platform === "win32"
        ? ["-NoProfile", "-Command", `(Get-Content -Path '${file.replace(/'/g, "''")}' -Tail ${n}) -join [System.Environment]::NewLine`]
        : ["-" + n, file];
    },
    readOnly: true
  },
  echo: {
    command: process.platform === "win32" ? "powershell" : "echo",
    buildArgs: (text) =>
      process.platform === "win32"
        ? ["-NoProfile", "-Command", `Write-Output '${text.replace(/'/g, "''")}'`]
        : [text],
    readOnly: false
  },
  "node --version": {
    command: "node",
    args: ["--version"],
    readOnly: true
  },
  "node -v": {
    command: "node",
    args: ["-v"],
    readOnly: true
  },
  "npm --version": {
    command: "npm",
    args: ["--version"],
    readOnly: true
  },
  "npm list": {
    command: "npm",
    args: ["list", "--depth=0"],
    readOnly: true
  },
  "npm list --depth=1": {
    command: "npm",
    args: ["list", "--depth=1"],
    readOnly: true
  },
  "npm test": {
    command: "npm",
    args: ["test"],
    requiresConfirmation: true,
    readOnly: false
  },
  "npm run build": {
    command: "npm",
    args: ["run", "build"],
    requiresConfirmation: true,
    readOnly: false
  },
  "npm run dev": {
    command: "npm",
    args: ["run", "dev"],
    requiresConfirmation: true,
    readOnly: false
  },
  "npm install": {
    command: "npm",
    args: ["install"],
    requiresConfirmation: true,
    readOnly: false
  },
  "npm ci": {
    command: "npm",
    args: ["ci"],
    requiresConfirmation: true,
    readOnly: false
  },
  git: {
    command: "git",
    buildArgs: (subcommand = "status") => {
      const sub = subcommand.trim().toLowerCase();
      if (!SAFE_SUBCOMMANDS.has(sub)) {
        throw new Error(`Git subcommand not allowed: ${subcommand}. Allowed: ${[...SAFE_SUBCOMMANDS].join(", ")}`);
      }
      if (sub === "status") return ["status", "--short"];
      if (sub === "branch") return ["branch", "--show-current"];
      if (sub === "log") return ["log", "--oneline", "-10"];
      if (sub === "stash") return ["stash", "list"];
      if (sub === "remote") return ["remote", "-v"];
      return ["diff", "--stat", "HEAD"];
    },
    readOnly: true
  },
  grep: {
    command: process.platform === "win32" ? "powershell" : "grep",
    buildArgs: (args) => {
      const parts = args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      if (parts.length < 2) {
        throw new Error("grep requires at least 2 arguments: pattern and file");
      }
      const pattern = parts[0];
      const file = parts.slice(1).join(" ");
      return process.platform === "win32"
        ? ["-NoProfile", "-Command", `Select-String -Path '${file.replace(/'/g, "''")}' -Pattern '${pattern.replace(/'/g, "''")}' | ForEach-Object { $_.LineNumber.ToString() + ':' + $_.Line }`]
        : ["-n", pattern, file];
    },
    readOnly: true
  },
  wc: {
    command: process.platform === "win32" ? "powershell" : "wc",
    buildArgs: (file) => {
      if (!file) throw new Error("wc requires a file argument");
      return process.platform === "win32"
        ? ["-NoProfile", "-Command", `(Get-Content '${file.replace(/'/g, "''")}' | Measure-Object -Line -Word -Character).Lines.ToString() + ' lines ' + (Get-Content '${file.replace(/'/g, "''")}' | Measure-Object -Word).Words.ToString() + ' words'`]
        : ["-l", file];
    },
    readOnly: true
  },
  find: {
    command: process.platform === "win32" ? "powershell" : "find",
    buildArgs: (args) => {
      const parts = args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      if (parts.length < 2) {
        throw new Error("find requires 2 arguments: pattern and path");
      }
      const pattern = parts[0];
      const targetPath = parts.slice(1).join(" ");
      return process.platform === "win32"
        ? ["-NoProfile", "-Command", `Get-ChildItem -Path '${targetPath.replace(/'/g, "''")}' -Recurse -File | Select-String -Pattern '${pattern.replace(/'/g, "''")}' | Select-Object -First 20 | ForEach-Object { $_.Path }`]
        : ["-name", pattern, targetPath];
    },
    readOnly: true
  },
  du: {
    command: process.platform === "win32" ? "powershell" : "du",
    buildArgs: (path = ".") => {
      return process.platform === "win32"
        ? ["-NoProfile", "-Command", `Get-ChildItem -Path '${path.replace(/'/g, "''")}' -Recurse -File | Measure-Object -Property Length -Sum | ForEach-Object { [math]::Round($_.Sum / 1MB, 2).ToString() + ' MB total' }`]
        : ["-sh", path || "."];
    },
    readOnly: true
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

  if (command.startsWith("head ")) {
    const parts = command.slice(5).trim().split(/\s+/);
    return { key: "head", value: parts.join(" ") };
  }

  if (command.startsWith("tail ")) {
    const parts = command.slice(5).trim().split(/\s+/);
    return { key: "tail", value: parts.join(" ") };
  }

  if (command.startsWith("echo ")) {
    return { key: "echo", value: command.slice(5) };
  }

  if (command.startsWith("grep ")) {
    return { key: "grep", value: command.slice(5) };
  }

  if (command.startsWith("wc ")) {
    return { key: "wc", value: command.slice(3).trim() };
  }

  if (command.startsWith("find ")) {
    return { key: "find", value: command.slice(5) };
  }

  if (command.startsWith("du ")) {
    const parts = command.slice(3).trim().split(/\s+/);
    return { key: "du", value: parts.join(" ") || "." };
  }

  if (command.startsWith("git ")) {
    return { key: "git", value: command.slice(4).trim() };
  }

  if (COMMAND_MAP[command]) {
    return { key: command, value: "" };
  }

  throw new Error(`Command not in allowlist: ${command}`);
};

const terminalTool = {
  name: "terminal",
  description: "Run allowlisted shell commands for project management, git, file inspection, and npm scripts",
  risk: "high",
  requiresConfirmation: false,
  readOnly: false,
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        required: true,
        description: `Allowlisted commands: pwd, ls [-la|-l], cat <file>, head [-n] <file>, tail [-n] <file>, echo <text>, grep <pattern> <file>, wc <file>, find <pattern> <path>, du [path], node [-v|--version], npm [--version|list|test|run build|run dev|install|ci], git [status|branch|log|diff|stash|remote -v]`
      }
    }
  },
  validate(params = {}) {
    const command = String(params.command || "").trim();
    if (!command) {
      return { valid: false, error: "command is required" };
    }
    try {
      parseCommand(command);
      return { valid: true, command };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  },
  async execute(params = {}, context = {}) {
    const { command } = terminalTool.validate(params);
    const parsed = parseCommand(command);
    const entry = COMMAND_MAP[parsed.key];
    const cwd = context.projectRoot || getProjectRoot();
    const args = entry.buildArgs ? entry.buildArgs(parsed.value) : (entry.args || []);
    
    const timeout = entry.requiresConfirmation ? 60000 : 10000;
    
    const { stdout, stderr } = await execFileAsync(entry.command, args, {
      cwd,
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 5
    });

    return {
      success: true,
      output: stdout.trim() || "(no output)",
      error: stderr?.trim() || null,
      metadata: {
        command,
        cwd,
        readOnly: entry.readOnly !== false,
        requiresConfirmation: entry.requiresConfirmation || false
      }
    };
  }
};

export default terminalTool;
