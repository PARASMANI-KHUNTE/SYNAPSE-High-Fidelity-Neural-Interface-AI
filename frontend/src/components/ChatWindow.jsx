import { useEffect, useRef, useState, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import StatusRing from "./StatusRing";
import ToolFeed from "./ToolFeed";
import { ChevronDown, Target, Zap, Cpu, Terminal } from "lucide-react";
// Remove Particles as it's being offloaded or replaced by the HUD design
import { AnimatePresence, motion } from "framer-motion";

function FeatureCard({ icon: _Icon, title, desc, delay }) {
  const Icon = _Icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
      className="hud-panel p-4 flex flex-col gap-2 relative bg-[rgba(10,17,32,0.8)]"
    >
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#1e3a8a] opacity-50" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#1e3a8a] opacity-50" />
      
      <div className="flex items-start justify-between">
        <Icon size={18} className="text-[var(--color-cyan)]" />
        <span className="font-mono text-[8px] tracking-widest text-slate-600">[ACTV]</span>
      </div>
      <div>
        <p className="text-[10px] font-mono font-bold text-white uppercase">{title}</p>
        <p className="text-[9px] font-mono text-slate-400 mt-1 uppercase">{desc}</p>
      </div>
    </motion.div>
  );
}

export default function ChatWindow({
  messages, isTyping, isWaitingReply, isSpeaking, operatorName, suggestion,
  onSendMessage, onStopMessage, onStopAudio, onFeedback, onRefine, onSuggest, clearSuggestion,
  modelPreference,
  onModelPreferenceChange,
  onOpenSandbox,
  agentEvents = [],
  pendingAgentConfirmation = null,
  showToolFeed = true,
  showStatusRing = true
}) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState(() => new Set());
  const prevMessagesLengthRef = useRef(0);

  const handleImageError = useCallback((url) => {
    setImageLoadErrors(prev => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const dist = scrollHeight - scrollTop - clientHeight;
    setShowScrollButton(dist > 300);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isActuallyNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if ((isWaitingReply && isActuallyNearBottom) || (isTyping && isActuallyNearBottom) || messages.length > prevMessagesLengthRef.current) {
      const behavior = messages.length > prevMessagesLengthRef.current ? "smooth" : "instant";
      const timer = setTimeout(() => scrollToBottom(behavior), 10);
      prevMessagesLengthRef.current = messages.length;
      return () => clearTimeout(timer);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isTyping, isWaitingReply, scrollToBottom]);

  const hasContent = messages.length > 0;

  return (
    <div className="flex flex-col h-full relative w-full overflow-hidden bg-transparent">
      {showStatusRing && (
        <StatusRing
          isTyping={isTyping}
          pendingConfirmation={pendingAgentConfirmation}
          agentEvents={agentEvents}
        />
      )}
      {showToolFeed && <ToolFeed events={agentEvents} />}
      
      {/* ── Background Tactical Grid Overlay ── */}
      <div className="absolute inset-0 pointer-events-none bg-tactical-grid opacity-30 z-0" />

      <div className="flex flex-col h-full w-full relative z-10">
        {/* ── Header ──────────────────────── */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-[var(--color-tactical-blue)] bg-[rgba(5,7,15,0.85)] relative">
          <div className="absolute left-0 bottom-0 w-8 h-[2px] bg-[var(--color-neon-red)]" />
          
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 border ${isSpeaking ? 'border-[var(--color-neon-red)] bg-transparent' : 'border-[var(--color-cyan)] bg-transparent'} rounded-sm flex items-center justify-center p-0.5`}>
               <div className={`w-full h-full ${isSpeaking ? 'bg-[var(--color-neon-red)] animate-flicker' : 'bg-[var(--color-cyan)] animate-pulse'}`} />
            </div>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-300">
              {isSpeaking ? 'SYSTEM.BROADCASTING' : 'SECURE.CHANNEL_09'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3 font-mono">
            {hasContent && (
              <span className="text-[9px] px-2 py-1 border border-[var(--color-grid)] text-slate-400 bg-[rgba(30,58,138,0.2)]">
                PKG_CNT: {messages.length.toString().padStart(4, '0')}
              </span>
            )}
            {isTyping && (
              <span className="flex items-center gap-2 text-[9px] px-3 py-1 border border-[var(--color-neon-orange)] text-[var(--color-neon-orange)] bg-[rgba(255,144,0,0.1)]">
                <span className="w-1.5 h-1.5 bg-[var(--color-neon-orange)] animate-flicker" />
                AWAITING_RESPONSE...
              </span>
            )}
            <div className="h-5 w-[1px] bg-[var(--color-tactical-blue)]" />
            <span className="text-[9px] text-[#1e3a8a] tracking-widest hidden sm:block">STATUS: ENCRYPTED</span>
          </div>
        </div>

        {/* ── Message Area ─────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 pt-8 pb-2 flex flex-col gap-1 hide-scrollbar"
          onScroll={handleScroll}
        >
          {!hasContent && !isTyping ? (
            /* ── Empty State ── */
            <div className="m-auto flex flex-col items-center justify-center max-w-lg w-full gap-8 py-10 relative">
              {/* Radar/Target Crosshair Hero */}
              <div className="relative w-32 h-32 flex items-center justify-center pointer-events-none">
                {/* Outer Target Circle */}
                <div className="absolute w-full h-full border border-dashed border-[var(--color-tactical-blue)] rounded-full animate-[spin_30s_linear_infinite]" />
                <div className="absolute w-[90%] h-[90%] border border-[rgba(0,240,255,0.2)] rounded-full" />
                
                {/* Crosshairs */}
                <div className="absolute w-full h-[1px] bg-[var(--color-grid)]" />
                <div className="absolute h-full w-[1px] bg-[var(--color-grid)]" />
                
                {/* Center Core */}
                <div className="relative w-8 h-8 border border-[var(--color-neon-red)] flex items-center justify-center bg-[rgba(255,42,42,0.1)] shadow-[0_0_15px_rgba(255,42,42,0.4)]">
                   <Target size={14} className="text-[var(--color-neon-red)]" />
                </div>
              </div>

              <div className="text-center font-mono">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-lg text-glow-cyan uppercase tracking-widest mb-2"
                >
                  SYSTEM READY
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-[10px] text-slate-500 tracking-[0.2em] uppercase"
                >
                  Awaiting directive input from terminal
                </motion.p>
              </div>

              {/* Feature cards row */}
              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3">
                <FeatureCard
                  icon={Cpu}
                  title="Neural Core"
                  desc="Sys_Logic Engaged"
                  delay={0.35}
                />
                <FeatureCard
                  icon={Zap}
                  title="Live Data Stream"
                  desc="Socket Conns Active"
                  delay={0.45}
                />
                <FeatureCard
                  icon={Terminal}
                  title="Code Env"
                  desc="Sandbox Initialized"
                  delay={0.55}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1 w-full max-w-4xl mx-auto">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id || msg._id || `msg_${idx}`}
                    id={msg.id || msg._id}
                    role={msg.role}
                    content={msg.content}
                    isError={msg.isError}
                    imageUrls={msg.imageUrls}
                    imageLoadErrors={imageLoadErrors}
                    onImageError={handleImageError}
                    isSpeaking={isSpeaking && idx === messages.length - 1}
                    isLast={idx === messages.length - 1}
                    operatorName={operatorName}
                    initialFeedback={msg.feedback}
                    onFeedback={onFeedback}
                    onRefine={onRefine}
                  />
                ))}
              </AnimatePresence>

              {(isWaitingReply || (isTyping && messages.length > 0 && messages[messages.length - 1]?.role !== "assistant")) && (
                <div className="flex justify-start w-full my-4">
                  <div className="hud-panel p-3 border-l-2 border-l-[var(--color-neon-orange)] flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-[var(--color-neon-orange)] animate-flicker inline-block" />
                    <span className="font-mono text-[10px] text-[var(--color-neon-orange)] uppercase tracking-widest">
                       Processing Data Stream...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} className="h-52 shrink-0" />
        </div>

        {/* Scroll to bottom */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={() => scrollToBottom("smooth")}
              className="absolute z-30 p-2.5 hud-panel bg-[var(--color-surface)] border-[var(--color-cyan)] text-[var(--color-cyan)] flex items-center justify-center hover:bg-[rgba(0,240,255,0.1)] transition-colors"
              style={{
                bottom: '12rem', left: '50%', transform: 'translateX(-50%)'
              }}
            >
              <ChevronDown size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Input Area ───────────────────── */}
        <div
          className="absolute bottom-0 left-0 w-full px-4 pb-6 pt-12"
          style={{
            background: 'linear-gradient(to top, var(--color-void) 0%, var(--color-void) 40%, transparent 100%)',
            zIndex: 20,
          }}
        >
          <InputBar
            onSendMessage={onSendMessage}
            onStopMessage={onStopMessage}
            onStopAudio={onStopAudio}
            isTyping={isTyping}
            isSpeaking={isSpeaking}
            suggestion={suggestion}
            onSuggest={onSuggest}
            clearSuggestion={clearSuggestion}
            modelPreference={modelPreference}
            onModelPreferenceChange={onModelPreferenceChange}
            onOpenSandbox={onOpenSandbox}
            disabled={isTyping && messages.length > 0 && messages[messages.length - 1]?.role === "user"}
          />
          <div className="flex w-full items-center justify-between max-w-3xl mx-auto mt-4 px-2 opacity-50">
             <div className="w-[10%] h-[1px] bg-[var(--color-tactical-blue)]" />
             <div className="text-center font-mono text-[8px] tracking-[0.3em] text-[var(--color-cyan)] uppercase">
               SYSTEM // LOCAL_HOST:5173 // SYNAPSE_HUD_V2
             </div>
             <div className="w-[10%] h-[1px] bg-[var(--color-tactical-blue)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
