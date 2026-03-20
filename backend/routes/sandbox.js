import express from "express";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const router = express.Router();

router.post("/", async (req, res) => {
  const { code, language } = req.body;
  
  if (!code || !language) {
    return res.status(400).json({ error: "Code and language are required." });
  }

  // Create a temporary file
  const tmpDir = os.tmpdir();
  const ext = language === "python" ? "py" : language === "javascript" || language === "js" ? "js" : null;
  
  if (!ext) {
    return res.status(400).json({ error: "Language not supported for execution. Only python and javascript allowed." });
  }

  const filename = `sandbox_${Date.now()}.${ext}`;
  const filepath = path.join(tmpDir, filename);

  try {
    fs.writeFileSync(filepath, code);
    
    // Determine command
    const command = ext === "py" ? `python "${filepath}"` : `node "${filepath}"`;
    
    // Execute securely within 10-second timeout
    exec(command, { timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(filepath); } catch (e) {}

      if (error) {
        return res.json({ output: stdout, error: stderr || error.message });
      }
      
      return res.json({ output: stdout, error: stderr });
    });
  } catch (err) {
    console.error("Sandbox Write Error:", err);
    res.status(500).json({ error: "Failed to allocate temporary sandbox file." });
  }
});

export default router;
