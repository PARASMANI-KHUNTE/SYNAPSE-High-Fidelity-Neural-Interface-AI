import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";

const resolveStatus = ({ isTyping, pendingConfirmation, agentEvents = [] }) => {
  const latest = agentEvents[0];
  if (pendingConfirmation) {
    return { label: "Awaiting confirmation", color: "var(--color-warning)", Icon: ShieldAlert };
  }
  if (latest?.type === "error") {
    return { label: "Error", color: "var(--color-error)", Icon: XCircle };
  }
  if (latest?.type === "result" || latest?.type === "done") {
    return { label: "Complete", color: "var(--color-success)", Icon: CheckCircle2 };
  }
  if (isTyping || latest?.type === "start" || latest?.type === "thinking") {
    return { label: "Thinking", color: "var(--color-primary)", Icon: Loader2 };
  }
  return { label: "Ready", color: "var(--color-info)", Icon: CheckCircle2 };
};

export default function StatusRing({ isTyping, pendingConfirmation, agentEvents = [] }) {
  const status = resolveStatus({ isTyping, pendingConfirmation, agentEvents });
  const Icon = status.Icon;

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[34] hidden xl:block pointer-events-none">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${status.color}`,
            opacity: 0.3,
            animation: status.label === "Thinking" ? "spin 8s linear infinite" : "none"
          }}
        />
        <div
          className="absolute inset-[8px] rounded-full"
          style={{ border: '1px dashed', borderColor: `${status.color}40` }}
        />
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center soft-shadow"
          style={{ background: "var(--color-surface)", color: status.color }}
        >
          <Icon size={18} className={status.label === "Thinking" ? "animate-spin" : ""} />
        </div>
      </div>
      <div className="mt-2 text-center text-xs font-medium" style={{ color: status.color }}>
        {status.label}
      </div>
    </div>
  );
}
