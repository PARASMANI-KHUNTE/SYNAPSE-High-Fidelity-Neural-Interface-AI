import { useState } from "react";
import { Database, Activity, ChevronDown } from "lucide-react";

export default function MemoryPanel({ facts = [], episodes = [], profile = null, isConnected }) {
  const [isMinimized, setIsMinimized] = useState(true);
  const visibleFacts = facts.slice(0, 4);
  const visibleEpisodes = episodes.slice(0, 2);

  return (
    <div
      className={`w-full transition-all duration-300 hud-panel flex flex-col border-b border-[var(--color-tactical-blue)] bg-transparent`}
    >
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="px-4 py-3 border-b border-[var(--color-tactical-blue)] flex items-center justify-between hover:bg-[rgba(0,240,255,0.05)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Database size={12} className="text-[var(--color-cyan)]" />
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--color-cyan)]">
            {isMinimized ? "SYS.MEM" : "SYS.MEMORY_CORE"}
          </div>
        </div>
          <ChevronDown 
            size={14} 
            className={`text-[var(--color-cyan)] transition-transform duration-300 ${isMinimized ? "rotate-180" : ""}`} 
          />
      </button>

      {!isMinimized && (
        <div className="px-4 py-3 flex flex-col gap-3 font-mono">
          <div className="text-[9px] uppercase tracking-widest text-[#94a3b8]">
            TARGET_PROFILE: {profile?.name ? `[ ${profile.name} ]` : "[ UNKNOWN_ENTITY ]"}
          </div>
          
          {!isConnected ? (
            <div className="text-[10px] text-[var(--color-neon-red)] animate-pulse border border-[var(--color-neon-red)] p-2">
              AWAITING UPLINK...
            </div>
          ) : visibleFacts.length === 0 ? (
            <div className="text-[9px] text-slate-500 border border-dashed border-slate-700 p-2">
              [ NO_DURABLE_FACTS_FOUND ]
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleFacts.map((fact, index) => (
                <div
                  key={`${fact.key}_${fact.value}_${index}`}
                  className="p-2 border-l-2 border-[var(--color-cyan)] bg-[rgba(0,240,255,0.05)]"
                >
                  <div className="text-[8px] uppercase tracking-widest text-slate-400 mb-1">
                    {" >> "} {fact.key.replace(/_/g, " ")}
                  </div>
                  <div className="text-[10px] text-white">
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {visibleEpisodes.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-[var(--color-tactical-blue)]">
              <div className="flex items-center gap-2 mb-2">
                 <Activity size={10} className="text-[var(--color-neon-orange)]" />
                 <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-neon-orange)]">
                   RECENT_EPISODES
                 </div>
              </div>
              <div className="flex flex-col gap-2">
                {visibleEpisodes.map((episode, index) => (
                  <div
                    key={`${episode.date}_${index}`}
                    className="p-2 border border-[var(--color-tactical-blue)] bg-[rgba(30,58,138,0.1)] relative"
                  >
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-[#1e3a8a]" />
                    <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-[#1e3a8a]" />

                    <div className="text-[8px] uppercase tracking-[0.18em] text-slate-500 mb-1">
                      TS: {new Date(episode.date).getTime()}
                    </div>
                    <div className="text-[10px] text-[#e2e8f0] mb-1">
                      {episode.summary}
                    </div>
                    {episode.topics?.length > 0 && (
                      <div className="text-[8px] text-[var(--color-cyan)] mt-1">
                        [T]: {episode.topics.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Bottom telemetry line */}
      <div className="h-1 w-full bg-[#1e3a8a] flex">
         <div className="h-full bg-[var(--color-cyan)] w-[40%] animate-pulse" />
      </div>
    </div>
  );
}
