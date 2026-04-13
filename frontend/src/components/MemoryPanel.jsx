import { useState } from "react";
import { Database, Activity, ChevronDown } from "lucide-react";

export default function MemoryPanel({ facts = [], episodes = [], profile = null, isConnected }) {
  const [isMinimized, setIsMinimized] = useState(true);
  const visibleFacts = facts.slice(0, 4);
  const visibleEpisodes = episodes.slice(0, 2);

  return (
    <div
      className="w-full transition-all duration-300 warm-card overflow-hidden"
    >
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-surface-soft)] transition-colors cursor-pointer rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <Database size={14} style={{ color: 'var(--color-primary)' }} />
          <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Memory
          </div>
        </div>
        <ChevronDown 
          size={16} 
          style={{ color: 'var(--color-text-muted)', transform: isMinimized ? "rotate(180deg)" : "rotate(0deg)", transition: 'transform 0.2s' }} 
        />
      </button>

      {!isMinimized && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Profile: {profile?.name || "Unknown"}
          </div>
          
          {!isConnected ? (
            <div className="text-sm rounded-xl p-3" style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-muted)' }}>
              Waiting for connection...
            </div>
          ) : visibleFacts.length === 0 ? (
            <div className="text-sm rounded-xl p-3" style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-muted)' }}>
              No facts learned yet
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleFacts.map((fact, index) => (
                <div
                  key={`${fact.key}_${fact.value}_${index}`}
                  className="p-3 rounded-xl"
                  style={{ background: 'var(--color-surface-soft)', borderLeft: '3px solid var(--color-primary)' }}
                >
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    {fact.key.replace(/_/g, " ")}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {visibleEpisodes.length > 0 && (
            <div className="pt-2" style={{ borderTop: '1px solid var(--color-background-soft)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={12} style={{ color: 'var(--color-accent)' }} />
                <div className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Recent Activity
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {visibleEpisodes.map((episode, index) => (
                  <div
                    key={`${episode.date}_${index}`}
                    className="p-3 rounded-xl warm-card"
                  >
                    <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                      {new Date(episode.date).toLocaleString()}
                    </div>
                    <div className="text-sm mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      {episode.summary}
                    </div>
                    {episode.topics?.length > 0 && (
                      <div className="text-xs" style={{ color: 'var(--color-accent)' }}>
                        {episode.topics.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
