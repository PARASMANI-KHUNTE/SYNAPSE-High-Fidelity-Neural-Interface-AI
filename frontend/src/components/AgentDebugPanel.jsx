import { useMemo, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Loader2, ShieldAlert, TerminalSquare, XCircle, Terminal } from "lucide-react";

const DEFAULT_GIT_ACTION = "branch";
const DEFAULT_FILESYSTEM_ACTION = "list";
const DEFAULT_FILESYSTEM_PATH = "src";
const DEFAULT_FILESYSTEM_CONTENT = "";
const DEFAULT_BROWSER_URL = "https://example.com";
const DEFAULT_TERMINAL_COMMAND = "node --version";

const formatPayload = (value) => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export default function AgentDebugPanel({
  isConnected,
  tools,
  events,
  pendingConfirmation,
  onRunTool,
  onConfirm,
  onCancel,
  onClearEvents
}) {
  const [selectedTool, setSelectedTool] = useState("git");
  const [gitAction, setGitAction] = useState(DEFAULT_GIT_ACTION);
  const [filesystemAction, setFilesystemAction] = useState(DEFAULT_FILESYSTEM_ACTION);
  const [filesystemPath, setFilesystemPath] = useState(DEFAULT_FILESYSTEM_PATH);
  const [filesystemContent, setFilesystemContent] = useState(DEFAULT_FILESYSTEM_CONTENT);
  const [browserUrl, setBrowserUrl] = useState(DEFAULT_BROWSER_URL);
  const [terminalCommand, setTerminalCommand] = useState(DEFAULT_TERMINAL_COMMAND);
  const [isMinimized, setIsMinimized] = useState(true);

  const toolOptions = useMemo(() => {
    if (tools && tools.length > 0) {
      return tools.map((tool) => tool.name);
    }
    return ["browser", "git", "filesystem", "process", "screenshot", "terminal"];
  }, [tools]);

  const handleRun = () => {
    if (selectedTool === "git") {
      onRunTool("git", { action: gitAction });
      return;
    }

    if (selectedTool === "filesystem") {
      onRunTool("filesystem", {
        action: filesystemAction,
        path: filesystemPath,
        content: filesystemContent
      });
      return;
    }

    if (selectedTool === "browser") {
      onRunTool("browser", { url: browserUrl });
      return;
    }

    if (selectedTool === "process") {
      onRunTool("process", { action: "status" });
      return;
    }

    if (selectedTool === "screenshot") {
      onRunTool("screenshot", {});
      return;
    }

    onRunTool("terminal", { command: terminalCommand });
  };

  return (
    <div
      className={`font-mono transition-all duration-300 w-full hud-panel flex flex-col bg-transparent`}
    >
      <button
        type="button"
        onClick={() => setIsMinimized(!isMinimized)}
        className="px-3 py-2 flex items-center justify-between hover:bg-[rgba(0,240,255,0.05)] transition-colors text-[10px] uppercase font-bold text-[var(--color-cyan)]"
      >
        <span className="flex items-center gap-2">
          <Terminal size={12} />
          {isMinimized ? "SYS_CONSOLE" : "CONSOLE_ACTV"}
        </span>
        <ChevronDown 
          size={14} 
          className={`transition-transform duration-300 ${isMinimized ? "rotate-180" : ""}`} 
        />
      </button>

      {!isMinimized && (
        <div className="px-4 pb-4">
          <div className="pt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-[#94a3b8]">
                AGENT_TOOL
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="px-2 py-1.5 text-[10px] outline-none border border-[var(--color-tactical-blue)] bg-[rgba(10,17,32,0.9)] text-white font-mono focus:border-[var(--color-cyan)]"
                >
                  {toolOptions.map((toolName) => (
                    <option key={toolName} value={toolName}>
                      {toolName}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTool === "git" && (
                <label className="flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-[#94a3b8]">
                  ACTION
                  <select
                    value={gitAction}
                    onChange={(e) => setGitAction(e.target.value)}
                    className="px-2 py-1.5 text-[10px] outline-none border border-[var(--color-tactical-blue)] bg-[rgba(10,17,32,0.9)] text-white font-mono focus:border-[var(--color-cyan)]"
                  >
                    <option value="branch">branch</option>
                    <option value="status">status</option>
                    <option value="log">log</option>
                    <option value="diff">diff</option>
                  </select>
                </label>
              )}

              {selectedTool === "filesystem" && (
                <>
                  <label className="flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-[#94a3b8]">
                    ACTION
                    <select
                      value={filesystemAction}
                      onChange={(e) => setFilesystemAction(e.target.value)}
                      className="px-2 py-1.5 text-[10px] outline-none border border-[var(--color-tactical-blue)] bg-[rgba(10,17,32,0.9)] text-white font-mono focus:border-[var(--color-cyan)]"
                    >
                      <option value="list">list</option>
                      <option value="read">read</option>
                      <option value="stat">stat</option>
                      <option value="write">write</option>
                      <option value="append">append</option>
                      <option value="mkdir">mkdir</option>
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-[#94a3b8]">
                    TARGET_PATH
                    <input
                      value={filesystemPath}
                      onChange={(e) => setFilesystemPath(e.target.value)}
                      className="px-2 py-1.5 text-[10px] outline-none border border-[var(--color-tactical-blue)] bg-[rgba(10,17,32,0.9)] text-white font-mono focus:border-[var(--color-cyan)]"
                    />
                  </label>
                  {(filesystemAction === "write" || filesystemAction === "append") && (
                    <label className="col-span-2 flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-[#94a3b8]">
                      FILE_CONTENT
                      <textarea
                        value={filesystemContent}
                        onChange={(e) => setFilesystemContent(e.target.value)}
                        rows={4}
                        className="px-2 py-1.5 text-[10px] outline-none border border-[var(--color-neon-orange)] bg-[rgba(10,17,32,0.9)] text-white font-mono focus:border-[var(--color-cyan)]"
                      />
                    </label>
                  )}
                </>
              )}

              {selectedTool === "browser" && (
                <label className="col-span-2 flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-[#94a3b8]">
                  TARGET_URL
                  <input
                    value={browserUrl}
                    onChange={(e) => setBrowserUrl(e.target.value)}
                    className="px-2 py-1.5 text-[10px] outline-none border border-[var(--color-tactical-blue)] bg-[rgba(10,17,32,0.9)] text-white font-mono focus:border-[var(--color-cyan)]"
                  />
                </label>
              )}
            </div>

            {selectedTool === "process" && (
              <div className="px-3 py-2 text-[9px] uppercase tracking-widest border border-[var(--color-tactical-blue)] bg-[rgba(10,17,32,0.9)] text-[#94a3b8]">
                STATUS_ACTION // read-only machine snapshot
              </div>
            )}

            {selectedTool === "screenshot" && (
              <div className="px-3 py-2 text-[9px] uppercase tracking-widest border border-[var(--color-neon-orange)] bg-[rgba(255,144,0,0.08)] text-[#fdba74]">
                SCREEN_CAPTURE // confirmation required
              </div>
            )}

            {selectedTool === "terminal" && (
              <label className="flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-[#94a3b8]">
                CMD_EXEC
                <input
                  value={terminalCommand}
                  onChange={(e) => setTerminalCommand(e.target.value)}
                  className="px-2 py-1.5 text-[10px] outline-none border border-[var(--color-tactical-blue)] bg-[rgba(10,17,32,0.9)] text-white font-mono focus:border-[var(--color-cyan)]"
                />
                <div className="mt-1 text-[9px]" style={{ color: "#94a3b8" }}>
                  Safe inspect: `pwd`, `ls`, `node --version`, `npm list`
                </div>
                <div className="text-[9px]" style={{ color: "#fdba74" }}>
                  Confirmation-gated: `npm test`, `npm run build`, `npm run dev`
                </div>
              </label>
            )}

            <button
              type="button"
              onClick={handleRun}
              disabled={!isConnected}
              className="w-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 border border-[var(--color-cyan)] text-[var(--color-cyan)] hover:bg-[var(--color-cyan)] hover:text-black bg-[rgba(0,240,255,0.1)] shadow-[0_0_10px_rgba(0,240,255,0.2)]"
            >
              [ EXEC_TOOL ]
            </button>

            {pendingConfirmation && (
              <div className="p-3 flex flex-col gap-3 border border-[var(--color-neon-orange)] bg-[rgba(255,144,0,0.1)] relative">
                <div className="flex items-start gap-3">
                  <ShieldAlert size={14} className="text-[var(--color-neon-orange)] mt-0.5 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-[var(--color-neon-orange)] uppercase tracking-widest">
                      PERM_REQ_DETECTED
                    </div>
                    <div className="text-[8px] mt-1 text-slate-300 uppercase tracking-widest">
                      {pendingConfirmation.tool} // RISK:{pendingConfirmation.risk}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onConfirm(pendingConfirmation.token)}
                    className="flex-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-[#4ade80] text-[#4ade80] bg-[rgba(74,222,128,0.1)] hover:bg-[#4ade80] hover:text-black transition-colors"
                  >
                    AUTH
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancel(pendingConfirmation.token)}
                    className="flex-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-[var(--color-neon-red)] text-[var(--color-neon-red)] bg-[rgba(255,42,42,0.1)] hover:bg-[var(--color-neon-red)] hover:text-white transition-colors"
                  >
                    DENY
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex items-center justify-between border-t border-dashed border-[var(--color-tactical-blue)] pt-2">
                <div className="text-[9px] uppercase tracking-widest text-[#94a3b8]">
                  SYS_EVENTS
                </div>
                {onClearEvents && events.length > 0 && (
                  <button onClick={onClearEvents} className="text-[8px] text-slate-500 hover:text-[var(--color-neon-red)] uppercase">
                    [CLEAR]
                  </button>
                )}
              </div>
              <div
                className="p-2 h-48 overflow-y-auto flex flex-col gap-1 bg-[rgba(0,0,0,0.6)] border border-[var(--color-tactical-blue)] hide-scrollbar"
              >
                {events.length === 0 ? (
                  <div className="text-[9px] text-slate-600 uppercase tracking-widest text-center mt-4">
                    [ NO_EVENTS_LOGGED ]
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="p-1.5 border-l-2 border-[var(--color-tactical-blue)] bg-[rgba(30,58,138,0.1)]"
                    >
                      <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-widest text-[#94a3b8]">
                        {event.type === "thinking" && <Bot size={10} />}
                        {event.type === "start" && <Loader2 size={10} className="animate-spin" />}
                        {event.type === "result" && <CheckCircle2 size={10} className="text-[#4ade80]" />}
                        {event.type === "error" && <XCircle size={10} className="text-[var(--color-neon-red)]" />}
                        <span className={event.type === "error" ? "text-[var(--color-neon-red)]" : "text-[var(--color-cyan)]"}>
                          {" >> "} {event.type}
                        </span>
                      </div>
                      <pre
                        className="mt-1 text-[9px] whitespace-pre-wrap break-words text-[#e2e8f0]"
                      >
                        {formatPayload(event.payload)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
