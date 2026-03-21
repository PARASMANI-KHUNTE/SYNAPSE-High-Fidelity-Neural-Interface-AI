import express from "express";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const router = express.Router();

const EXECUTION_TIMEOUT = 15000;
const MAX_OUTPUT_SIZE = 512 * 1024;
const MAX_CODE_LENGTH = 50000;

const sanitizeCode = (code) => {
  if (!code || typeof code !== "string") return "";

  let sanitized = code.substring(0, MAX_CODE_LENGTH);
  const dangerousPatterns = [
    /require\s*\(\s*['"]child_process['"]\s*\)/gi,
    /import\s+.*from\s+['"]child_process['"]/gi,
    /from\s+subprocess\s+import/gi,
    /os\.system/gi,
    /os\.popen/gi,
    /subprocess\./gi,
    /process\.exit/gi,
    /process\.kill/gi,
    /child_process/gi,
    /require\s*\(\s*['"]fs['"]\s*\)/gi,
    /import\s+.*from\s+['"]fs['"]/gi,
    /fs\.(readFile|writeFile|unlink|rm|rmdir|mkdir)/gi,
    /require\s*\(\s*['"](net|http|https|dns|tls|dgram)['"]\s*\)/gi,
    /import\s+.*from\s+['"](net|http|https|dns|tls|dgram)['"]/gi,
    /while\s*\(\s*(true|1)\s*\)/gi,
    /for\s*\(\s*;\s*;\s*\)/gi
  ];

  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, "// [REMOVED BY SANDBOX]");
  }

  return sanitized;
};

const getLanguageConfig = (language) => {
  const key = String(language || "").toLowerCase();
  const configs = {
    python: { ext: "py", command: process.platform === "win32" ? "python" : "python3" },
    python3: { ext: "py", command: process.platform === "win32" ? "python" : "python3" },
    py: { ext: "py", command: process.platform === "win32" ? "python" : "python3" },
    javascript: { ext: "js", command: "node" },
    js: { ext: "js", command: "node" },
    node: { ext: "js", command: "node" }
  };
  return configs[key] || null;
};

const runSandboxFile = ({ command, filepath }) =>
  new Promise((resolve, reject) => {
    let timedOut = false;

    const proc = execFile(command, [filepath], {
      timeout: EXECUTION_TIMEOUT,
      maxBuffer: MAX_OUTPUT_SIZE,
      env: { ...process.env, NODE_ENV: "production", PYTHONUTF8: "1" },
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

router.post("/", async (req, res) => {
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
        error: "Language not supported for execution",
        supported: ["python", "python3", "javascript", "js", "node"]
      });
    }

    const sanitizedCode = sanitizeCode(code);
    const filename = `sandbox_${requestId}_${Date.now()}.${langConfig.ext}`;
    filepath = path.join(os.tmpdir(), filename);
    fs.writeFileSync(filepath, sanitizedCode, { mode: 0o600 });

    console.log(`[Sandbox:${requestId}] Executing ${language} with ${langConfig.command}`);

    const result = await runSandboxFile({
      command: langConfig.command,
      filepath
    });

    const output = result.stdout.length > MAX_OUTPUT_SIZE
      ? `${result.stdout.substring(0, MAX_OUTPUT_SIZE)}\n... (output truncated)`
      : result.stdout;

    return res.json({
      output,
      error: result.stderr || null,
      timedOut: result.timedOut,
      requestId
    });
  } catch (err) {
    console.error(`[Sandbox:${requestId}] Error:`, err.message);
    return res.status(500).json({ error: err.message || "Sandbox execution failed" });
  } finally {
    if (filepath) {
      fs.unlink(filepath, () => {});
    }
  }
});

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    supported: ["python", "javascript"],
    timestamp: new Date().toISOString()
  });
});

export default router;
