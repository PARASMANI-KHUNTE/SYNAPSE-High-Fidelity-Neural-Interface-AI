import { execFile } from "child_process";
import { promisify } from "util";
import logger from "../../utils/logger.js";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();

export default class GitWatcher {
  constructor(options = {}) {
    this.name = "git-watcher";
    this.interval = options.interval || 300000; // 5 minutes
    this.lastTriggered = 0;
  }

  async check() {
    try {
      const { stdout } = await execFileAsync("git", ["status", "--short"], {
        cwd: PROJECT_ROOT,
        timeout: 5000,
        windowsHide: true,
      });

      const changes = stdout.trim();
      if (changes) {
        const lines = changes.split("\n").length;
        return {
          id: "git_changes",
          type: "monitoring",
          label: "Git Activity",
          message: `Detected ${lines} uncommitted file(s) in the repository.`,
          priority: "low"
        };
      }
      return null;
    } catch (err) {
      logger.warn({ err: err.message }, "GitWatcher failed to check status");
      return null;
    }
  }
}
