import express from "express";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { promisify } from "util";
import config from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const execFileAsync = promisify(execFile);
const EXECUTION_TIMEOUT = config.sandbox.timeoutMs;
const MAX_OUTPUT_SIZE = 512 * 1024;
const MAX_CODE_LENGTH = 50000;

const sanitizeCode = (code, language) => {
  if (!code || typeof code !== "string") return "";

  let sanitized = code.substring(0, MAX_CODE_LENGTH);
  
  const commonDangerousPatterns = [
    /process\.exit\s*\(/gi,
    /process\.kill\s*\(/gi,
    /\bexit\s*\(\s*\)/gi,
    /\bsys\.exit\s*\(/gi,
    /\bquit\s*\(/gi,
    /__import__\s*\(/gi,
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /compile\s*\(/gi,
    /open\s*\([^)]*['"]\/etc/gi,
    /open\s*\([^)]*['"]\/root/gi,
    /open\s*\([^)]*['"]\/home/gi,
    /with\s+open\s*\([^)]*['"]\/etc/gi,
    /with\s+open\s*\([^)]*['"]\/root/gi,
    /with\s+open\s*\([^)]*['"]\/home/gi,
    /\.\.\//g,
    /<\s*script/gi,
    /<\s*\?php/gi,
    /<\s*%/gi,
    /\bcurl\s+/gi,
    /\bwget\s+/gi,
    /socket\s*\./gi,
    /connect\s*\(\s*['"][^'"]*:22/gi,
    /0x[0-9a-f]+:\/\//gi,
  ];

  const jsDangerousPatterns = [
    /require\s*\(\s*['"]child_process['"]\s*\)/gi,
    /require\s*\(\s*['"]fs['"]\s*\)/gi,
    /require\s*\(\s*['"](net|http|https|dns|tls|dgram|perf_hooks|inspector|trace_events)['"]\s*\)/gi,
    /import\s+.*from\s+['"]child_process['"]/gi,
    /import\s+.*from\s+['"]fs['"]/gi,
    /import\s+.*from\s+['"](net|http|https|dns|tls|dgram|perf_hooks|inspector|trace_events)['"]/gi,
    /child_process/gi,
    /fetch\s*\(\s*['"]http/gi,
    /XMLHttpRequest/gi,
    /globalThis\.(process|require|module)/gi,
    /global\[/gi,
    /Function\(/gi,
    /new\s+Function\s*\(/gi,
    /eval\s*\(/gi,
  ];

  const pythonDangerousPatterns = [
    /from\s+subprocess\s+import/gi,
    /import\s+subprocess/gi,
    /os\.system\s*\(/gi,
    /os\.popen\s*\(/gi,
    /os\.spawn/gi,
    /subprocess\./gi,
    /import\s+os/gi,
    /import\s+sys/gi,
    /__import__\s*\(/gi,
    /importlib\./gi,
    /exec\s*\(/gi,
    /compile\s*\(/gi,
    /eval\s*\(/gi,
    /open\s*\([^)]*\)/gi,
    /with\s+open\s*\(/gi,
    /urllib\s*\./gi,
    /requests\s*\./gi,
    /httpx\s*\./gi,
    /socket\s*\./gi,
    /pickle\s*\./gi,
    /marshal\s*\./gi,
    /pty\s*\./gi,
    /tty\s*\./gi,
    /termios\s*\./gi,
    /resource\s*\./gi,
    /multiprocessing\s*\./gi,
    /ctypes\s*\./gi,
    /pwn\s*\./gi,
    /socket\s*\./gi,
    /struct\s*\.\w+\s*\(/gi,
    /os\.chdir\s*\(/gi,
    /os\.chmod\s*\(/gi,
    /os\.chown\s*\(/gi,
    /os\.link\s*\(/gi,
    /os\.mkdir\s*\(/gi,
    /os\.mknod\s*\(/gi,
    /os\.remove\s*\(/gi,
    /os\.rename\s*\(/gi,
    /os\.rmdir\s*\(/gi,
    /os\.symlink\s*\(/gi,
    /os\.unlink\s*\(/gi,
    /os\.utime\s*\(/gi,
  ];

  const patterns = [...commonDangerousPatterns];
  
  if (language === "javascript" || language === "js" || language === "node") {
    patterns.push(...jsDangerousPatterns);
  } else if (language === "python" || language === "python3" || language === "py") {
    patterns.push(...pythonDangerousPatterns);
  }

  const commentReplacement = (language && /py/i.test(language)) ? "# [BLOCKED]" : "// [BLOCKED]";
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, commentReplacement);
  }

  const commentsWithCode = [
    /#.*(?:import|require|exec|eval|system|subprocess)/gi,
    /\/\/.*(?:require|fetch|child_process|exec|eval)/gi,
    /#.*(?:curl|wget|chmod|chown|sudo|passwd|shadow)/gi,
  ];
  
  for (const pattern of commentsWithCode) {
    sanitized = sanitized.replace(pattern, (match) => {
      const prefix = match.match(/^(\s*#|\s*\/\/)/)?.[0] || "";
      return prefix + " [CODE BLOCKED IN COMMENT]";
    });
  }

  return sanitized;
};

const getLanguageConfig = (language) => {
  const key = String(language || "").toLowerCase();
  const configs = {
    javascript: { ext: "js", command: "node" },
    js: { ext: "js", command: "node" },
    node: { ext: "js", command: "node" }
  };
  return configs[key] || null;
};

const IS_PRODUCTION = config.app.nodeEnv === "production";
const ENFORCE_DOCKER = config.sandbox.enabled && IS_PRODUCTION;

const runSandboxFileLocally = ({ command, filepath, options = {} }) =>
  new Promise((resolve, reject) => {
    let timedOut = false;

    const proc = execFile(command, [filepath], {
      timeout: EXECUTION_TIMEOUT,
      maxBuffer: MAX_OUTPUT_SIZE,
      env: {
        PATH: process.env.PATH || "",
        NODE_ENV: "production",
        PYTHONUTF8: "1",
        HOME: os.tmpdir(),
        TMPDIR: os.tmpdir(),
        TEMP: os.tmpdir(),
        TMP: os.tmpdir(),
        ...(options.env || {})
      },
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.killed || error.signal === "SIGTERM" || /timed out/i.test(error.message)) {
          timedOut = true;
        } else if (error.code === "ENOENT") {
          reject(new Error(`${command} is not installed or not in PATH`));
          return;
        }
      }

      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        timedOut
      });
    });

    proc.on("error", (err) => reject(err));
  });

const runSandboxInDocker = async ({ filepath, requestId }) => {
  const seccompArgs =
    config.sandbox.seccompProfile && config.sandbox.seccompProfile !== "default"
      ? ["--security-opt", `seccomp=${config.sandbox.seccompProfile}`]
      : [];

  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--pids-limit",
    String(config.sandbox.pidsLimit),
    "--cpus",
    String(config.sandbox.cpuLimit),
    "--memory",
    config.sandbox.memoryLimit,
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=16m",
    ...seccompArgs,
    "-v",
    `${filepath}:/sandbox/main.js:ro`,
    config.sandbox.dockerImage,
    "node",
    "/sandbox/main.js"
  ];

  try {
    const { stdout, stderr } = await execFileAsync("docker", dockerArgs, {
      timeout: EXECUTION_TIMEOUT,
      maxBuffer: MAX_OUTPUT_SIZE,
      windowsHide: true
    });
    return {
      stdout: stdout || "",
      stderr: stderr || "",
      timedOut: false,
      mode: "docker"
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Docker not installed or not available in PATH");
    }
    if (error.killed || /timed out/i.test(error.message)) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        timedOut: true,
        mode: "docker"
      };
    }
    throw new Error(`Sandbox docker execution failed (${requestId}): ${error.stderr || error.message}`);
  }
};

router.post("/", requireAuth, async (req, res) => {
  const requestId = crypto.randomBytes(4).toString("hex");
  let filepath = "";

  try {
    const { code, language } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code is required and must be a string" });
    }

    if (!language || typeof language !== "string") {
      return res.status(400).json({ error: "Language is required" });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return res.status(400).json({ error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters` });
    }

    const langConfig = getLanguageConfig(language);
    if (!langConfig) {
      return res.status(400).json({
        error: "Sandbox only supports JavaScript execution",
        supported: ["javascript", "js", "node"],
        note: "Python execution is not available in this sandbox environment"
      });
    }

    const sanitizedCode = sanitizeCode(code, language);
    const filename = `sandbox_${requestId}_${Date.now()}.${langConfig.ext}`;
    filepath = path.join(os.tmpdir(), filename);
    
    if (!fs.existsSync(os.tmpdir())) {
      fs.mkdirSync(os.tmpdir(), { recursive: true });
    }
    fs.writeFileSync(filepath, sanitizedCode, { mode: 0o600 });

    console.log(`[Sandbox:${requestId}] Executing ${language} with ${langConfig.command}`);

    const result = config.sandbox.enabled
      ? await runSandboxInDocker({ filepath, requestId })
      : await runSandboxFileLocally({
        command: langConfig.command,
        filepath,
        options: { env: { PATH: process.env.SYSTEMROOT || "" } }
      });

    const output = result.stdout.length > MAX_OUTPUT_SIZE
      ? `${result.stdout.substring(0, MAX_OUTPUT_SIZE)}\n... (output truncated)`
      : result.stdout;

    return res.json({
      output,
      error: result.stderr || null,
      timedOut: result.timedOut,
      requestId,
      mode: result.mode || "local"
    });
  } catch (err) {
    console.error(`[Sandbox:${requestId}] Error:`, err);
    return res.status(500).json({ error: "Sandbox execution failed" });
  } finally {
    if (filepath) {
      fs.unlink(filepath, () => {});
    }
  }
});

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    language: "javascript",
    sandbox: {
      enabled: config.sandbox.enabled,
      enforceDocker: ENFORCE_DOCKER,
      dockerImage: config.sandbox.dockerImage
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
