import fs from "fs/promises";
import path from "path";
import { resolveProjectPath, getProjectRoot } from "./pathUtils.js";

const ACTIONS = new Set(["read", "list", "stat", "write", "append", "mkdir"]);

const formatDirent = (entry) => ({
  name: entry.name,
  type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other"
});

const filesystemTool = {
  name: "filesystem",
  description: "Read and modify files inside the project root with scoped safety checks",
  risk: "high",
  requiresConfirmation: true,
  readOnly: false,
  schema: {
    action: { type: "string", required: true },
    path: { type: "string", required: false, default: "." },
    content: { type: "string", required: false, default: "" }
  },
  validate(params = {}) {
    const action = String(params.action || "").trim().toLowerCase();
    if (!ACTIONS.has(action)) {
      throw new Error(`Unsupported filesystem action: ${action}`);
    }

    const targetPath = String(params.path || ".").trim() || ".";
    return {
      action,
      path: targetPath,
      content: typeof params.content === "string" ? params.content : ""
    };
  },
  async execute(params = {}, context = {}) {
    const { action, path: targetPath, content } = filesystemTool.validate(params);
    const projectRoot = context.projectRoot || getProjectRoot();
    const resolvedPath = resolveProjectPath(path.relative(getProjectRoot(), path.resolve(projectRoot, targetPath)));

    if (action === "read") {
      const content = await fs.readFile(resolvedPath, "utf8");
      return {
        success: true,
        output: content,
        error: null,
        metadata: {
          action,
          path: resolvedPath
        }
      };
    }

    if (action === "list") {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      return {
        success: true,
        output: entries.map(formatDirent),
        error: null,
        metadata: {
          action,
          path: resolvedPath
        }
      };
    }

    if (action === "write") {
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, content, "utf8");
      return {
        success: true,
        output: `Wrote ${content.length} characters to ${resolvedPath}`,
        error: null,
        metadata: {
          action,
          path: resolvedPath,
          bytesWritten: Buffer.byteLength(content, "utf8")
        }
      };
    }

    if (action === "append") {
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.appendFile(resolvedPath, content, "utf8");
      return {
        success: true,
        output: `Appended ${content.length} characters to ${resolvedPath}`,
        error: null,
        metadata: {
          action,
          path: resolvedPath,
          bytesWritten: Buffer.byteLength(content, "utf8")
        }
      };
    }

    if (action === "mkdir") {
      await fs.mkdir(resolvedPath, { recursive: true });
      return {
        success: true,
        output: `Created directory ${resolvedPath}`,
        error: null,
        metadata: {
          action,
          path: resolvedPath
        }
      };
    }

    const stats = await fs.stat(resolvedPath);
    return {
      success: true,
      output: {
        path: resolvedPath,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        modifiedAt: stats.mtime.toISOString()
      },
      error: null,
      metadata: {
        action,
        path: resolvedPath
      }
    };
  }
};

export default filesystemTool;
