import { useMemo, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, ChevronUp, Loader2, ShieldAlert, Terminal, XCircle } from "lucide-react";

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
    return ["browser", "git", "filesystem", "screenshot", "terminal"];
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
      className="transition-all duration-300 w-full warm-card overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setIsMinimized(!isMinimized)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-surface-soft)] transition-colors rounded-t-2xl"
      >
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          <Terminal size={14} style={{ color: 'var(--color-primary)' }} />
          Console
        </span>
        <ChevronDown 
          size={14} 
          style={{ color: 'var(--color-text-muted)', transform: isMinimized ? "rotate(180deg)" : "rotate(0deg)", transition: 'transform 0.2s' }} 
        />
      </button>

      {!isMinimized && (
        <div className="px-4 pb-4">
          <div className="pt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span style={{ color: 'var(--color-text-primary)' }}>Tool</span>
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="px-3 py-2.5 text-sm outline-none rounded-xl"
                  style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', border: '1px solid var(--color-background-soft)' }}
                >
                  {toolOptions.map((toolName) => (
                    <option key={toolName} value={toolName}>
                      {toolName}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTool === "git" && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span style={{ color: 'var(--color-text-primary)' }}>Action</span>
                  <select
                    value={gitAction}
                    onChange={(e) => setGitAction(e.target.value)}
                    className="px-3 py-2.5 text-sm outline-none rounded-xl"
                    style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', border: '1px solid var(--color-background-soft)' }}
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
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span style={{ color: 'var(--color-text-primary)' }}>Action</span>
                    <select
                      value={filesystemAction}
                      onChange={(e) => setFilesystemAction(e.target.value)}
                      className="px-3 py-2.5 text-sm outline-none rounded-xl"
                      style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', border: '1px solid var(--color-background-soft)' }}
                    >
                      <option value="list">list</option>
                      <option value="read">read</option>
                      <option value="stat">stat</option>
                      <option value="write">write</option>
                      <option value="append">append</option>
                      <option value="mkdir">mkdir</option>
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1.5 text-sm">
                    <span style={{ color: 'var(--color-text-primary)' }}>Path</span>
                    <input
                      value={filesystemPath}
                      onChange={(e) => setFilesystemPath(e.target.value)}
                      className="px-3 py-2.5 text-sm outline-none rounded-xl"
                      style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', border: '1px solid var(--color-background-soft)' }}
                    />
                  </label>
                  {(filesystemAction === "write" || filesystemAction === "append") && (
                    <label className="col-span-2 flex flex-col gap-1.5 text-sm">
                      <span style={{ color: 'var(--color-text-primary)' }}>Content</span>
                      <textarea
                        value={filesystemContent}
                        onChange={(e) => setFilesystemContent(e.target.value)}
                        rows={4}
                        className="px-3 py-2.5 text-sm outline-none rounded-xl resize-none font-mono"
                        style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', border: '1px solid var(--color-primary)30' }}
                      />
                    </label>
                  )}
                </>
              )}

              {selectedTool === "browser" && (
                <label className="col-span-2 flex flex-col gap-1.5 text-sm">
                  <span style={{ color: 'var(--color-text-primary)' }}>URL</span>
                  <input
                    value={browserUrl}
                    onChange={(e) => setBrowserUrl(e.target.value)}
                    className="px-3 py-2.5 text-sm outline-none rounded-xl"
                    style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', border: '1px solid var(--color-background-soft)' }}
                  />
                </label>
              )}
            </div>

            {selectedTool === "process" && (
              <div className="px-3 py-2.5 text-sm rounded-xl" style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-muted)' }}>
                Status action - read only
              </div>
            )}

            {selectedTool === "screenshot" && (
              <div className="px-3 py-2.5 text-sm rounded-xl" style={{ background: 'var(--color-warning)15', color: 'var(--color-warning)' }}>
                Screen capture - requires confirmation
              </div>
            )}

            {selectedTool === "terminal" && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span style={{ color: 'var(--color-text-primary)' }}>Command</span>
                <input
                  value={terminalCommand}
                  onChange={(e) => setTerminalCommand(e.target.value)}
                  className="px-3 py-2.5 text-sm outline-none rounded-xl font-mono"
                  style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', border: '1px solid var(--color-background-soft)' }}
                />
                <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Safe: pwd, ls, node --version, npm list
                </div>
                <div className="text-xs" style={{ color: 'var(--color-warning)' }}>
                  Requires confirmation: npm test, npm run build, npm run dev
                </div>
              </label>
            )}

            <button
              type="button"
              onClick={handleRun}
              disabled={!isConnected}
              className="w-full px-3 py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
              }}
            >
              Run Tool
            </button>

            {pendingConfirmation && (
              <div className="p-3 flex flex-col gap-3 rounded-xl" style={{ background: 'var(--color-warning)15', border: '1px solid var(--color-warning)30' }}>
                <div className="flex items-start gap-3">
                  <ShieldAlert size={16} style={{ color: 'var(--color-warning)' }} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Permission Required
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {pendingConfirmation.tool} - Risk: {pendingConfirmation.risk}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onConfirm(pendingConfirmation.token)}
                    className="flex-1 px-3 py-2 text-sm font-medium rounded-xl transition-colors"
                    style={{ background: 'var(--color-success)15', color: 'var(--color-success)', border: '1px solid var(--color-success)30' }}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancel(pendingConfirmation.token)}
                    className="flex-1 px-3 py-2 text-sm font-medium rounded-xl transition-colors"
                    style={{ background: 'var(--color-error)15', color: 'var(--color-error)', border: '1px solid var(--color-error)30' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 mt-2" style={{ borderTop: '1px solid var(--color-background-soft)', paddingTop: '12px' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Events
                </div>
                {onClearEvents && events.length > 0 && (
                  <button onClick={onClearEvents} className="text-xs hover:text-[var(--color-primary)] transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                    Clear
                  </button>
                )}
              </div>
              <div
                className="p-3 h-40 overflow-y-auto flex flex-col gap-2 rounded-xl hide-scrollbar"
                style={{ background: 'var(--color-surface-soft)' }}
              >
                {events.length === 0 ? (
                  <div className="text-sm text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
                    No events
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="p-2.5 rounded-lg"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-background-soft)' }}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        {event.type === "thinking" && <Bot size={10} style={{ color: 'var(--color-primary)' }} />}
                        {event.type === "start" && <Loader2 size={10} className="animate-spin" style={{ color: 'var(--color-primary)' }} />}
                        {event.type === "result" && <CheckCircle2 size={10} style={{ color: 'var(--color-success)' }} />}
                        {event.type === "error" && <XCircle size={10} style={{ color: 'var(--color-error)' }} />}
                        <span className="font-medium" style={{ color: event.type === "error" ? 'var(--color-error)' : 'var(--color-text-primary)' }}>
                          {event.type}
                        </span>
                      </div>
                      <pre
                        className="mt-1 text-xs whitespace-pre-wrap break-words"
                        style={{ color: 'var(--color-text-secondary)' }}
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
