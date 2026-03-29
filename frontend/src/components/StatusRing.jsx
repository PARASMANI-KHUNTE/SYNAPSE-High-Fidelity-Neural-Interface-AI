import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";

const resolveStatus = ({ isTyping, pendingConfirmation, agentEvents = [] }) => {
  const latest = agentEvents[0];
  if (pendingConfirmation) {
    return { label: "confirm", color: "#fb923c", Icon: ShieldAlert };
  }
  if (latest?.type === "error") {
    return { label: "error", color: "#ff5f56", Icon: XCircle };
  }
  if (latest?.type === "result" || latest?.type === "done") {
    return { label: "complete", color: "#4ade80", Icon: CheckCircle2 };
  }
  if (isTyping || latest?.type === "start" || latest?.type === "thinking") {
    return { label: "thinking", color: "#22d3ee", Icon: Loader2 };
  }
  return { label: "idle", color: "#60a5fa", Icon: CheckCircle2 };
};

export default function StatusRing({ isTyping, pendingConfirmation, agentEvents = [] }) {
  const status = resolveStatus({ isTyping, pendingConfirmation, agentEvents });
  const Icon = status.Icon;

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[34] hidden xl:block pointer-events-none">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${status.color}`,
            boxShadow: `0 0 24px ${status.color}44, inset 0 0 18px ${status.color}22`,
            animation: status.label === "thinking" ? "spin 8s linear infinite" : "none"
          }}
        />
        <div
          className="absolute inset-[10px] rounded-full border border-dashed"
          style={{ borderColor: `${status.color}66` }}
        />
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(8,15,32,0.9)", color: status.color }}
        >
          <Icon size={18} className={status.label === "thinking" ? "animate-spin" : ""} />
        </div>
      </div>
      <div className="mt-2 text-center text-[10px] uppercase tracking-[0.22em]" style={{ color: status.color }}>
        {status.label}
      </div>
    </div>
  );
}
