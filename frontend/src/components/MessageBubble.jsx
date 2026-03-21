import { User, Bot, AlertCircle, Copy, Check, Play, ExternalLink, Cpu, ThumbsUp, ThumbsDown, Loader2, ImageOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";
import { useState, useCallback, useRef, useEffect } from "react";
import VoiceVisualizer from "./VoiceVisualizer";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const FEEDBACK_COOLDOWN = 2000;

const InteractiveCodeBlock = ({ inline, className, children }) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : null;
  const codeText = String(children).replace(/\n$/, "");

  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      console.error("Copy failed:", err);
    });
  }, [codeText]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setOutput(null);
    setError(null);
    setOutput("Executing script...");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_URL}/api/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeText, language }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.timedOut) {
        setOutput(`[Timeout] Execution timed out after 30 seconds\n\n${data.output || ""}`);
      } else if (data.error) {
        setOutput(data.output 
          ? `${data.output}\n\n[Error]: ${data.error}` 
          : `[Error]: ${data.error}`
        );
      } else {
        setOutput(data.output || "(Code executed cleanly without stdout)");
      }
      
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Execution timed out");
      } else {
        setError(`Network Error: ${err.message}`);
      }
    } finally {
      setIsRunning(false);
    }
  }, [codeText, language, isRunning]);

  const isRunnable = language && ["javascript", "js", "python", "py", "node"].includes(language.toLowerCase());

  if (!inline && language) {
    return (
      <div className="bg-[#020617]/80 rounded-xl shadow-2xl my-6 overflow-hidden border border-cyan-500/20 flex flex-col transition-all group/code">
        <div className="bg-slate-900/90 px-4 py-2 border-b border-cyan-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={12} className="text-cyan-400" />
            <span className="text-[10px] text-cyan-400 font-bold tracking-[0.2em] uppercase">{language} MODULE</span>
          </div>
          <div className="flex gap-2">
            {isRunnable && (
              <button 
                onClick={handleRun} 
                disabled={isRunning}
                className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-400/10 px-2.5 py-1.5 rounded transition-all tracking-widest uppercase border border-emerald-500/20 disabled:opacity-50"
              >
                {isRunning ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Play size={10} fill="currentColor" />
                )}
                {isRunning ? "Processing" : "Execute"}
              </button>
            )}
            <button 
              onClick={handleCopy} 
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 hover:bg-blue-400/10 px-2.5 py-1.5 rounded transition-all tracking-widest uppercase border border-blue-500/20"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />} 
              {copied ? "Cached" : "Clone"}
            </button>
          </div>
        </div>
        
        <SyntaxHighlighter 
          language={language} 
          style={vscDarkPlus} 
          customStyle={{ 
            margin: 0, 
            padding: "20px", 
            fontSize: "13px", 
            background: "transparent",
            maxHeight: "400px",
            overflow: "auto"
          }}
          showLineNumbers={codeText.split("\n").length > 5}
        >
          {codeText}
        </SyntaxHighlighter>
        
        {error && (
          <div className="border-t border-red-500/20 p-4 bg-red-500/10 font-mono text-xs text-red-300 whitespace-pre-wrap">
            <span className="text-red-500 uppercase tracking-widest font-bold block mb-2 text-[10px]">ERROR &gt;</span>
            {error}
          </div>
        )}
        
        {output && (
          <div className="border-t border-cyan-500/20 p-4 bg-black/40 font-mono text-xs text-emerald-300 whitespace-pre-wrap max-h-72 overflow-y-auto">
            <span className="text-emerald-500/60 uppercase tracking-widest font-bold block mb-2 text-[10px]">OUTPUT LOG &gt;</span>
            {output}
          </div>
        )}
      </div>
    );
  }

  return <code className="bg-slate-800/80 text-cyan-300 px-1.5 py-0.5 rounded text-xs font-mono border border-cyan-500/20">{children}</code>;
};

const ImageWithFallback = ({ src, alt, className, onError, loadErrors }) => {
  const hasLoadError = loadErrors?.has(src);
  const [hasImgError, setHasImgError] = useState(false);
  
  const handleError = useCallback(() => {
    setHasImgError(true);
    onError?.(src);
  }, [src, onError]);

  if (hasLoadError || hasImgError || !src) {
    return (
      <div className={clsx(className, "flex items-center justify-center bg-slate-800/50 border border-slate-700 rounded-xl")}>
        <div className="text-center text-slate-500">
          <ImageOff size={24} className="mx-auto mb-1" />
          <span className="text-xs">Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt || "media"} 
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
};

export default function MessageBubble({ 
  id, role, content, isError, isLoading, imageUrls, imageLoadErrors, onImageError,
  isSpeaking, operatorName, initialFeedback, onFeedback 
}) {
  const isUser = role === "user";
  const [feedback, setFeedback] = useState(initialFeedback);
  const [feedbackCooldown, setFeedbackCooldown] = useState(false);
  const feedbackTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setFeedback(initialFeedback);
  }, [initialFeedback]);

  const handleFeedback = useCallback((type) => {
    if (feedbackCooldown) return;
    
    setFeedback(type);
    onFeedback?.(id, type);
    
    setFeedbackCooldown(true);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackCooldown(false);
    }, FEEDBACK_COOLDOWN);
  }, [id, onFeedback, feedbackCooldown]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={clsx(
        "flex w-full max-w-5xl mx-auto gap-5 group px-4 pb-4 mt-10 relative",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className="relative shrink-0 flex items-center justify-center w-12 h-12">
        <div className={clsx(
          "relative z-10 w-full h-full rounded-full flex items-center justify-center border transition-all duration-500",
          isUser 
            ? "bg-blue-600 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
            : isError 
              ? "bg-red-500/20 border-red-500/50 text-red-400" 
              : isLoading
                ? "bg-slate-800 border-cyan-500/30"
                : "bg-slate-900 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        )}>
          {isUser ? (
            <User size={24} />
          ) : isError ? (
            <AlertCircle size={24} />
          ) : isLoading ? (
            <Loader2 size={20} className="text-cyan-400 animate-spin" />
          ) : (
            <Bot size={24} className={clsx("text-cyan-400", isSpeaking ? "animate-pulse" : "animate-float")} />
          )}
        </div>
        
        {!isUser && !isError && !isLoading && <VoiceVisualizer isActive={isSpeaking} />}
        
        {!isUser && !isError && !isLoading && !isSpeaking && (
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
        )}
      </div>

      <div className={clsx(
        "relative px-2 py-1 text-sm/relaxed max-w-[calc(100%-4rem)] font-sans transition-all",
        isUser 
          ? "bg-blue-600/20 border border-blue-500/30 text-blue-50 rounded-2xl px-6 py-4 rounded-tr-sm shadow-xl backdrop-blur-md" 
          : isError
            ? "bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl px-6 py-4 rounded-tl-sm"
            : isLoading
              ? "text-slate-100"
              : "text-slate-100"
      )}>
        
        {!isUser && !isError && !isLoading && (
          <div className="absolute -inset-4 bg-blue-500/5 rounded-[40px] blur-2xl -z-10"></div>
        )}

        <div className={clsx(
          "absolute -top-8 text-[9px] font-black tracking-[0.2em] uppercase opacity-50",
          isUser ? "right-0" : "left-0"
        )}>
          {isUser ? `Identity: ${operatorName || "Operator"}` : "Identity: SYNAPSE (Neural)"}
        </div>

        {imageUrls && imageUrls.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-4">
            {imageUrls.map((url, i) => (
              <div key={`${url}-${i}`} className="relative group/img overflow-hidden rounded-xl border border-white/10 shadow-lg">
                <ImageWithFallback
                  src={url}
                  alt={`media-${i}`}
                  className="max-w-[280px] max-h-[280px] object-cover transition-transform duration-700 group-hover/img:scale-110"
                  onError={onImageError}
                  loadErrors={imageLoadErrors}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300"></div>
              </div>
            ))}
          </div>
        )}
        
        {content ? (
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 selection:bg-cyan-500/30">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({...props}) => <p className="mb-4 last:mb-0 leading-relaxed font-normal" {...props} />,
                code: InteractiveCodeBlock,
                a: ({...props}) => (
                  <a 
                    className="text-cyan-400 font-bold underline underline-offset-4 hover:text-cyan-300 inline-flex items-center gap-1 transition-all pointer-events-auto cursor-pointer relative z-10" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    {...props}
                  >
                    {props.children} <ExternalLink size={12} />
                  </a>
                ),
                h1: ({...props}) => <h1 className="text-lg font-bold text-white mb-4 mt-6 first:mt-0 font-sci-fi tracking-widest border-l-2 border-cyan-500 pl-3" {...props} />,
                h2: ({...props}) => <h2 className="text-base font-bold text-white mb-3 mt-5 font-sci-fi tracking-wider border-l-2 border-blue-500/50 pl-3" {...props} />,
                h3: ({...props}) => <h3 className="text-sm font-bold text-slate-200 mb-2 mt-4" {...props} />,
                ul: ({...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 marker:text-cyan-500" {...props} />,
                ol: ({...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 marker:text-cyan-500" {...props} />,
                li: ({...props}) => <li className="text-slate-300" {...props} />,
                blockquote: ({...props}) => <blockquote className="border-l-4 border-cyan-500/50 pl-4 italic text-slate-400 my-4" {...props} />,
                table: ({...props}) => <div className="overflow-x-auto my-4"><table className="min-w-full border border-slate-700" {...props} /></div>,
                th: ({...props}) => <th className="border border-slate-700 px-4 py-2 bg-slate-800 text-left text-xs uppercase tracking-wider" {...props} />,
                td: ({...props}) => <td className="border border-slate-700 px-4 py-2 text-sm" {...props} />,
                hr: () => <hr className="border-slate-700 my-6" />
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-3 py-3 px-1">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]"></div>
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-cyan-500/60 animate-pulse">Syncing...</span>
          </div>
        ) : null}

        {!isUser && !isError && !isLoading && content && (
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-lg p-1 border border-white/5">
              <button 
                onClick={() => handleFeedback("positive")}
                disabled={feedbackCooldown}
                className={clsx(
                  "p-1.5 rounded transition-all hover:bg-emerald-500/20",
                  feedback === "positive" ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 hover:text-emerald-400",
                  feedbackCooldown && "opacity-50 cursor-not-allowed"
                )}
                title="Accurate & Relevant"
              >
                <ThumbsUp size={14} fill={feedback === "positive" ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={() => handleFeedback("negative")}
                disabled={feedbackCooldown}
                className={clsx(
                  "p-1.5 rounded transition-all hover:bg-red-500/20",
                  feedback === "negative" ? "text-red-400 bg-red-500/10" : "text-slate-500 hover:text-red-400",
                  feedbackCooldown && "opacity-50 cursor-not-allowed"
                )}
                title="Inaccurate or Irrelevant"
              >
                <ThumbsDown size={14} fill={feedback === "negative" ? "currentColor" : "none"} />
              </button>
            </div>
            
            <button className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-cyan-400 transition-colors flex items-center gap-1.5">
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span> 
              Neural Refinement
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
