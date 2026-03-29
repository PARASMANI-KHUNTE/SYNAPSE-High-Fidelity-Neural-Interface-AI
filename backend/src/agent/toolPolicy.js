const DENY_LIST = new Set([
  "terminal:rm",
  "terminal:del",
  "terminal:format"
]);

const CONFIRMABLE_RISKS = new Set(["high"]);
const CRITICAL_RISKS = new Set(["critical"]);
const READ_ONLY_FILESYSTEM_ACTIONS = new Set(["read", "list", "stat"]);
const WRITE_FILESYSTEM_ACTIONS = new Set(["write", "append", "mkdir"]);
const READ_ONLY_TERMINAL_COMMANDS = new Set(["pwd", "ls", "node --version", "npm list"]);
const CONFIRMABLE_TERMINAL_COMMANDS = new Set(["npm test", "npm run build", "npm run dev"]);

export const evaluateToolPolicy = ({ tool, params = {}, userContext = {} }) => {
  if (!tool) {
    return { decision: "deny", reason: "Tool not found" };
  }

  const denyKey = `${tool.name}:${String(params?.action || params?.command || "").toLowerCase()}`;
  if (DENY_LIST.has(denyKey)) {
    return { decision: "deny", reason: "Action is deny-listed" };
  }

  if (tool.name === "filesystem") {
    const action = String(params?.action || "").toLowerCase();
    if (READ_ONLY_FILESYSTEM_ACTIONS.has(action)) {
      return { decision: "allow", reason: "Read-only filesystem action" };
    }
    if (WRITE_FILESYSTEM_ACTIONS.has(action)) {
      return { decision: "confirm", reason: "Filesystem write action requires confirmation" };
    }
  }

  if (tool.name === "terminal") {
    const command = String(params?.command || "").toLowerCase().trim();
    if (READ_ONLY_TERMINAL_COMMANDS.has(command) || command.startsWith("cat ") || command.startsWith("echo ") || command.startsWith("git ")) {
      return { decision: "allow", reason: "Read-only terminal action" };
    }
    if (CONFIRMABLE_TERMINAL_COMMANDS.has(command)) {
      return { decision: "confirm", reason: "Terminal execution action requires confirmation" };
    }
  }

  if (tool.requiresConfirmation || CONFIRMABLE_RISKS.has(tool.risk)) {
    return { decision: "confirm", reason: "Tool requires user confirmation" };
  }

  if (tool.readOnly || tool.risk === "low") {
    return { decision: "allow", reason: "Read-only tool" };
  }

  if (tool.risk === "medium") {
    return { decision: "allow", reason: "Medium-risk tool allowed with audit logging" };
  }

  if (CRITICAL_RISKS.has(tool.risk)) {
    if (userContext?.criticalOverride === true) {
      return { decision: "confirm", reason: "Critical tool requires explicit confirmation" };
    }
    return { decision: "deny", reason: "Critical-risk tool requires explicit override" };
  }

  return { decision: "allow", reason: "Default allow" };
};

export default { evaluateToolPolicy };
