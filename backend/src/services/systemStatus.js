import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function runGit(args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: process.cwd(),
      timeout: 5000,
      windowsHide: true
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function getSystemStatus() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  const [gitBranch, lastCommit] = await Promise.all([
    runGit(["branch", "--show-current"]),
    runGit(["log", "--oneline", "-1"])
  ]);

  return {
    system: {
      platform: os.platform(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      loadAverage: os.loadavg(),
      cpuCount: os.cpus().length
    },
    memory: {
      totalBytes: totalMemory,
      freeBytes: freeMemory,
      usedBytes: usedMemory,
      usedPercent: totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0
    },
    repo: {
      branch: gitBranch || "unknown",
      lastCommit: lastCommit || "No git history available"
    },
    timestamp: new Date().toISOString()
  };
}
