import { Activity, ChevronDown, Clock3, Power, PowerOff } from "lucide-react";
import { useState } from "react";

const formatCondition = (condition = {}) => {
  if (typeof condition?.hour === "number" && typeof condition?.minute === "number") {
    return `${String(condition.hour).padStart(2, "0")}:${String(condition.minute).padStart(2, "0")} daily`;
  }
  if (condition?.path) {
    return `${condition.event || "change"} @ ${condition.path}`;
  }
  if (condition?.contains) {
    return `match /${condition.contains}/`;
  }
  return "Custom trigger";
};

export default function TriggerPanel({
  triggers = [],
  alerts = [],
  isConnected,
  onToggleTrigger,
  isUpdatingId = "",
  onCreateTrigger,
  isCreating = false
}) {
  const [isMinimized, setIsMinimized] = useState(true);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("file");
  const [draftTarget, setDraftTarget] = useState("frontend/src");
  const [draftAction, setDraftAction] = useState("notify_workspace_change");

  const handleCreate = () => {
    if (!onCreateTrigger || !draftName.trim()) {
      return;
    }

    let condition;
    if (draftType === "file") {
      condition = { path: draftTarget.trim(), event: "change" };
    } else if (draftType === "clipboard") {
      condition = { contains: draftTarget.trim(), pollMs: 5000 };
    } else {
      condition = { metric: "memory", threshold: Number(draftTarget) || 85, pollMs: 10000, cooldownMs: 60000 };
    }

    onCreateTrigger({
      name: draftName.trim(),
      type: draftType,
      action: draftAction.trim() || "custom_action",
      condition,
      enabled: true
    });

    setDraftName("");
  };

  return (
    <div
      className="w-full rounded-3xl border overflow-hidden"
      style={{
        background: "rgba(9, 14, 30, 0.84)",
        borderColor: "rgba(34, 197, 94, 0.16)",
        backdropFilter: "blur(22px)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)"
      }}
    >
      <button
        type="button"
        onClick={() => setIsMinimized((prev) => !prev)}
        className="w-full px-5 py-4 border-b flex items-center justify-between text-left"
        style={{ borderColor: "rgba(148,163,184,0.12)" }}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "#4ade80" }}>
            Triggers
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: "#e2f3ff" }}>
            Proactive automation rules
          </div>
        </div>
        <ChevronDown
          size={16}
          style={{ color: "#4ade80", transform: isMinimized ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        />
      </button>

      {!isMinimized && (
      <div className="px-5 py-4 flex flex-col gap-3">
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: "rgba(8, 15, 32, 0.82)",
            border: "1px solid rgba(34,197,94,0.12)"
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "#86efac" }}>
            Create Trigger
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="rule name"
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(15,23,42,0.78)", color: "#dbeafe", border: "1px solid rgba(148,163,184,0.12)" }}
            />
            <select
              value={draftType}
              onChange={(event) => setDraftType(event.target.value)}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(15,23,42,0.78)", color: "#dbeafe", border: "1px solid rgba(148,163,184,0.12)" }}
            >
              <option value="file">file</option>
              <option value="clipboard">clipboard</option>
              <option value="system">system</option>
            </select>
            <input
              value={draftTarget}
              onChange={(event) => setDraftTarget(event.target.value)}
              placeholder={draftType === "system" ? "threshold percent" : draftType === "clipboard" ? "match pattern" : "path to watch"}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(15,23,42,0.78)", color: "#dbeafe", border: "1px solid rgba(148,163,184,0.12)" }}
            />
            <input
              value={draftAction}
              onChange={(event) => setDraftAction(event.target.value)}
              placeholder="action name"
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(15,23,42,0.78)", color: "#dbeafe", border: "1px solid rgba(148,163,184,0.12)" }}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!isConnected || isCreating || !draftName.trim()}
              className="rounded-xl px-3 py-2 text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(34,197,94,0.12)", color: "#bbf7d0" }}
            >
              {isCreating ? "Creating..." : "Create Trigger"}
            </button>
          </div>
        </div>

        {!isConnected ? (
          <div className="text-sm" style={{ color: "#64748b" }}>
            Waiting for connection to load triggers.
          </div>
        ) : triggers.length === 0 ? (
          <div className="text-sm" style={{ color: "#64748b" }}>
            No trigger rules available yet.
          </div>
        ) : (
          triggers.map((trigger) => (
            <div
              key={trigger.id}
              className="rounded-2xl px-4 py-3"
              style={{
                background: "rgba(15, 23, 42, 0.78)",
                border: "1px solid rgba(148,163,184,0.08)"
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: trigger.enabled ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)",
                    color: trigger.enabled ? "#4ade80" : "#94a3b8",
                    border: `1px solid ${trigger.enabled ? "rgba(34,197,94,0.25)" : "rgba(148,163,184,0.18)"}`
                  }}
                >
                  <Activity size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "#dbeafe" }}>
                    {trigger.name}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "#64748b" }}>
                    {trigger.type}
                    {trigger.condition?.path ? ` // ${trigger.condition.path}` : ""}
                    {trigger.condition?.contains ? ` // ${trigger.condition.contains}` : ""}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "#93c5fd" }}>
                    {trigger.action.replace(/_/g, " ")}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "#94a3b8" }}>
                    <Clock3 size={12} />
                    <span>{formatCondition(trigger.condition)}</span>
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "#64748b" }}>
                    Last fired: {trigger.lastFired ? new Date(trigger.lastFired).toLocaleString() : "Never"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleTrigger(trigger)}
                disabled={isUpdatingId === trigger.id}
                className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: trigger.enabled ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                  color: trigger.enabled ? "#fecaca" : "#bbf7d0"
                }}
              >
                {isUpdatingId === trigger.id ? "Updating..." : trigger.enabled ? (
                  <span className="inline-flex items-center gap-2">
                    <PowerOff size={14} />
                    Disable
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Power size={14} />
                    Enable
                  </span>
                )}
              </button>
            </div>
          ))
        )}

        {alerts.length > 0 ? (
          <>
            <div className="pt-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: "#4ade80" }}>
              Recent Alerts
            </div>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl px-4 py-3"
                style={{
                  background: "rgba(8, 15, 32, 0.82)",
                  border: "1px solid rgba(34,197,94,0.12)"
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "#86efac" }}>
                  {alert.ruleName || "trigger alert"}
                </div>
                <div className="mt-1 text-sm leading-relaxed" style={{ color: "#dbeafe" }}>
                  {alert.message}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: "#64748b" }}>
                  {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : "Just now"}
                </div>
                {alert.details?.preview ? (
                  <div className="mt-2 text-[11px] leading-relaxed" style={{ color: "#94a3b8" }}>
                    {alert.details.preview}
                  </div>
                ) : null}
              </div>
            ))}
          </>
        ) : null}
      </div>
      )}
    </div>
  );
}
