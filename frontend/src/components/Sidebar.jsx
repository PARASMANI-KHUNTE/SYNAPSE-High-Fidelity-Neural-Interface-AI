import { MessageSquare, Plus, Settings, Trash2, User, Volume2, VolumeX, ChevronDown, ChevronUp, Cpu, Activity, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';

export default function Sidebar({ sessions, activeChatId, onSelectChat, onNewChat, onDeleteChat }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings sync with localStorage
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('auto_speak') === 'true');
  const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('voice_gender') || 'male');

  useEffect(() => {
    localStorage.setItem('auto_speak', autoSpeak);
    localStorage.setItem('voice_gender', voiceGender);
  }, [autoSpeak, voiceGender]);

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-[#0f172a]/95 backdrop-blur-xl border-r border-white/5 flex flex-col p-4 z-10 shadow-2xl overflow-hidden font-sans">
      
      <div className="flex items-center gap-4 mb-8 px-1 group/logo-container">
         <div className="relative p-2.5 bg-cyan-600/20 rounded-2xl border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] group/logo overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95">
            <Zap size={22} className="text-cyan-400 animate-pulse relative z-10" fill="currentColor" />
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl group-hover/logo:scale-150 transition-transform duration-700"></div>
         </div>
         <div className="flex flex-col text-slate-100">
            <span className="text-base font-black tracking-[0.4em] uppercase font-sci-fi leading-none shadow-cyan-500/20">SYNAPSE</span>
         </div>
      </div>

      <button 
        onClick={onNewChat}
        className="flex items-center gap-2 w-full bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl p-3.5 transition-all duration-300 font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-cyan-600/20 active:scale-95"
      >
        <Plus size={18} />
        New Neural Path
      </button>

      <div className="mt-8 flex flex-col gap-1 flex-1 overflow-y-auto pr-1 scrollbar-hide">
        <div className="text-[10px] font-black text-slate-500/60 uppercase tracking-[0.2em] mb-2 px-2 flex items-center gap-2">
           <Activity size={10} /> Synaptic Memory
        </div>
        
        {sessions.map((chat) => (
          <div 
            key={chat._id}
            className={`group flex items-center justify-between w-full h-11 rounded-xl transition-all duration-300 pr-2 border ${activeChatId === chat._id ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]' : 'hover:bg-slate-800/40 text-slate-400 border-transparent'}`}
          >
            <button 
              onClick={() => onSelectChat(chat._id)}
              className="flex items-center gap-3 flex-1 px-3 py-2 text-left truncate cursor-pointer"
            >
              <MessageSquare size={14} className={`shrink-0 ${activeChatId === chat._id ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              <span className="truncate text-xs font-semibold tracking-tight">{chat.title}</span>
            </button>
            <button
               onClick={(e) => { e.stopPropagation(); onDeleteChat?.(chat._id); }}
               className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
               <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* --- TELEMETRY BADGES --- */}
      <div className="mt-6 p-3 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col gap-2 mb-4">
         <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Neural Engine</span>
            <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
               <div className="w-1 h-1 bg-emerald-400 rounded-full animate-ping"></div> v3.12 (Fast)
            </span>
         </div>
         <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Imagery Module</span>
            <span className="text-[9px] font-bold text-blue-400/60">Isolated API</span>
         </div>
      </div>

      <div className="pt-4 border-t border-white/5">
        <div className={`overflow-hidden transition-all duration-500 ${isSettingsOpen ? 'max-h-64 mb-4 opacity-100 scale-100' : 'max-h-0 opacity-0 scale-95'}`}>
           <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-5 border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-[11px] font-black text-slate-200 tracking-widest uppercase">Audio Flux</span>
                    <span className="text-[9px] text-slate-500 font-bold tracking-wider">Sync responses to voice</span>
                 </div>
                 <button 
                   onClick={() => setAutoSpeak(!autoSpeak)}
                   className={`p-2.5 rounded-xl transition-all shadow-lg ${autoSpeak ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-blue-600/10' : 'bg-slate-950/50 text-slate-600 border border-white/5'}`}
                 >
                   {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
                 </button>
              </div>

              <div className="flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-[11px] font-black text-slate-200 tracking-widest uppercase">Persona</span>
                    <span className="text-[9px] text-slate-500 font-bold tracking-wider">Voice Gender frequency</span>
                 </div>
                 <button 
                   onClick={() => setVoiceGender(prev => prev === 'male' ? 'female' : 'male')}
                   className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg border ${voiceGender === 'female' ? 'bg-pink-600/10 text-pink-400 border-pink-500/40 shadow-pink-600/10' : 'bg-blue-600/10 text-blue-400 border-blue-500/40 shadow-blue-600/10'}`}
                 >
                   <User size={14} fill="currentColor" />
                   {voiceGender}
                 </button>
              </div>
           </div>
        </div>

        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`flex items-center justify-between w-full hover:bg-slate-800/40 text-slate-400 rounded-xl p-3.5 transition-all duration-300 text-left border ${isSettingsOpen ? 'bg-slate-800/60 border-white/10 text-white' : 'border-transparent'}`}
        >
          <div className="flex items-center gap-3">
             <div className={clsx("p-1.5 rounded-lg transition-all duration-500", isSettingsOpen ? "bg-blue-600/20" : "bg-transparent")}>
                <Settings size={18} className={`transition-transform duration-700 ${isSettingsOpen ? 'rotate-180 text-blue-400' : 'text-slate-600'}`} />
             </div>
             <span className="text-[11px] font-black uppercase tracking-[0.2em]">Interface Config</span>
          </div>
          {isSettingsOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
    </div>
  );
}
