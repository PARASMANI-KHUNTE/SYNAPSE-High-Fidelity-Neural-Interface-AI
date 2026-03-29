import { ActivitySquare, ChevronDown, Cpu, GitBranch, HardDrive, TimerReset } from "lucide-react";
import { useState } from "react";

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 GB";
  }

  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
};

const formatUptime = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0m";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};

export default function SystemPanel({ status, isConnected }) {
  const [isMinimized, setIsMinimized] = useState(true);
  const memory = status?.memory;
  const repo = status?.repo;
  const system = status?.system;

  return (
    <div
      className="w-full rounded-3xl border overflow-hidden"
      style={{
        background: "rgba(9, 14, 30, 0.84)",
        borderColor: "rgba(96, 165, 250, 0.18)",
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
          <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "#60a5fa" }}>
            System
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: "#e2f3ff" }}>
            Local machine and repo state
          </div>
        </div>
        <ChevronDown
          size={16}
          style={{ color: "#60a5fa", transform: isMinimized ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        />
      </button>

      {!isMinimized && (
      <div className="px-5 py-4 flex flex-col gap-3">
        {!isConnected ? (
          <div className="text-sm" style={{ color: "#64748b" }}>
            Waiting for connection to load system status.
          </div>
        ) : !status ? (
          <div className="text-sm" style={{ color: "#64748b" }}>
            Loading current system state.
          </div>
        ) : (
          <>
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: "rgba(15, 23, 42, 0.78)",
                border: "1px solid rgba(148,163,184,0.08)"
              }}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "#93c5fd" }}>
                <HardDrive size={12} />
                Memory
              </div>
              <div className="mt-2 text-sm font-semibold" style={{ color: "#dbeafe" }}>
                {memory?.usedPercent ?? 0}% used
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "#94a3b8" }}>
                {formatBytes(memory?.usedBytes)} / {formatBytes(memory?.totalBytes)}
              </div>
            </div>

            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: "rgba(15, 23, 42, 0.78)",
                border: "1px solid rgba(148,163,184,0.08)"
              }}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "#93c5fd" }}>
                <Cpu size={12} />
                Runtime
              </div>
              <div className="mt-2 text-sm font-semibold" style={{ color: "#dbeafe" }}>
                {system?.cpuCount ?? 0} logical cores
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "#94a3b8" }}>
                <TimerReset size={12} />
                <span>Uptime {formatUptime(system?.uptimeSeconds)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "#64748b" }}>
                <ActivitySquare size={12} />
                <span>{system?.platform || "unknown"} on {system?.hostname || "localhost"}</span>
              </div>
            </div>

            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: "rgba(8, 15, 32, 0.82)",
                border: "1px solid rgba(59,130,246,0.12)"
              }}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "#93c5fd" }}>
                <GitBranch size={12} />
                Repo
              </div>
              <div className="mt-2 text-sm font-semibold" style={{ color: "#dbeafe" }}>
                {repo?.branch || "unknown"}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed" style={{ color: "#94a3b8" }}>
                {repo?.lastCommit || "No git history available"}
              </div>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
