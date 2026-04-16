import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";

const execFileAsync = promisify(execFile);
const SCREENSHOT_DIR = path.join(process.cwd(), "uploads", "screenshots");

const ensureDirectory = () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
};

const getScreenshotCommand = (targetPath) => {
  const escapedPath = targetPath.replace(/'/g, "'\"'\"'");
  
  switch (process.platform) {
    case "win32":
      return {
        cmd: "powershell.exe",
        args: [
          "-NoProfile",
          "-Command",
          [
            "Add-Type -AssemblyName System.Windows.Forms;",
            "Add-Type -AssemblyName System.Drawing;",
            "$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;",
            "$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;",
            "$graphics = [System.Drawing.Graphics]::FromImage($bitmap);",
            "$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);",
            `$bitmap.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png);`,
            "$graphics.Dispose();",
            "$bitmap.Dispose();",
            "Write-Output 'SCREENSHOT_OK'"
          ].join(" ")
        ],
        timeout: 15000,
        windowsHide: true
      };
    
    case "darwin":
      return {
        cmd: "screencapture",
        args: ["-x", "-t", "png", escapedPath],
        timeout: 10000
      };
    
    case "linux":
      return {
        cmd: "sh",
        args: ["-c", `gnome-screenshot -f "${escapedPath}" 2>/dev/null || scrot "${escapedPath}" 2>/dev/null || import -window root "${escapedPath}" 2>/dev/null || xwd -root -dump | convert xwd:- "${escapedPath}"`],
        timeout: 10000
      };
    
    default:
      throw new Error(`Screenshot not supported on platform: ${process.platform}`);
  }
};

const screenshotTool = {
  name: "screenshot",
  description: "Capture the current desktop screen to a PNG file",
  risk: "high",
  requiresConfirmation: true,
  readOnly: true,
  schema: {
    type: "object",
    properties: {
      monitor: {
        type: "integer",
        description: "Monitor index for multi-monitor setup (default: primary)",
        default: 0
      }
    }
  },
  validate(params = {}) {
    if (params.monitor !== undefined && (typeof params.monitor !== "number" || params.monitor < 0)) {
      return { valid: false, error: "monitor must be a non-negative integer" };
    }
    return {};
  },
  async execute(params = {}) {
    const platform = process.platform;
    const platformNames = {
      win32: "Windows",
      darwin: "macOS",
      linux: "Linux"
    };

    if (!["win32", "darwin", "linux"].includes(platform)) {
      throw new Error(`Screenshot not supported on platform: ${platform}`);
    }

    ensureDirectory();

    const fileName = `synapse-screen-${Date.now()}.png`;
    const targetPath = path.join(SCREENSHOT_DIR, fileName);
    
    const screenshotConfig = getScreenshotCommand(targetPath);
    
    try {
      await execFileAsync(screenshotConfig.cmd, screenshotConfig.args, {
        timeout: screenshotConfig.timeout,
        windowsHide: screenshotConfig.windowsHide
      });
    } catch (err) {
      const errorMsg = err.message || "";
      if (platform === "linux" && (errorMsg.includes("not found") || errorMsg.includes("enoent"))) {
        throw new Error(
          "No screenshot tool found on Linux. Install one of: gnome-screenshot, scrot, ImageMagick, or xwd"
        );
      }
      throw err;
    }

    if (!fs.existsSync(targetPath)) {
      throw new Error("Screenshot file was not created");
    }

    const stats = fs.statSync(targetPath);
    const imageUrl = `${process.env.BASE_URL || "http://localhost:3001"}/uploads/screenshots/${fileName}`;

    return {
      success: true,
      output: `Screenshot captured successfully on ${platformNames[platform]}.\nImage URL: ${imageUrl}\nFile size: ${(stats.size / 1024).toFixed(1)} KB`,
      metadata: {
        fileName,
        filePath: targetPath,
        imageUrl,
        fileSize: stats.size,
        platform: platformNames[platform]
      }
    };
  }
};

export default screenshotTool;
