import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const router = express.Router();

const EXECUTION_TIMEOUT = 15000;
const MAX_OUTPUT_SIZE = 512 * 1024;
const MAX_CODE_LENGTH = 50000;

const sanitizeCode = (code, language) => {
  if (!code || typeof code !== "string") return "";
  
  let sanitized = code.substring(0, MAX_CODE_LENGTH);
  
  const dangerousPatterns = [
    /import\s+os\s*/gi,
    /import\s+sys\s*/gi,
    /require\s*\(\s*['"]child_process['"]\s*\)/gi,
    /import\s+.*from\s+['"]child_process['"]/gi,
    /from\s+subprocess\s+import/gi,
    /os\.system/gi,
    /os\.popen/gi,
    /subprocess\./gi,
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /compile\s*\(/gi,
    /__import__/gi,
    /import\s+.*sys/gi,
    /process\.exit/gi,
    /process\.kill/gi,
    /child_process/gi,
    /require\s*\(\s*['"]fs['"]/gi,
    /import\s+.*from\s+['"]fs['"]/gi,
    /fs\.readFile/gi,
    /fs\.writeFile/gi,
    /require\s*\(\s*['"]net['"]/gi,
    /import\s+.*from\s+['"]net['"]/gi,
    /require\s*\(\s*['"]http['"]/gi,
    /import\s+.*from\s+['"]http['"]/gi,
    /require\s*\(\s*['"]https['"]/gi,
    /import\s+.*from\s+['"]https['"]/gi,
    /require\s*\(\s*['"]dns['"]/gi,
    /import\s+.*from\s+['"]dns['"]/gi,
    /while\s*\(\s*true\s*\)/gi,
    /while\s*\(\s*1\s*\)/gi,
    /for\s*\(\s*;\s*;\s*\)/gi,
  ];
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, "# [REMOVED BY SANDBOX]");
  }
  
  return sanitized;
};

const getLanguageConfig = (language) => {
  const configs = {
    python: { ext: "py", cmd: "python3", fallbackCmd: "python" },
    python3: { ext: "py", cmd: "python3" },
    py: { ext: "py", cmd: "python3", fallbackCmd: "python" },
    javascript: { ext: "js", cmd: "node" },
    js: { ext: "js", cmd: "node" },
    node: { ext: "js", cmd: "node" }
  };
  
  return configs[language?.toLowerCase()] || null;
};

router.post("/", async (req, res) => {
  const requestId = crypto.randomBytes(4).toString("hex");
  
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

    const sanitizedCode = sanitizeCode(code, language);
    const tmpDir = os.tmpdir();
    const filename = `sandbox_${requestId}_${Date.now()}.${langConfig.ext}`;
    const filepath = path.join(tmpDir, filename);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    try {
      fs.writeFileSync(filepath, sanitizedCode, { mode: 0o600 });
    } catch (writeErr) {
      console.error("Sandbox write error:", writeErr.message);
      return res.status(500).json({ error: "Failed to create sandbox file" });
    }

    const command = langConfig.cmd;
    const finalCommand = `${command} "${filepath}"`;

    console.log(`🔒 [${requestId}] Executing sandboxed code: ${language}`);

    await new Promise((resolve, reject) => {
      const proc = exec(finalCommand, {
        timeout: EXECUTION_TIMEOUT,
        maxBuffer: MAX_OUTPUT_SIZE,
        env: { ...process.env, NODE_ENV: "production" }
      }, (error, out, err) => {
        stdout = out || "";
        stderr = err || "";
        
        if (error) {
          if (error.killed) {
            timedOut = true;
            console.log(`⏱️  [${requestId}] Execution timed out after ${EXECUTION_TIMEOUT}ms`);
          }
        }
      });

      proc.on("error", (err) => {
        console.error(`❌ [${requestId}] Process error:`, err.message);
        reject(err);
      });

      setTimeout(() => {
        if (!proc.killed) {
          proc.kill("SIGTERM");
          timedOut = true;
        }
      }, EXECUTION_TIMEOUT);

      proc.on("exit", () => {
        cleanup();
        resolve();
      });

      function cleanup() {
        try {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    if (timedOut) {
      return res.json({ 
        output: stdout,
        error: `Execution timed out after ${EXECUTION_TIMEOUT / 1000} seconds`,
        timedOut: true
      });
    }

    if (stdout.length > MAX_OUTPUT_SIZE) {
      stdout = stdout.substring(0, MAX_OUTPUT_SIZE) + "\n... (output truncated)";
    }

    return res.json({ 
      output: stdout, 
      error: stderr || null,
      requestId
    });

  } catch (err) {
    console.error(`❌ [${requestId}] Sandbox error:`, err.message);
    return res.status(500).json({ error: "Sandbox execution failed" });
  }
});

router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
