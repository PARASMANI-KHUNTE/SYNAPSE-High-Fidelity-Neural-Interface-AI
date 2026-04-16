import { useState, useEffect, useRef } from "react";
import { TerminalSquare, ChevronDown, ChevronUp, Copy, Check, Trash2, AlertTriangle, Loader2, CheckCircle2, XCircle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const EVENT_COLORS = {
  start: { bg: "var(--color-primary)10", border: "var(--color-primary)30", text: "var(--color-primary)" },
  thinking: { bg: "var(--color-warning)10", border: "var(--color-warning)30", text: "var(--color-warning)" },
  tool: { bg: "#8b5cf610", border: "#8b5cf630", text: "#8b5cf6" },
  result: { bg: "var(--color-success)10", border: "var(--color-success)30", text: "var(--color-success)" },
  done: { bg: "var(--color-success)10", border: "var(--color-success)30", text: "var(--color-success)" },
  error: { bg: "var(--color-error)10", border: "var(--color-error)30", text: "var(--color-error)" },
  confirmation: { bg: "var(--color-warning)10", border: "var(--color-warning)30", text: "var(--color-warning)" },
};

const EventIcon = ({ type }) => {
  const iconProps = { size: 12 };
  switch (type) {
    case "start": return <Zap {...iconProps} />;
    case "thinking": return <Loader2 {...iconProps} className="animate-spin" />;
    case "tool": return <TerminalSquare {...iconProps} />;
    case "result": return <CheckCircle2 {...iconProps} />;
    case "done": return <Check {...iconProps} />;
    case "error": return <XCircle {...iconProps} />;
    case "confirmation": return <AlertTriangle {...iconProps} />;
    default: return <TerminalSquare {...iconProps} />;
  }
};

export default function AgentConsole({ isOpen, agentEvents = [], pendingConfirmation = null }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const bottomRef = useRef(null);

  const filteredEvents = filter === "all" 
    ? agentEvents 
    : agentEvents.filter(e => e.type === filter);

  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentEvents, isOpen]);

  const handleCopy = (event, id) => {
    const text = typeof event === "string" ? event : JSON.stringify(event, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "--:--:--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-background-soft)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ borderBottom: "1px solid var(--color-background-soft)", background: "var(--color-surface-soft)" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <TerminalSquare size={14} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            Agent Console
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--color-primary)15", color: "var(--color-primary)" }}
          >
            {agentEvents.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingConfirmation && (
            <span
              className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
              style={{ background: "var(--color-warning)15", color: "var(--color-warning)" }}
            >
              <AlertTriangle size={10} />
              Awaiting
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1 rounded-lg hover:bg-[var(--color-background-soft)] transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--color-background-soft)" }}>
              {["all", "start", "thinking", "tool", "result", "error"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-2 py-1 text-xs rounded-lg transition-colors capitalize"
                  style={{
                    background: filter === f ? "var(--color-primary)" : "transparent",
                    color: filter === f ? "white" : "var(--color-text-muted)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div
              className="overflow-auto hide-scrollbar"
              style={{ maxHeight: "300px", minHeight: "150px" }}
            >
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <TerminalSquare size={20} style={{ color: "var(--color-text-muted)" }} />
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    No agent activity yet
                  </span>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredEvents.map((event, idx) => {
                    const colors = EVENT_COLORS[event.type] || EVENT_COLORS.result;
                    const id = `${event.type}-${idx}-${event.timestamp}`;
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2 p-2 rounded-lg text-xs"
                        style={{ background: colors.bg, borderLeft: `2px solid ${colors.border}` }}
                      >
                        <span style={{ color: colors.text }} className="mt-0.5">
                          <EventIcon type={event.type} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium capitalize" style={{ color: colors.text }}>
                              {event.type}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                              {formatTime(event.timestamp)}
                            </span>
                          </div>
                          <p
                            className="truncate font-mono"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            {event.message || event.description || JSON.stringify(event.data)?.slice(0, 100)}
                          </p>
                          {event.data && typeof event.data === "object" && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                                View details
                              </summary>
                              <pre
                                className="mt-1 p-2 rounded text-[10px] overflow-auto"
                                style={{
                                  background: "var(--color-background)",
                                  maxHeight: "100px",
                                  fontSize: "10px"
                                }}
                              >
                                {JSON.stringify(event.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                        <button
                          onClick={() => handleCopy(event, id)}
                          className="p-1 rounded hover:bg-[var(--color-background-soft)] transition-colors shrink-0"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {copiedId === id ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                      </motion.div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {agentEvents.length > 0 && (
              <div
                className="flex items-center justify-between px-3 py-2 border-t"
                style={{ borderColor: "var(--color-background-soft)" }}
              >
                <button
                  onClick={() => {}}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-background-soft)] transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <Trash2 size={10} />
                  Clear
                </button>
                <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {pendingConfirmation && (
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: "var(--color-warning)30", background: "var(--color-warning)10" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: "var(--color-warning)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--color-warning)" }}>
              Confirmation Required
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
            {pendingConfirmation.message || "A tool requires your approval to proceed."}
          </p>
          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
              style={{ background: "var(--color-success)", color: "white" }}
            >
              Allow
            </button>
            <button
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
              style={{ background: "var(--color-error)", color: "white" }}
            >
              Deny
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
