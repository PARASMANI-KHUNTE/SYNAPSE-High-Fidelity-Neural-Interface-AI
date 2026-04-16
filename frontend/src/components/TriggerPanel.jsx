import { useState, useEffect, useRef } from "react";
import { Zap, Bell, Clock, Activity, AlertTriangle, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TriggerPanel({ alerts = [], onClear, onDismiss }) {
  const [filter, setFilter] = useState("all");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (alerts.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [alerts]);

  const filteredAlerts = filter === "all" 
    ? alerts 
    : alerts.filter(a => a.type === filter);

  const getAlertIcon = (type) => {
    switch (type) {
      case "scheduled": return <Clock size={12} />;
      case "system": return <Activity size={12} />;
      case "monitoring": return <Zap size={12} />;
      case "error": return <AlertTriangle size={12} />;
      default: return <Bell size={12} />;
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case "error": return "var(--color-error)";
      case "scheduled": return "var(--color-primary)";
      case "system": return "var(--color-success)";
      case "monitoring": return "var(--color-warning)";
      default: return "var(--color-info)";
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: "var(--color-primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            Triggers
          </span>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        {["all", "scheduled", "system", "error"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-2 py-1 text-xs rounded-lg capitalize transition-colors"
            style={{
              background: filter === f ? "var(--color-primary)" : "transparent",
              color: filter === f ? "white" : "var(--color-text-muted)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto hide-scrollbar">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <Bell size={16} style={{ color: "var(--color-text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              No trigger alerts
            </span>
          </div>
        ) : (
          filteredAlerts.slice(-10).reverse().map((alert, idx) => (
            <motion.div
              key={alert.id || idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 p-2 rounded-lg"
              style={{
                background: "var(--color-surface-soft)",
                borderLeft: `2px solid ${getAlertColor(alert.type)}`
              }}
            >
              <span style={{ color: getAlertColor(alert.type) }} className="mt-0.5">
                {getAlertIcon(alert.type)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium capitalize" style={{ color: "var(--color-text-primary)" }}>
                    {alert.label || alert.type}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {formatTime(alert.timestamp)}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {alert.message}
                </p>
              </div>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-1 rounded hover:bg-[var(--color-background-soft)]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X size={10} />
                </button>
              )}
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
