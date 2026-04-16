import { useEffect, useRef, useState, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import { CheckCircle2, Loader2, ShieldAlert, XCircle, ChevronDown, Sparkles, Cpu, Zap, Terminal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

function FeatureCard({ icon: _Icon, title, desc, delay }) {
  const Icon = _Icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="warm-card p-5 flex flex-col gap-3 warm-card-hover"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-soft)' }}>
        <Icon size={18} style={{ color: 'var(--color-primary)' }} />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
      </div>
    </motion.div>
  );
}

const resolveStatus = ({ isTyping, pendingConfirmation, agentEvents = [] }) => {
  const latest = agentEvents[0];
  if (pendingConfirmation) {
    return { label: "Awaiting confirmation", color: "var(--color-warning)", Icon: ShieldAlert };
  }
  if (latest?.type === "error") {
    return { label: "Error", color: "var(--color-error)", Icon: XCircle };
  }
  if (latest?.type === "result" || latest?.type === "done") {
    return { label: "Complete", color: "var(--color-success)", Icon: CheckCircle2 };
  }
  if (isTyping || latest?.type === "start" || latest?.type === "thinking") {
    return { label: "Thinking", color: "var(--color-primary)", Icon: Loader2 };
  }
  return { label: "Ready", color: "var(--color-info)", Icon: CheckCircle2 };
};

export default function ChatWindow({
  messages, isTyping, isWaitingReply, isSpeaking, operatorName, suggestion,
  onSendMessage, onStopMessage, onStopAudio, onFeedback, onRefine, onSuggest, clearSuggestion,
  modelPreference,
  onModelPreferenceChange,
  onOpenSandbox,
  agentEvents = [],
  pendingAgentConfirmation = null,
  pendingConfirmation = null
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
      const behavior = messages.length > prevMessagesLengthRef.current ? "smooth" : "auto";
      const timer = setTimeout(() => scrollToBottom(behavior), 10);
      prevMessagesLengthRef.current = messages.length;
      return () => clearTimeout(timer);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isTyping, isWaitingReply, scrollToBottom]);

  const hasContent = messages.length > 0;
  const chatStatus = resolveStatus({ isTyping, pendingConfirmation: pendingConfirmation || pendingAgentConfirmation, agentEvents });

  return (
    <div className="flex flex-col h-full relative w-full overflow-hidden">
      <div className="flex flex-col h-full w-full relative">
        <div className="flex items-center gap-4 px-6 py-3" style={{ borderBottom: '1px solid var(--color-background-soft)', background: 'var(--color-surface)' }}>
          <div className="flex items-center gap-2">
            <motion.div 
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ 
                background: `${chatStatus.color}15`,
                border: `1px solid ${chatStatus.color}30`
              }}
              animate={chatStatus.label === "Thinking" ? { rotate: 360 } : {}}
              transition={chatStatus.label === "Thinking" ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
            >
              <chatStatus.Icon size={14} className={chatStatus.label === "Thinking" ? "animate-spin" : ""} style={{ color: chatStatus.color }} />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-xs font-medium" style={{ color: chatStatus.color }}>
                {chatStatus.label}
              </span>
              {isSpeaking && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Speaking
                </span>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {hasContent && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-muted)' }}>
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </span>
            )}
            {isTyping && (
              <span className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--color-surface-soft)', color: 'var(--color-primary)' }}>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                />
                Thinking...
              </span>
            )}
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 flex flex-col hide-scrollbar"
          onScroll={handleScroll}
        >
          {!hasContent && !isTyping ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full gap-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative w-28 h-28 flex items-center justify-center"
              >
                <div className="absolute inset-0 rounded-full" style={{ background: 'var(--color-surface-soft)' }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center warm-card" style={{ background: 'var(--color-primary)' }}>
                  <Sparkles size={28} className="text-white" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-center"
              >
                <h2 className="text-xl font-display" style={{ color: 'var(--color-text-primary)' }}>
                  Hello, let's chat
                </h2>
                <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  I'm here to help with anything you need
                </p>
              </motion.div>

              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3">
                <FeatureCard
                  icon={Cpu}
                  title="Smart reasoning"
                  desc="Complex analysis"
                  delay={0.25}
                />
                <FeatureCard
                  icon={Zap}
                  title="Quick responses"
                  desc="Instant answers"
                  delay={0.35}
                />
                <FeatureCard
                  icon={Terminal}
                  title="Code help"
                  desc="Programming assistant"
                  delay={0.45}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto pt-8 pb-32">
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
                  <div className="warm-card px-4 py-3 flex items-center gap-3">
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'var(--color-primary)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Processing...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} className="h-40 shrink-0" />
        </div>

        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              onClick={() => scrollToBottom("smooth")}
              className="absolute z-30 p-2.5 rounded-full warm-card soft-shadow flex items-center justify-center hover:soft-shadow-lg transition-all"
              style={{
                bottom: '12rem', left: '50%', transform: 'translateX(-50%)',
                color: 'var(--color-primary)'
              }}
            >
              <ChevronDown size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        <div
          className="absolute bottom-0 left-0 w-full px-4 pb-6 pt-12"
          style={{
            background: 'linear-gradient(to top, var(--color-background) 0%, var(--color-background) 40%, transparent 100%)',
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
        </div>
      </div>
    </div>
  );
}
