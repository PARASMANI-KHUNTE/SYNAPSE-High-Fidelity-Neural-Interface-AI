import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const SCREENSHOT_DIR = path.join(process.cwd(), "uploads", "screenshots");

const ensureDirectory = () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
};

const buildScreenshotCommand = (targetPath) => [
  "-NoProfile",
  "-Command",
  [
    "Add-Type -AssemblyName System.Windows.Forms;",
    "Add-Type -AssemblyName System.Drawing;",
    "$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;",
    "$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;",
    "$graphics = [System.Drawing.Graphics]::FromImage($bitmap);",
    "$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);",
    `$bitmap.Save('${targetPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png);`,
    "$graphics.Dispose();",
    "$bitmap.Dispose();"
  ].join(" ")
];

const screenshotTool = {
  name: "screenshot",
  description: "Capture the current desktop screen to a PNG file",
  risk: "high",
  requiresConfirmation: true,
  readOnly: true,
  schema: {},
  validate() {
    return {};
  },
  async execute() {
    if (process.platform !== "win32") {
      throw new Error("Screenshot capture is currently implemented for Windows only");
    }

    ensureDirectory();

    const fileName = `synapse-screen-${Date.now()}.png`;
    const targetPath = path.join(SCREENSHOT_DIR, fileName);
    const args = buildScreenshotCommand(targetPath);

    await execFileAsync("powershell.exe", args, {
      timeout: 15000,
      windowsHide: true
    });

    const imageUrl = `${process.env.BASE_URL || "http://localhost:3001"}/uploads/screenshots/${fileName}`;

    return {
      success: true,
      output: `Screenshot captured successfully.\nImage URL: ${imageUrl}`,
      metadata: {
        fileName,
        filePath: targetPath,
        imageUrl
      }
    };
  }
};

export default screenshotTool;
