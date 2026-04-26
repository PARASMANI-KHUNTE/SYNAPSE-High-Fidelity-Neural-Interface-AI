import path from "path";
import fs from "fs";
import { getProjectRoot } from "../tools/pathUtils.js";

const DEFAULT_TIMEOUT = 30000;
const MAX_OUTPUT_SIZE = 1024 * 1024;
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i, /del\s+\/f/i, /format/i,
  /\>\s*\/dev\/null/i,
  /\|\s*sh\b/i, /\|\s*bash\b/i,
  /curl.*\|\s*sh/i, /wget.*\|\s*sh/i,
  /::\$\(/i, /\)\$\(/i,
  /eval\s+/i, /exec\s+/i,
  /child_process/i, /require\s*\(\s*['"]\s*child_process/i
];

const DANGEROUS_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".ps1", ".sh", ".bash", ".vbs", ".js"]);

export const isPathAllowed = (inputPath, rootDir) => {
  try {
    const resolved = path.resolve(String(inputPath || ""));
    const root = path.resolve(rootDir || getProjectRoot());
    
    if (!resolved.startsWith(root)) {
      return { allowed: false, reason: "Path outside project directory", resolved };
    }
    
    const normalized = path.normalize(resolved);
    if (normalized.includes("..")) {
      return { allowed: false, reason: "Path traversal detected", resolved };
    }
    
    return { allowed: true, resolved };
  } catch (err) {
    return { allowed: false, reason: err.message };
  }
};

export const isFileAllowed = (inputPath, rootDir) => {
  const pathCheck = isPathAllowed(inputPath, rootDir);
  if (!pathCheck.allowed) return pathCheck;
  
  const ext = path.extname(pathCheck.resolved).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { allowed: false, reason: `File extension ${ext} is blocked`, resolved: pathCheck.resolved };
  }
  
  return pathCheck;
};

export const sanitizeCommand = (command) => {
  const cmd = String(command || "").trim();
  const lower = cmd.toLowerCase();
  
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(lower)) {
      throw new Error(`Command contains blocked pattern: ${pattern}`);
    }
  }
  
  if (cmd.length > 500) {
    throw new Error("Command too long");
  }
  
  return cmd;
};

export const createSandboxContext = (customRoot) => {
  const rootDir = customRoot || getProjectRoot();
  
  return {
    root: rootDir,
    allowed: true,
    
    checkPath: (inputPath) => isPathAllowed(inputPath, rootDir),
    
    checkFile: (inputPath) => isFileAllowed(inputPath, rootDir),
    
    sanitize: (command) => sanitizeCommand(command),
    
    checkTimeout: (provided) => {
      const timeout = Number(provided) || DEFAULT_TIMEOUT;
      if (timeout > 120000) {
        throw new Error("Timeout exceeds maximum allowed (120s)");
      }
      return timeout;
    },
    
    checkOutputSize: (output) => {
      const size = String(output || "").length;
      if (size > MAX_OUTPUT_SIZE) {
        return { truncated: true, size, truncatedAt: MAX_OUTPUT_SIZE };
      }
      return { truncated: false, size };
    },

    log: (event, details) => {
      console.log(`[Sandbox] ${event}:`, {
        timestamp: new Date().toISOString(),
        ...details
      });
    }
  };
};

const createSandbox = (customRoot) => {
  const ctx = createSandboxContext(customRoot);
  
  return {
    ...ctx,
    
    executeFileRead: async (filePath) => {
      const check = ctx.checkFile(filePath);
      if (!check.allowed) {
        throw new Error(`File access denied: ${check.reason}`);
      }
      
      if (!fs.existsSync(check.resolved)) {
        throw new Error("File not found");
      }
      
      const stat = fs.statSync(check.resolved);
      if (stat.size > MAX_OUTPUT_SIZE) {
        throw new Error("File too large to read");
      }
      
      ctx.log("file:read", { path: check.resolved, size: stat.size });
      return fs.readFileSync(check.resolved, "utf-8");
    },
    
    executeFileList: async (dirPath) => {
      const check = ctx.checkPath(dirPath);
      if (!check.allowed) {
        throw new Error(`Directory access denied: ${check.reason}`);
      }
      
      if (!fs.existsSync(check.resolved)) {
        throw new Error("Directory not found");
      }
      
      const stat = fs.statSync(check.resolved);
      if (!stat.isDirectory()) {
        throw new Error("Path is not a directory");
      }
      
      ctx.log("dir:list", { path: check.resolved });
      const entries = fs.readdirSync(check.resolved, { withFileTypes: true });
      
      return entries.slice(0, 100).map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        size: entry.isFile() ? fs.statSync(path.join(check.resolved, entry.name)).size : 0
      }));
    },
    
    executeTerminal: async (command, options = {}) => {
      const sanitized = ctx.sanitize(command);
      const timeout = ctx.checkTimeout(options.timeout);
      
      ctx.log("terminal:execute", { command: sanitized, timeout });
      
      return {
        sanitized,
        timeout,
        allowed: true,
        note: "Command will be executed through tool executor"
      };
    }
  };
};

export default {
  isPathAllowed,
  isFileAllowed,
  sanitizeCommand,
  createSandboxContext,
  createSandbox
};