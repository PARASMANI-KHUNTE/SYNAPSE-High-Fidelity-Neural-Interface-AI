const normalizePath = (input = "") =>
  String(input || "")
    .trim()
    .replace(/^["']|["']$/g, "");

const buildSingleTaskPlan = (tool, params, message, summary, extras = {}) => ({
  isAgentic: true,
  summary,
  tasks: [
    {
      tool,
      params,
      order: 0,
      parallel: false
    }
  ],
  originalMessage: message,
  ...extras
});

export const decompose = async ({ message = "" } = {}) => {
  const trimmed = String(message || "").trim();
  const lowered = trimmed.toLowerCase();

  if (!trimmed) {
    return { isAgentic: false, tasks: [] };
  }

  if (/\b(git status|show git status|check git status)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("git", { action: "status" }, trimmed, "Inspecting git status");
  }

  if (/\b(what branch am i on|current branch|git branch|show branch)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("git", { action: "branch" }, trimmed, "Inspecting current git branch");
  }

  if (/\b(git log|recent commits|last commits)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("git", { action: "log" }, trimmed, "Inspecting recent git history");
  }

  if (/\b(git diff|diff stat|show diff)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("git", { action: "diff" }, trimmed, "Inspecting git diff summary");
  }

  if (/\b(analyze|describe|inspect|explain|what(?:'s| is) on)\b.*\b(screen|screenshot|display|desktop)\b/i.test(trimmed)) {
    return buildSingleTaskPlan(
      "screenshot",
      {},
      trimmed,
      "Capturing screen for vision analysis",
      { analysisMode: "vision" }
    );
  }

  if (/\b(system status|machine status|system health|show system status|show machine status)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("process", { action: "status" }, trimmed, "Inspecting local machine status");
  }

  if (/\b(memory usage|ram usage|how much memory|system memory)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("process", { action: "status" }, trimmed, "Inspecting local memory usage");
  }

  if (/\b(take (a )?screenshot|capture (the )?screen|screen capture|snapshot my screen)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("screenshot", {}, trimmed, "Preparing secure screen capture");
  }

  const browserMatch = trimmed.match(/^(?:open|fetch|read|summarize|inspect)\s+(?:website|webpage|page|url)\s+(.+)$/i);
  if (browserMatch) {
    return buildSingleTaskPlan(
      "browser",
      { url: normalizePath(browserMatch[1]) },
      trimmed,
      "Fetching web page content"
    );
  }

  const listMatch = trimmed.match(/^(?:list|show)\s+(?:files|folders|entries)(?:\s+in)?\s+(.+)$/i);
  if (listMatch) {
    return buildSingleTaskPlan(
      "filesystem",
      { action: "list", path: normalizePath(listMatch[1]) },
      trimmed,
      "Listing project files"
    );
  }

  const writeMatch = trimmed.match(/^(?:write|create)\s+file\s+(.+?)\s*:\s*([\s\S]+)$/i);
  if (writeMatch) {
    return buildSingleTaskPlan(
      "filesystem",
      {
        action: "write",
        path: normalizePath(writeMatch[1]),
        content: writeMatch[2]
      },
      trimmed,
      "Preparing file write inside the project"
    );
  }

  const appendMatch = trimmed.match(/^(?:append|add to)\s+file\s+(.+?)\s*:\s*([\s\S]+)$/i);
  if (appendMatch) {
    return buildSingleTaskPlan(
      "filesystem",
      {
        action: "append",
        path: normalizePath(appendMatch[1]),
        content: appendMatch[2]
      },
      trimmed,
      "Preparing file append inside the project"
    );
  }

  const mkdirMatch = trimmed.match(/^(?:make|create)\s+(?:folder|directory)\s+(.+)$/i);
  if (mkdirMatch) {
    return buildSingleTaskPlan(
      "filesystem",
      {
        action: "mkdir",
        path: normalizePath(mkdirMatch[1])
      },
      trimmed,
      "Preparing directory creation inside the project"
    );
  }

  const readMatch = trimmed.match(/^(?:read|show)\s+file\s+(.+)$/i);
  if (readMatch) {
    return buildSingleTaskPlan(
      "filesystem",
      { action: "read", path: normalizePath(readMatch[1]) },
      trimmed,
      "Reading project file"
    );
  }

  const statMatch = trimmed.match(/^(?:stat|inspect)\s+file\s+(.+)$/i);
  if (statMatch) {
    return buildSingleTaskPlan(
      "filesystem",
      { action: "stat", path: normalizePath(statMatch[1]) },
      trimmed,
      "Inspecting project file metadata"
    );
  }

  if (/^(?:pwd|where am i|current directory)$/i.test(trimmed)) {
    return buildSingleTaskPlan("terminal", { command: "pwd" }, trimmed, "Checking working directory");
  }

  if (/^(?:ls|dir|list directory)$/i.test(trimmed)) {
    return buildSingleTaskPlan("terminal", { command: "ls" }, trimmed, "Listing current directory");
  }

  if (/\b(node version|node --version|check node version)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("terminal", { command: "node --version" }, trimmed, "Checking Node.js version");
  }

  if (/\b(npm list|list npm packages|installed packages)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("terminal", { command: "npm list" }, trimmed, "Inspecting installed npm packages");
  }

  if (/\b(run tests|npm test|test this project)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("terminal", { command: "npm test" }, trimmed, "Preparing project test run");
  }

  if (/\b(run build|npm run build|build this project)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("terminal", { command: "npm run build" }, trimmed, "Preparing project build");
  }

  if (/\b(start dev server|run dev server|npm run dev)\b/i.test(trimmed)) {
    return buildSingleTaskPlan("terminal", { command: "npm run dev" }, trimmed, "Preparing development server start");
  }

  const catMatch = trimmed.match(/^(?:cat|show contents of)\s+(.+)$/i);
  if (catMatch) {
    return buildSingleTaskPlan(
      "terminal",
      { command: `cat ${normalizePath(catMatch[1])}` },
      trimmed,
      "Reading file through terminal tool"
    );
  }

  return {
    isAgentic: false,
    tasks: []
  };
};

export default { decompose };
