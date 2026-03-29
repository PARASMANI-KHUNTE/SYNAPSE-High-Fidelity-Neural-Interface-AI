import {
  User, AlertCircle, Copy, Check, Play, ExternalLink,
  ThumbsUp, ThumbsDown, Loader2, ImageOff, Terminal, Zap, ShieldAlert
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";
import { useState, useCallback, useRef, useEffect } from "react";
import VoiceVisualizer from "./VoiceVisualizer";
 
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const FEEDBACK_COOLDOWN = 2000;

/* ── Interactive Code Block ─────────────────── */
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
    }).catch(console.error);
  }, [codeText]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setOutput("Executing sequence...");
    setError(null);
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${API_URL}/api/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeText, language }),
        signal: controller.signal
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`API_FAULT: ${res.status}`);
      const data = await res.json();
      if (data.timedOut) {
        setOutput(`[TIMEOUT_FAULT] ${data.output || ""}`);
      } else if (data.error) {
        setOutput(data.output ? `${data.output}\n\n[ERR_DUMP]: ${data.error}` : `[ERR_DUMP]: ${data.error}`);
      } else {
        setOutput(data.output || "(NO_OUTPUT)");
      }
    } catch (err) {
      setError(err.name === "AbortError" ? "EXEC_TIMEOUT" : `FAULT: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [codeText, language, isRunning]);

  const isRunnable = language && ["javascript", "js", "python", "py", "node"].includes(language.toLowerCase());

  if (!inline && language) {
    return (
      <div
        className="overflow-hidden my-4 flex flex-col font-mono"
        style={{
          background: 'rgba(5, 7, 15, 0.9)',
          border: '1px solid var(--color-tactical-blue)',
        }}
      >
        {/* Code header */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            background: 'var(--color-surface)',
            borderBottom: '1px dashed var(--color-tactical-blue)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-cyan)]">_</span>
            <span className="font-bold text-[9px] tracking-widest uppercase text-white">
              LANG={language}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isRunnable && (
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-2 text-[10px] uppercase font-bold px-3 py-1 transition-all duration-200 disabled:opacity-50 border"
                style={{
                  background: isRunning ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.05)',
                  border: isRunning ? '1px solid #4ade80' : '1px solid rgba(74,222,128,0.3)',
                  color: '#4ade80',
                }}
              >
                {isRunning ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} fill="currentColor" />}
                {isRunning ? "EXEC_ING" : "EXEC"}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-[10px] uppercase font-bold px-3 py-1 transition-all duration-200 border"
              style={{
                background: copied ? 'rgba(0,240,255,0.15)' : 'rgba(30,58,138,0.2)',
                border: copied ? '1px solid var(--color-cyan)' : '1px solid var(--color-tactical-blue)',
                color: copied ? 'var(--color-cyan)' : '#94a3b8',
              }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "COPIED" : "CP"}
            </button>
          </div>
        </div>

        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '16px',
            fontSize: '12px',
            background: 'transparent',
            maxHeight: '400px',
            overflow: 'auto',
          }}
          showLineNumbers={codeText.split("\n").length > 4}
        >
          {codeText}
        </SyntaxHighlighter>

        {error && (
          <div
            className="px-4 py-3 font-mono text-[10px] whitespace-pre-wrap uppercase tracking-wider"
            style={{
              borderTop: '1px solid var(--color-neon-red)',
              background: 'rgba(255,42,42,0.1)',
              color: 'var(--color-neon-red)',
            }}
          >
            <span className="font-bold flex items-center gap-2 mb-1">
              <ShieldAlert size={12} /> ERR_DUMP
            </span>
            {error}
          </div>
        )}
        {output && (
          <div
            className="px-4 py-3 font-mono text-[10px] whitespace-pre-wrap max-h-64 overflow-y-auto"
            style={{
              borderTop: '1px solid #4ade80',
              background: 'rgba(0,0,0,0.6)',
              color: '#4ade80',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5 opacity-80 uppercase tracking-widest font-bold">
              <Terminal size={10} />
              STDOUT
            </div>
            {output}
          </div>
        )}
      </div>
    );
  }

  return (
    <code
      className="font-mono text-[11px] px-1.5 py-0.5"
      style={{
        background: 'rgba(0,240,255,0.1)',
        color: 'var(--color-cyan)',
        border: '1px solid rgba(0,240,255,0.2)',
      }}
    >
      {children}
    </code>
  );
};

/* ── Image with Fallback ─────────────────────── */
const ImageWithFallback = ({ src, alt, className, onError, loadErrors }) => {
  const hasError = loadErrors?.has(src);
  const [imgErr, setImgErr] = useState(false);
  const handleError = useCallback(() => { setImgErr(true); onError?.(src); }, [src, onError]);
  if (hasError || imgErr || !src) {
    return (
      <div className={clsx(className, "flex items-center justify-center hud-panel bg-black border-[var(--color-neon-red)]")}>
        <div className="text-center font-mono text-glow-red">
          <ImageOff size={22} className="mx-auto mb-1 text-[var(--color-neon-red)]" />
          <span className="text-[9px] tracking-widest uppercase">IMG_ERR</span>
        </div>
      </div>
    );
  }
  return <img src={src} alt={alt || "media"} className={clsx(className, "border border-[var(--color-tactical-blue)]")} onError={handleError} loading="lazy" />;
};

/* ── Message Bubble ──────────────────────────── */
export default function MessageBubble({
  id, role, content, isError, isLoading, imageUrls, imageLoadErrors, onImageError,
  isSpeaking, operatorName, initialFeedback, onFeedback, onRefine
}) {
  const isUser = role === "user";
  const [feedback, setFeedback] = useState(initialFeedback);
  const [feedbackCooldown, setFeedbackCooldown] = useState(false);
  const feedbackTimeoutRef = useRef(null);

  useEffect(() => () => { if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current); }, []);
  useEffect(() => { setFeedback(initialFeedback); }, [initialFeedback]);

  const handleFeedback = useCallback((type) => {
    if (feedbackCooldown) return;
    setFeedback(type);
    onFeedback?.(id, type);
    setFeedbackCooldown(true);
    feedbackTimeoutRef.current = setTimeout(() => setFeedbackCooldown(false), FEEDBACK_COOLDOWN);
  }, [id, onFeedback, feedbackCooldown]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 10 : -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={clsx(
        "flex w-full mb-6 relative group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* ── Content ── */}
      <div
        className={clsx(
          "relative text-[13px] w-full transition-all border",
          isUser ? "bg-[rgba(30,58,138,0.1)] border-[#1e3a8a] ml-16" : isError ? "bg-[rgba(255,42,42,0.05)] border-[var(--color-neon-red)] mr-16" : "bg-[rgba(10,17,32,0.6)] border-[rgba(0,240,255,0.2)] mr-16"
        )}
      >
        {/* Left/Right Tactical Bar */}
        <div 
          className="absolute top-0 bottom-0 w-1" 
          style={{
            left: isUser ? 'auto' : 0,
            right: isUser ? 0 : 'auto',
            background: isUser ? '#1e3a8a' : isError ? 'var(--color-neon-red)' : 'var(--color-cyan)',
            boxShadow: !isUser && !isError ? '0 0 10px rgba(0,240,255,0.3)' : 'none'
          }}
        />

        <div className={clsx("p-4", isUser ? "pr-6" : "pl-6")}>
          {/* Header Row */}
          <div className="flex items-center gap-3 mb-3 border-b border-dashed border-slate-700/50 pb-2">
             <div className="font-mono text-[9px] tracking-[0.2em] font-bold">
               {isUser ? (
                  <span className="text-[#94a3b8] uppercase">[{operatorName || "OPERATOR"}]</span>
               ) : (
                  <span className={isError ? "text-[var(--color-neon-red)] text-glow-red" : "text-[var(--color-cyan)] text-glow-cyan"}>
                    {isError ? "SYS.FAULT" : "SYNAPSE.CORE"}
                  </span>
               )}
             </div>
             {isLoading && (
               <div className="flex items-center gap-2">
                 <Loader2 size={10} className="animate-spin text-[var(--color-cyan)]" />
                 <span className="font-mono text-[8px] text-[var(--color-cyan)] tracking-widest animate-pulse">AWAITING_DATA...</span>
               </div>
             )}
             {isSpeaking && (
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-[var(--color-neon-red)] animate-flicker border border-[var(--color-neon-red)]" />
                 <span className="font-mono text-[8px] text-[var(--color-neon-red)] tracking-widest">BROADCASTING</span>
               </div>
             )}
          </div>

          {/* Images */}
          {imageUrls?.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative group/img overflow-hidden border border-[var(--color-tactical-blue)]"
                >
                  <ImageWithFallback
                    src={url}
                    alt={`media-${i}`}
                    className="max-w-[200px] max-h-[200px] object-cover"
                    onError={onImageError}
                    loadErrors={imageLoadErrors}
                  />
                  {/* Scanline overlay over image */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-tactical-blue)]/30 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none" />
                </div>
              ))}
            </div>
          )}

          {/* Text content */}
          {content ? (
            <div
              className={clsx(
                "synapse-prose font-mono text-sm max-w-none leading-relaxed",
                isError ? "text-[var(--color-neon-red)]" : "text-[#e2e8f0]"
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                  code: InteractiveCodeBlock,
                  a: ({ ...props }) => (
                    <a
                      className="text-[var(--color-cyan)] underline underline-offset-4 decoration-1 decoration-[var(--color-cyan)] decoration-dashed hover:decoration-solid uppercase text-[11px] font-bold transition-all inline-flex items-center gap-1"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      [{props.children}] <ExternalLink size={10} />
                    </a>
                  ),
                  h1: ({ ...props }) => (
                    <h1
                      className="text-lg font-bold mb-3 mt-6 uppercase text-white"
                      style={{ borderLeft: '4px solid var(--color-cyan)', paddingLeft: '12px' }}
                      {...props}
                    />
                  ),
                  h2: ({ ...props }) => (
                    <h2
                      className="text-base font-bold mb-3 mt-5 text-[var(--color-cyan)] uppercase"
                      style={{ borderLeft: '2px dashed var(--color-cyan)', paddingLeft: '12px' }}
                      {...props}
                    />
                  ),
                  h3: ({ ...props }) => <h3 className="text-sm font-bold mb-2 mt-4 text-[#94a3b8] uppercase" {...props} />,
                  ul: ({ ...props }) => <ul className="list-square pl-6 mb-4 space-y-2 marker:text-[var(--color-cyan)]" {...props} />,
                  ol: ({ ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-2 marker:font-bold marker:text-[var(--color-tactical-blue)]" {...props} />,
                  li: ({ ...props }) => <li className="text-[#cbd5e1]" {...props} />,
                  blockquote: ({ ...props }) => (
                    <blockquote
                      className="pl-4 my-4 font-mono text-[11px]"
                      style={{ borderLeft: '2px solid var(--color-neon-orange)', color: '#94a3b8', background: 'rgba(255,144,0,0.05)', padding: '10px 16px' }}
                      {...props}
                    />
                  ),
                  table: ({ ...props }) => (
                    <div className="overflow-x-auto my-5 border border-[var(--color-tactical-blue)]">
                      <table className="min-w-full text-left" {...props} />
                    </div>
                  ),
                  th: ({ ...props }) => (
                    <th className="px-4 py-2 font-bold text-[10px] uppercase tracking-widest bg-[rgba(30,58,138,0.3)] text-[var(--color-cyan)] border-b border-[var(--color-tactical-blue)]" {...props} />
                  ),
                  td: ({ ...props }) => (
                    <td className="px-4 py-2 text-xs border-b border-[rgba(30,58,138,0.3)] text-[#cbd5e1]" {...props} />
                  ),
                  hr: () => <hr className="my-6 border-dashed border-[var(--color-tactical-blue)]" />,
                  strong: ({ ...props }) => <strong className="text-white font-bold tracking-tight" {...props} />,
                  em: ({ ...props }) => <em className="text-[var(--color-neon-orange)] not-italic underline decoration-dashed decoration-1" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : isLoading ? (
            /* Loading terminal blocks */
            <div className="flex items-center gap-1.5 py-2">
              {[1,2,3].map(n => (
                <div
                  key={n}
                  className="w-2 h-4 bg-[var(--color-cyan)]"
                  style={{ animation: `flicker ${0.4 + n * 0.15}s infinite alternate` }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* ── Feedback row ── */}
        {!isUser && !isError && !isLoading && content && (
          <div className="absolute right-2 -bottom-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center bg-[rgba(5,7,15,0.95)] border border-[var(--color-tactical-blue)] shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
              <button
                onClick={() => handleFeedback("positive")}
                disabled={feedbackCooldown}
                className="p-1.5 transition-colors border-r border-[var(--color-tactical-blue)] hover:bg-[rgba(74,222,128,0.1)] hover:text-[#4ade80] text-slate-500 disabled:opacity-40"
              >
                <ThumbsUp size={12} fill={feedback === "positive" ? "currentColor" : "none"} className={feedback === "positive" ? "text-[#4ade80]" : ""} />
              </button>
              <button
                onClick={() => handleFeedback("negative")}
                disabled={feedbackCooldown}
                className="p-1.5 transition-colors border-r border-[var(--color-tactical-blue)] hover:bg-[rgba(244,63,94,0.1)] hover:text-[#f43f5e] text-slate-500 disabled:opacity-40"
              >
                <ThumbsDown size={12} fill={feedback === "negative" ? "currentColor" : "none"} className={feedback === "negative" ? "text-[#f43f5e]" : ""} />
              </button>
              <button
                className="px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-[#94a3b8] hover:text-[var(--color-cyan)] hover:bg-[rgba(0,240,255,0.1)] transition-colors"
                onClick={() => onRefine?.(id, content)}
              >
                [ SYS_REFINE ]
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
