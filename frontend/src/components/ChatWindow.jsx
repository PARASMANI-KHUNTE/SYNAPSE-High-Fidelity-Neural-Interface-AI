import { useEffect, useRef, useState, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import { Bot, Loader2, RefreshCw } from "lucide-react";
import Particles from "./Particles";

export default function ChatWindow({ 
  messages, isTyping, isSpeaking, operatorName, suggestion, 
  onSendMessage, onStopMessage, onFeedback, onSuggest, clearSuggestion,
  modelPreference, onModelPreferenceChange, availableModels
}) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [imageLoadErrorSet, setImageLoadErrorSet] = useState(() => new Set());
  const prevMessagesLengthRef = useRef(0);

  // Stable callbacks — never recreated on render
  const handleImageError = useCallback((url) => {
    setImageLoadErrorSet(prev => {
      if (prev.has(url)) return prev; // already tracked, skip setState entirely
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
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 100;
    
    setIsNearBottom(nearBottom);
    setShowScrollButton(!nearBottom && distanceFromBottom > 300);
  }, []);

  // Improved scroll logic for streaming
  useEffect(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isActuallyNearBottom = scrollHeight - scrollTop - clientHeight < 200;

    // If we're typing and near bottom, OR if a new message just appeared
    if ((isTyping && isActuallyNearBottom) || messages.length > prevMessagesLengthRef.current) {
      // Use instant for chunks (typing), smooth for new messages
      const behavior = messages.length > prevMessagesLengthRef.current ? "smooth" : "instant";
      
      // Delay slightly to ensure DOM has updated scrollHeight
      const timer = setTimeout(() => {
        scrollToBottom(behavior);
      }, 10);
      
      prevMessagesLengthRef.current = messages.length;
      return () => clearTimeout(timer);
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isTyping, scrollToBottom]);

  const hasContent = messages.length > 0;

  return (
    <div className="flex flex-col h-full relative w-full pt-6 pb-0 overflow-hidden">
      
      <Particles isSpeaking={isSpeaking} />

      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isSpeaking ? "opacity-100" : "opacity-40"}`}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute min-w-full bottom-0 left-0 w-full h-48 bg-gradient-to-t from-cyan-500/5 to-transparent"></div>
      </div>
      
      <div className="flex flex-col h-full w-full relative z-10 overflow-hidden">

        <div className="flex items-center gap-3 px-8 py-2 z-20 border-b border-white/5 bg-slate-900/40 backdrop-blur-md rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-cyan-400 animate-pulse" : "bg-emerald-400"}`}></div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">SYNAPSE ACTIVE | NEURAL INTERFACE v2.0</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
            {hasContent && (
              <span className="px-2 py-0.5 bg-slate-800/50 rounded-full">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </span>
            )}
            {isTyping && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-600/20 text-cyan-400 rounded-full">
                <Loader2 size={10} className="animate-spin" />
                Processing
              </span>
            )}
          </div>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-6 pt-10 scroll-smooth flex flex-col gap-4 z-10 custom-scrollbar"
          onScroll={handleScroll}
        >
          {!hasContent && !isTyping ? (
            <div className="m-auto flex flex-col items-center justify-center text-slate-500">
              <div className="relative mb-6">
                <Bot size={80} className="text-blue-400/50" />
                <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-2xl animate-pulse"></div>
              </div>
              <h2 className="text-2xl font-bold tracking-widest uppercase font-sci-fi text-slate-300">Neural Interface Ready</h2>
              <p className="text-sm tracking-wide mt-2">Initialize query to begin processing</p>
              <div className="mt-8 flex flex-col gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-cyan-500/50 rounded-full"></span>
                  <span>Real-time neural processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full"></span>
                  <span>Multi-modal intelligence</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500/50 rounded-full"></span>
                  <span>Adaptive learning system</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg, idx) => (
                <MessageBubble 
                  key={msg.id || msg._id || `msg_${idx}`}
                  id={msg.id || msg._id}
                  role={msg.role} 
                  content={msg.content} 
                  isError={msg.isError} 
                  imageUrls={msg.imageUrls}
                  imageLoadErrors={imageLoadErrorSet}
                  onImageError={handleImageError}
                  isSpeaking={isSpeaking && idx === messages.length - 1}
                  isLast={idx === messages.length - 1}
                  operatorName={operatorName}
                  initialFeedback={msg.feedback}
                  onFeedback={onFeedback}
                />
              ))}
              
              {isTyping && messages.length > 0 && messages[messages.length - 1]?.role !== "assistant" && (
                <MessageBubble 
                  role="assistant"
                  content=""
                  isLoading={true}
                  operatorName={operatorName}
                />
              )}
            </div>
          )}
          
          {/* Dedicated spacer to push content above InputBar */}
          <div ref={bottomRef} className="h-64 mt-10 shrink-0" />
        </div>

        {showScrollButton && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-80 left-1/2 -translate-x-1/2 z-30 p-3 bg-blue-600/80 hover:bg-blue-500 text-white rounded-full shadow-lg transition-all animate-bounce"
            title="Scroll to bottom"
          >
            <RefreshCw size={18} />
          </button>
        )}

        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#020617] via-[#020617]/80 to-transparent p-6 pb-10 z-20">
          <InputBar 
            onSendMessage={onSendMessage} 
            onStopMessage={onStopMessage}
            isTyping={isTyping}
            isSpeaking={isSpeaking}
            suggestion={suggestion}
            onSuggest={onSuggest}
            clearSuggestion={clearSuggestion}
            modelPreference={modelPreference}
            onModelPreferenceChange={onModelPreferenceChange}
            availableModels={availableModels}
            disabled={isTyping && messages.length > 0 && messages[messages.length - 1]?.role === "user"}
          />
          <div className="text-center text-[10px] text-slate-500 mt-4 font-bold tracking-widest uppercase opacity-60">
            Neural Core Processing | SYNAPSE v2.0
          </div>
        </div>
      </div>
    </div>
  );
}
