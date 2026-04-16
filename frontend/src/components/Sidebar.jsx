import { MessageSquarePlus, Trash2, Settings2, LogOut, User2, Sparkles, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MemoryPanel from './MemoryPanel';

const WINDOW_OPTIONS = [
  { key: "memory", label: "Memory" },
  { key: "statusRing", label: "Status Ring" },
  { key: "agentConsole", label: "Agent Console" },
  { key: "sandbox", label: "Sandbox" }
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
  onLogout,
  panelPrefs = {},
  onTogglePanel,
  activeLayoutPreset = "custom",
  onApplyLayoutPreset,
  memoryFacts = [],
  memoryEpisodes = [],
  memoryProfile = null,
  isConnected = false,
  collapsed = false,
  onToggleCollapse
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    const saved = localStorage.getItem('auto_speak');
    return saved === null ? true : saved === 'true';
  });
  const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('voice_gender') || 'male');

  useEffect(() => {
    localStorage.setItem('auto_speak', autoSpeak);
    localStorage.setItem('voice_gender', voiceGender);
  }, [autoSpeak, voiceGender]);

  return (
    <motion.aside
      animate={{ width: collapsed ? '64px' : 'var(--sidebar-w)' }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex flex-col shrink-0 h-full overflow-hidden z-20"
      style={{
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-background-soft)',
      }}
    >
      <div className={`pt-6 pb-5 flex items-center ${collapsed ? 'flex-col gap-4' : 'px-5 gap-3.5'}`}>
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0 rounded-2xl" style={{ background: 'var(--color-primary)' }}>
          <Sparkles size={18} className="text-white relative z-10" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              Synapse
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Your AI companion
            </span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-lg transition-colors duration-200 ${collapsed ? '' : 'ml-auto'}`}
          style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="px-4 mt-2 mb-4">
            <button
              onClick={onNewChat}
              className="group w-full flex items-center justify-center gap-2.5 py-3 text-sm font-medium rounded-2xl transition-all duration-200 warm-card-hover"
              style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-background-soft)' }}
            >
              <MessageSquarePlus size={16} style={{ color: 'var(--color-primary)' }} />
              <span style={{ color: 'var(--color-text-primary)' }}>New conversation</span>
            </button>
          </div>

          <div className="px-5 mb-2 flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Recent chats
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1 pb-2 hide-scrollbar">
            <AnimatePresence initial={false}>
              {sessions.map((chat, idx) => {
                const isActive = activeChatId === chat._id;
                return (
                  <motion.div
                    key={chat._id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    className="group"
                  >
                    <button
                      onClick={() => onSelectChat(chat._id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 ${
                        isActive 
                          ? 'warm-card' 
                          : 'hover:bg-[var(--color-surface-soft)]'
                      }`}
                      style={isActive ? { 
                        background: 'var(--color-surface-soft)', 
                        border: '1px solid var(--color-primary-soft)' 
                      } : undefined}
                    >
                      <span className="text-xs truncate flex-1" style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {chat.title}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteChat?.(chat._id); }}
                        className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-[var(--color-background-soft)]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Sparkles size={24} style={{ color: 'var(--color-primary-soft)' }} />
                <span className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                  No conversations yet
                </span>
              </div>
            )}
          </div>

          <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--color-surface-soft)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Connection
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-success)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
                Online
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-background-soft)' }}>
              <div className="h-full rounded-full" style={{ background: 'var(--color-primary)', width: '72%' }} />
            </div>
          </div>
        </>
      ) : (
        <div className="px-2 mt-2 mb-4 flex flex-col items-center text-center">
          <button
            onClick={onNewChat}
            className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200 warm-card-hover"
            style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-background-soft)' }}
            title="New conversation"
          >
            <MessageSquarePlus size={18} style={{ color: 'var(--color-primary)' }} />
          </button>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--color-background-soft)' }}>
        {onLogout && (
          <div className="px-3 pt-4 pb-2 flex justify-center">
            <button
              onClick={onLogout}
              className={`flex items-center justify-center rounded-xl transition-all warm-card-hover ${collapsed ? 'w-10 h-10' : 'w-full gap-2.5 py-2.5 px-4'}`}

              style={{
                background: 'var(--color-surface-soft)',
                border: '1px solid var(--color-background-soft)',
                color: 'var(--color-text-secondary)'
              }}
              title="Logout"
            >
              <LogOut size={15} />
              {!collapsed && <span className="text-sm font-medium">Logout</span>}
            </button>
          </div>
        )}

        <AnimatePresence>
          {!collapsed && isSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="p-4 flex flex-col gap-4 overflow-y-auto hide-scrollbar max-h-[50vh]" style={{ background: 'var(--color-surface-soft)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Auto Speak</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Read responses aloud</p>
                  </div>
                  <button
                    onClick={() => setAutoSpeak(!autoSpeak)}
                    className="relative w-12 h-7 rounded-full transition-colors duration-200"
                    style={{ 
                      background: autoSpeak ? 'var(--color-primary)' : 'var(--color-background-soft)',
                    }}
                  >
                    <div 
                      className="absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ 
                        left: autoSpeak ? '26px' : '4px',
                        transition: 'left 0.2s ease'
                      }} 
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Voice</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Choose voice type</p>
                  </div>
                  <button
                    onClick={() => setVoiceGender(p => p === 'male' ? 'female' : 'male')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-xl transition-colors duration-200 warm-card-hover"
                    style={{ 
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-background-soft)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <User2 size={14} />
                    {voiceGender === 'female' ? 'Female' : 'Male'}
                  </button>
                </div>

                {onTogglePanel && (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--color-background-soft)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <LayoutGrid size={14} style={{ color: 'var(--color-primary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Layout</p>
                    </div>
                    {onApplyLayoutPreset && (
                      <div className="mb-3">
                        <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                          Presets
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {LAYOUT_PRESETS.map((preset) => {
                            const isActive = activeLayoutPreset === preset.key;
                            return (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => onApplyLayoutPreset(preset.key)}
                                className="px-3 py-2 text-xs font-medium rounded-xl transition-all"
                                style={{
                                  background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                                  border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-background-soft)'}`,
                                  color: isActive ? 'white' : 'var(--color-text-secondary)',
                                }}
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
                            className="flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all warm-card-hover"
                            style={{
                              background: enabled ? 'var(--color-surface)' : 'transparent',
                              border: `1px solid ${enabled ? 'var(--color-background-soft)' : 'transparent'}`,
                              color: enabled ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            }}
                          >
                            <span>{option.label}</span>
                            {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="pt-2" style={{ borderTop: '1px solid var(--color-background-soft)' }}>
                  <MemoryPanel 
                    facts={memoryFacts}
                    episodes={memoryEpisodes}
                    profile={memoryProfile}
                    isConnected={isConnected}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-3 pb-4 flex justify-center">
          <button
            onClick={() => {
              if (collapsed) {
                onToggleCollapse();
                setIsSettingsOpen(true);
              } else {
                setIsSettingsOpen(!isSettingsOpen);
              }
            }}
            className={`flex items-center transition-colors duration-200 hover:bg-[var(--color-surface-soft)] ${collapsed ? 'justify-center w-10 h-10 rounded-xl' : 'w-full justify-between px-4 py-3 rounded-xl'}`}
            style={{ color: 'var(--color-text-secondary)' }}
            title="Settings"
          >
            <div className={`flex items-center ${!collapsed && 'gap-3.5'}`}>
              <Settings2 size={16} />
              {!collapsed && <span className="text-sm font-medium">Settings</span>}
            </div>
            {!collapsed && (
              <motion.div animate={{ rotate: isSettingsOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} />
              </motion.div>
            )}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
