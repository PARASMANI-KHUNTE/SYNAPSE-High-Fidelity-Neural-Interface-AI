import { Bot, CheckCircle2, Loader2, ShieldAlert, TerminalSquare, XCircle } from "lucide-react";

const getEventIcon = (type) => {
  if (type === "thinking") return Bot;
  if (type === "start") return Loader2;
  if (type === "result" || type === "done") return CheckCircle2;
  if (type === "confirm") return ShieldAlert;
  return XCircle;
};

const getAccent = (type) => {
  if (type === "result" || type === "done") return "#4ade80";
  if (type === "error") return "#ff5f56";
  if (type === "confirm") return "#fb923c";
  return "#22d3ee";
};

export default function ToolFeed({ events = [], docked = false }) {
  const visibleEvents = events.slice(0, 8);

  return (
    <div
      className={
        docked
          ? "w-full"
          : "absolute top-24 right-6 z-[35] w-[280px] hidden 2xl:block pointer-events-none"
      }
    >
      <div
        className="rounded-3xl border overflow-hidden"
        style={{
          background: "rgba(5, 10, 24, 0.82)",
          borderColor: "rgba(34, 211, 238, 0.18)",
          backdropFilter: "blur(18px)",
          boxShadow: "0 16px 44px rgba(0,0,0,0.32)"
        }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(148,163,184,0.12)" }}>
          <div className="flex items-center gap-2">
            <TerminalSquare size={14} style={{ color: "#22d3ee" }} />
            <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "#67e8f9" }}>
              Tool Feed
            </span>
          </div>
        </div>

        <div className="px-4 py-3 flex flex-col gap-2">
          {visibleEvents.length === 0 ? (
            <div className="text-[11px]" style={{ color: "#64748b" }}>
              No agent activity yet.
            </div>
          ) : visibleEvents.map((event) => {
            const Icon = getEventIcon(event.type);
            const accent = getAccent(event.type);
            const toolName = event.payload?.tool || event.payload?.step || event.type;

            return (
              <div
                key={event.id}
                className="rounded-2xl px-3 py-2"
                style={{
                  background: "rgba(15, 23, 42, 0.78)",
                  border: `1px solid ${accent}22`
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    size={13}
                    style={{ color: accent }}
                    className={event.type === "start" ? "animate-spin" : ""}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#dbeafe" }}>
                    {String(toolName)}
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>
                    {event.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
