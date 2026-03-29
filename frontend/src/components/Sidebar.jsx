import { MessageSquarePlus, Trash2, Settings2, Volume2, VolumeX, User2, Zap, Activity, ChevronDown, Terminal, LayoutPanelTop, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
 
import { motion, AnimatePresence } from 'framer-motion';

const WINDOW_OPTIONS = [
  { key: "memory", label: "Memory" },
  { key: "triggers", label: "Triggers" },
  { key: "system", label: "System" },
  { key: "console", label: "Console" },
  { key: "toolFeed", label: "Tool Feed" },
  { key: "statusRing", label: "Status Ring" }
];

const LAYOUT_PRESETS = [
  { key: "focus", label: "Focus" },
  { key: "dev", label: "Dev" },
  { key: "mission", label: "Mission" }
];

export default function Sidebar({
  sessions,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  panelPrefs = {},
  onTogglePanel,
  activeLayoutPreset = "custom",
  onApplyLayoutPreset
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('auto_speak') === 'true');
  const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('voice_gender') || 'male');

  useEffect(() => {
    localStorage.setItem('auto_speak', autoSpeak);
    localStorage.setItem('voice_gender', voiceGender);
  }, [autoSpeak, voiceGender]);

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-hidden hud-panel bg-[rgba(5,7,15,0.95)] z-20"
      style={{
        width: 'var(--sidebar-w)',
      }}
    >
      {/* ── Logo ─────────────────────────── */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3.5 border-b border-[var(--color-grid)]">
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0 border border-[var(--color-neon-red)] bg-black shadow-[0_0_10px_rgba(255,42,42,0.3)]">
          <Terminal size={18} className="text-[var(--color-neon-red)] relative z-10" />
          <div className="absolute inset-0 animate-pulse-red" style={{ opacity: 0.3 }} />
          {/* technical corner details */}
          <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-[var(--color-cyan)]" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-[var(--color-cyan)]" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-label text-sm font-black tracking-[0.3em] text-glow-red">
            SYNAPSE
          </span>
          <span className="font-mono text-[9px] tracking-[0.15em] font-medium mt-1 text-[var(--color-cyan)] opacity-80">
            SYS.OP.INTERFACE // V2
          </span>
        </div>
      </div>

      {/* ── New Chat ──────────────────────── */}
      <div className="px-4 mt-5 mb-5">
        <button
          onClick={onNewChat}
          className="group relative w-full flex items-center justify-center gap-2.5 py-3 text-sm font-label font-bold uppercase transition-all duration-300 border border-[var(--color-tactical-blue)] hover:border-[var(--color-cyan)] bg-[rgba(30,58,138,0.1)] hover:bg-[rgba(0,240,255,0.1)] active:scale-95"
        >
          <div className="absolute inset-0 animate-scan pointer-events-none opacity-20" />
          <MessageSquarePlus size={16} className="text-[var(--color-cyan)] group-hover:text-glow-cyan" />
          <span className="text-[var(--color-cyan)] group-hover:text-glow-cyan tracking-widest">
            [ INIT CONNECT ]
          </span>
        </button>
      </div>

      {/* ── Session Label ─────────────────── */}
      <div className="px-5 mb-2 flex items-center gap-2 opacity-70">
        <Activity size={10} className="text-[var(--color-neon-orange)]" />
        <span className="font-mono text-[9px] tracking-[0.2em] text-[var(--color-neon-orange)] uppercase">
          {" >> "} Telemetry Logs
        </span>
      </div>

      {/* ── Sessions List ─────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1 pb-2 hide-scrollbar">
        <AnimatePresence initial={false}>
          {sessions.map((chat, idx) => {
            const isActive = activeChatId === chat._id;
            return (
              <motion.div
                key={chat._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className={`group relative flex items-center transition-all duration-200 border-l-2 ${isActive ? 'bg-[rgba(255,42,42,0.05)] border-[var(--color-neon-red)]' : 'border-transparent hover:bg-[rgba(30,58,138,0.2)] hover:border-[var(--color-cyan)]'}`}
              >
                <button
                  onClick={() => onSelectChat(chat._id)}
                  className="flex items-center gap-2.5 flex-1 px-3 py-2.5 text-left min-w-0"
                >
                  <span className={`font-mono text-[10px] ${isActive ? 'text-[var(--color-neon-red)]' : 'text-slate-500'}`}>
                    0x{idx.toString(16).padStart(2, '0').toUpperCase()}
                  </span>
                  <span className={`truncate text-xs font-mono tracking-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {chat.title}
                  </span>
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteChat?.(chat._id); }}
                  className="shrink-0 mr-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 text-slate-500 hover:text-[var(--color-neon-red)]"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-[var(--color-grid)] mx-2 mt-2">
            <Zap size={20} className="text-slate-600" />
            <span className="text-xs text-center font-mono text-slate-600 uppercase">
              No Logs Found
            </span>
          </div>
        )}
      </div>

      {/* ── Status Widget ─────────────────── */}
      <div className="mx-4 mb-4 p-3.5 flex flex-col gap-2.5 border border-[var(--color-tactical-blue)] bg-[rgba(0,0,0,0.5)] relative">
        <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-[var(--color-cyan)]" />
        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-[var(--color-cyan)]" />
        
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-widest text-[#94a3b8]">
            CORE STATUS
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-glow-red">
            <span className="w-1.5 h-1.5 bg-[var(--color-neon-red)] animate-flicker" />
            ONLINE
          </span>
        </div>
        
        {/* Progress bar tactical style */}
        <div className="w-full h-1 bg-[var(--color-grid)] overflow-hidden">
          <div className="h-full bg-[var(--color-neon-red)] w-[72%] shadow-[0_0_8px_var(--color-neon-red)]" />
        </div>
        
        <div className="flex items-center justify-between font-mono">
          <span className="text-[9px] text-[#94a3b8]">UPLINK</span>
          <span className="text-[9px] text-[var(--color-cyan)]">SECURE_0x9A</span>
        </div>
      </div>

      {/* ── Settings ─────────────────────── */}
      <div className="border-t border-[var(--color-grid)] px-4 pt-3 pb-4 bg-[rgba(0,0,0,0.4)]">
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden mb-3"
            >
              <div className="p-4 flex flex-col gap-4 border border-[var(--color-grid)] bg-[var(--color-surface)]">
                {/* Auto Speak */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-white">SYS.AUDIO_FLUX</p>
                    <p className="text-[9px] font-mono text-slate-500">VOICE_SYNC(1)</p>
                  </div>
                  <button
                    onClick={() => setAutoSpeak(!autoSpeak)}
                    className={`p-2 transition-all duration-300 border ${autoSpeak ? 'border-[var(--color-neon-orange)] text-[var(--color-neon-orange)] bg-[rgba(255,144,0,0.1)]' : 'border-slate-700 text-slate-600 bg-transparent'}`}
                  >
                    {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </button>
                </div>

                {/* Voice Gender */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-white">SYS.PERSONA</p>
                    <p className="text-[9px] font-mono text-slate-500">DEF_TARGET</p>
                  </div>
                  <button
                    onClick={() => setVoiceGender(p => p === 'male' ? 'female' : 'male')}
                    className={`flex items-center gap-2 px-2.5 py-1.5 text-[9px] font-mono uppercase transition-all duration-300 border ${voiceGender === 'female' ? 'border-[var(--color-neon-red)] text-[var(--color-neon-red)] bg-[rgba(255,42,42,0.1)]' : 'border-[var(--color-cyan)] text-[var(--color-cyan)] bg-[rgba(0,240,255,0.1)]'}`}
                  >
                    <User2 size={10} />
                    {voiceGender}
                  </button>
                </div>

                {onTogglePanel && (
                  <div className="pt-2 border-t border-[var(--color-grid)]">
                    <div className="flex items-center gap-2 mb-3">
                      <LayoutPanelTop size={12} className="text-[var(--color-cyan)]" />
                      <p className="text-xs font-mono text-white">WINDOW_MGR</p>
                    </div>
                    {onApplyLayoutPreset && (
                      <div className="mb-3">
                        <div className="text-[8px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                          Layout Presets
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {LAYOUT_PRESETS.map((preset) => {
                            const isActive = activeLayoutPreset === preset.key;
                            return (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => onApplyLayoutPreset(preset.key)}
                                className={`px-2 py-2 text-[8px] font-mono uppercase border transition-all ${
                                  isActive
                                    ? 'border-[var(--color-neon-orange)] text-[var(--color-neon-orange)] bg-[rgba(255,144,0,0.08)]'
                                    : 'border-slate-700 text-slate-400 bg-transparent hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      {WINDOW_OPTIONS.map((option) => {
                        const enabled = panelPrefs?.[option.key] !== false;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => onTogglePanel(option.key)}
                            className={`flex items-center justify-between px-2.5 py-2 text-[9px] font-mono uppercase border transition-all ${
                              enabled
                                ? 'border-[var(--color-cyan)] text-[var(--color-cyan)] bg-[rgba(0,240,255,0.08)]'
                                : 'border-slate-700 text-slate-500 bg-transparent'
                            }`}
                          >
                            <span>{option.label}</span>
                            {enabled ? <Eye size={11} /> : <EyeOff size={11} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`flex items-center justify-between w-full px-3 py-2.5 transition-all duration-200 border ${isSettingsOpen ? 'border-[var(--color-cyan)] bg-[rgba(0,240,255,0.05)] text-[var(--color-cyan)]' : 'border-transparent text-slate-500 hover:text-[var(--color-cyan)]'}`}
        >
          <div className="flex items-center gap-2.5">
            <Settings2 size={14} style={{ transition: 'transform 0.5s', transform: isSettingsOpen ? 'rotate(90deg)' : 'none' }} />
            <span className="text-[10px] font-mono uppercase tracking-widest">Config_Menu</span>
          </div>
          <motion.div animate={{ rotate: isSettingsOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown size={12} />
          </motion.div>
        </button>
      </div>
    </aside>
  );
}
