import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import { Bot, Cpu } from 'lucide-react';
import Particles from './Particles';

export default function ChatWindow({ messages, isTyping, isSpeaking, onSendMessage, onStopMessage, onStopAudio }) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full relative w-full max-w-5xl mx-auto pt-6 pb-0 overflow-hidden">
      
      {/* 🌌 DYNAMIC NEURAL PARTICLES */}
      <Particles isSpeaking={isSpeaking} />

      {/* Ambient Background Glow */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isSpeaking ? 'opacity-100' : 'opacity-40'}`}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-full h-80 bg-gradient-to-t from-cyan-500/10 to-transparent"></div>
      </div>
      
      {/* Header Overlay (Sci-fi feeling) */}
      <div className="flex items-center gap-3 px-8 py-2 z-20 border-b border-white/5 bg-slate-900/40 backdrop-blur-md">
        <Cpu size={18} className="text-cyan-400 animate-pulse" />
        <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Neural Stream Active | OS Assistant v2.0</span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-6 pb-40 pt-10 scroll-smooth flex flex-col gap-8 z-10 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center justify-center text-slate-500 opacity-40">
            <div className="relative mb-6">
               <Bot size={80} className="text-blue-400/50" />
               <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-2xl animate-pulse"></div>
            </div>
            <h2 className="text-2xl font-bold tracking-widest uppercase font-sci-fi text-slate-300">Neural Interface Ready</h2>
            <p className="text-sm tracking-wide mt-2">Initialize query to begin processing</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble 
              key={msg.id || idx} 
              role={msg.role} 
              content={msg.content} 
              isError={msg.isError} 
              imageUrls={msg.imageUrls} 
            />
          ))
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Area Overlay */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#020617] via-[#020617]/90 to-transparent p-6 pb-10 z-20">
        <InputBar 
          onSend={onSendMessage} 
          onStop={onStopMessage} 
          onStopAudio={onStopAudio}
          isTyping={isTyping}
          isSpeaking={isSpeaking}
          disabled={isTyping && messages.length > 0 && messages[messages.length-1].role === 'user'} 
        />
        <div className="text-center text-[10px] text-slate-500 mt-4 font-bold tracking-widest uppercase opacity-60">
          Core Processing Unit | Local Inference Restricted
        </div>
      </div>
    </div>
  );
}
