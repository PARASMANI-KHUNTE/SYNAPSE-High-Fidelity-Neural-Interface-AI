import { MessageSquare, Plus, Settings, Trash2, User, Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Sidebar({ sessions, activeChatId, onSelectChat, onNewChat, onDeleteChat }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings sync with localStorage
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('auto_speak') === 'true');
  const [voiceGender, setVoiceGender] = useState(() => localStorage.getItem('voice_gender') || 'male');

  useEffect(() => {
    localStorage.setItem('auto_speak', autoSpeak);
    localStorage.setItem('voice_gender', voiceGender);
    // Notify app of changes if needed, but App.jsx reads from localStorage on send
  }, [autoSpeak, voiceGender]);

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-[#1e293b] border-r border-slate-700/50 flex flex-col p-4 z-10 shadow-xl overflow-hidden font-sans">
      <button 
        onClick={onNewChat}
        className="flex items-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-3 transition-colors duration-200 font-medium shadow-lg shadow-blue-600/10"
      >
        <Plus size={20} />
        New Chat
      </button>

      <div className="mt-6 flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-2 opacity-70 italic">Memory Core</div>
        
        {sessions.map((chat) => (
          <div 
            key={chat._id}
            className={`group flex items-center justify-between w-full rounded-xl transition-all duration-300 pr-2 ${activeChatId === chat._id ? 'bg-slate-800/80 text-blue-400 border border-slate-700/50' : 'hover:bg-slate-800/30 text-slate-400'}`}
          >
            <button 
              onClick={() => onSelectChat(chat._id)}
              className="flex items-center gap-3 flex-1 p-3 text-left truncate cursor-pointer"
            >
              <MessageSquare size={16} className={`shrink-0 ${activeChatId === chat._id ? 'text-blue-500' : 'text-slate-600 group-hover:text-slate-400'}`} />
              <span className="truncate text-xs font-medium tracking-tight">{chat.title}</span>
            </button>
            <button
               onClick={(e) => { e.stopPropagation(); onDeleteChat?.(chat._id); }}
               title="Delete Chat"
               className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
               <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-700/50">
        <div className={`overflow-hidden transition-all duration-300 ${isSettingsOpen ? 'max-h-64 mb-4' : 'max-h-0'}`}>
           <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col gap-4 border border-slate-700/30">
              <div className="flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-200">Neural Voice</span>
                    <span className="text-[10px] text-slate-500">Auto-speak responses</span>
                 </div>
                 <button 
                   onClick={() => setAutoSpeak(!autoSpeak)}
                   className={`p-2 rounded-lg transition-all ${autoSpeak ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-slate-900/50 text-slate-600 border border-slate-700/30'}`}
                 >
                   {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
                 </button>
              </div>

              <div className="flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-200">AI Gender</span>
                    <span className="text-[10px] text-slate-500">Pick sound persona</span>
                 </div>
                 <button 
                   onClick={() => setVoiceGender(prev => prev === 'male' ? 'female' : 'male')}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${voiceGender === 'female' ? 'bg-pink-600/10 text-pink-400 border-pink-500/30' : 'bg-blue-600/10 text-blue-400 border-blue-500/30'}`}
                 >
                   <User size={14} />
                   {voiceGender}
                 </button>
              </div>
           </div>
        </div>

        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`flex items-center justify-between w-full hover:bg-slate-800/50 text-slate-300 rounded-xl p-3 transition-all duration-200 text-left border ${isSettingsOpen ? 'bg-slate-800/80 border-slate-700' : 'border-transparent'}`}
        >
          <div className="flex items-center gap-3">
             <Settings size={18} className={`transition-transform duration-500 ${isSettingsOpen ? 'rotate-90 text-blue-400' : 'text-slate-500'}`} />
             <span className="text-sm font-medium">Settings</span>
          </div>
          {isSettingsOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
        </button>
      </div>
    </div>
  );
}
