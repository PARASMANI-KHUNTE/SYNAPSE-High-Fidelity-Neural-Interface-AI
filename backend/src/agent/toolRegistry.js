import browserTool from "../tools/browser.js";
import gitTool from "../tools/git.js";
import filesystemTool from "../tools/filesystem.js";
import processTool from "../tools/process.js";
import screenshotTool from "../tools/screenshot.js";
import terminalTool from "../tools/terminal.js";

const tools = new Map();

const registerTool = (tool) => {
  if (!tool?.name) {
    throw new Error("Tool registration requires a name");
  }

  tools.set(tool.name, tool);
  return tool;
};

registerTool(browserTool);
registerTool(gitTool);
registerTool(filesystemTool);
registerTool(processTool);
registerTool(screenshotTool);
registerTool(terminalTool);

export const getTool = (name) => tools.get(String(name || "").trim());

export const getAllTools = () => Array.from(tools.values()).map((tool) => ({
  name: tool.name,
  description: tool.description,
  risk: tool.risk,
  requiresConfirmation: tool.requiresConfirmation,
  readOnly: tool.readOnly
}));

export { registerTool };

export default {
  getTool,
  getAllTools,
  registerTool
};
