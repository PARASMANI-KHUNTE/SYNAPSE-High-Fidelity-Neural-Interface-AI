import {
  User, AlertCircle, Copy, Check, Play, ExternalLink,
  ThumbsUp, ThumbsDown, Loader2, ImageOff, Terminal, Sparkles, ShieldAlert
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
const ACCESS_TOKEN_KEY = "synapse_access_token";

const warmSyntaxTheme = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: '#1F2D3D',
    borderRadius: '12px',
  },
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    color: '#ECF7F8',
  },
};

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
    setOutput("Running...");
    setError(null);
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 30000);
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
      const res = await fetch(`${API_URL}/api/sandbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ code: codeText, language }),
        signal: controller.signal
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      if (data.timedOut) {
        setOutput(`Timeout: ${data.output || ""}`);
      } else if (data.error) {
        setOutput(data.output ? `${data.output}\n\nError: ${data.error}` : `Error: ${data.error}`);
      } else {
        setOutput(data.output || "(no output)");
      }
    } catch (err) {
      setError(err.name === "AbortError" ? "Execution timed out" : `Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [codeText, language, isRunning]);

  const isRunnable = language && ["javascript", "js", "node"].includes(language.toLowerCase());

  if (!inline && language) {
    return (
      <div
        className="overflow-hidden my-4 flex flex-col rounded-xl"
        style={{
          background: '#1F2D3D',
          border: '1px solid var(--color-background-soft)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            background: 'var(--color-text-primary)',
            borderBottom: '1px solid var(--color-background-soft)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-primary-soft)' }}>
              {language}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isRunnable && (
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50"
                style={{
                  background: isRunning ? 'var(--color-success)20' : 'var(--color-success)15',
                  color: 'var(--color-success)',
                  border: '1px solid var(--color-success)30',
                }}
              >
                {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                {isRunning ? "Running" : "Run"}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
              style={{
                background: copied ? 'var(--color-primary)15' : 'var(--color-background-soft)50',
                color: copied ? 'var(--color-primary)' : 'var(--color-primary-soft)',
                border: copied ? '1px solid var(--color-primary)30' : '1px solid transparent',
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <SyntaxHighlighter
          language={language}
          style={warmSyntaxTheme}
          customStyle={{
            margin: 0,
            padding: '16px',
            fontSize: '13px',
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
            className="px-4 py-3 text-sm"
            style={{
              borderTop: '1px solid var(--color-error)30',
              background: 'var(--color-error)10',
              color: 'var(--color-error)',
            }}
          >
            <span className="font-medium flex items-center gap-2 mb-1">
              <ShieldAlert size={14} /> Error
            </span>
            {error}
          </div>
        )}
        {output && (
          <div
            className="px-4 py-3 text-sm"
            style={{
              borderTop: '1px solid var(--color-success)30',
              background: '#1F2D3D',
              color: 'var(--color-success)',
            }}
          >
            <div className="font-medium flex items-center gap-2 mb-1.5 opacity-80">
              <Terminal size={12} />
              Output
            </div>
            {output}
          </div>
        )}
      </div>
    );
  }

  return (
    <code
      className="text-sm px-2 py-1 rounded-lg font-mono"
      style={{
        background: 'var(--color-surface-soft)',
        color: 'var(--color-primary)',
        border: '1px solid var(--color-background-soft)',
      }}
    >
      {children}
    </code>
  );
};

const ImageWithFallback = ({ src, alt, className, onError, loadErrors }) => {
  const hasError = loadErrors?.has(src);
  const [imgErr, setImgErr] = useState(false);
  const handleError = useCallback(() => { setImgErr(true); onError?.(src); }, [src, onError]);
  if (hasError || imgErr || !src) {
    return (
      <div className="flex items-center justify-center rounded-xl" style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-background-soft)', width: '200px', height: '200px' }}>
        <div className="text-center">
          <ImageOff size={20} className="mx-auto mb-1" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Image unavailable</span>
        </div>
      </div>
    );
  }
  return <img src={src} alt={alt || "media"} className={clsx(className, "rounded-xl")} onError={handleError} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
};

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={clsx(
        "flex w-full mb-4 relative group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={clsx(
          "relative text-sm w-full transition-all warm-card",
          isUser ? "ml-16" : "mr-16"
        )}
        style={isUser ? { background: 'var(--color-primary)', border: '1px solid var(--color-primary)' } : isError ? { border: '1px solid var(--color-error)30' } : undefined}
      >
        <div className={clsx("p-4", isUser ? "pr-5" : "pl-5")}>
          <div className="flex items-center gap-3 mb-2 pb-2" style={{ borderBottom: '1px solid var(--color-background-soft)' }}>
            <div className="flex items-center gap-2">
              {isUser ? (
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <User size={14} style={{ color: 'white' }} />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
                  <Sparkles size={14} className="text-white" />
                </div>
              )}
              <span className="text-xs font-medium" style={{ color: isUser ? 'white' : 'var(--color-text-primary)' }}>
                {isUser ? (operatorName || "You") : isError ? "Error" : "Synapse"}
              </span>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs animate-pulse" style={{ color: 'var(--color-text-muted)' }}>Thinking...</span>
              </div>
            )}
            {isSpeaking && (
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                />
                <span className="text-xs" style={{ color: 'var(--color-accent)' }}>Speaking</span>
              </div>
            )}
          </div>

          {imageUrls?.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative group/img overflow-hidden rounded-xl"
                >
                  <ImageWithFallback
                    src={url}
                    alt={`media-${i}`}
                    className="max-w-[200px] max-h-[200px] object-cover"
                    onError={onImageError}
                    loadErrors={imageLoadErrors}
                    style={{ border: '1px solid var(--color-background-soft)' }}
                  />
                </div>
              ))}
            </div>
          )}

          {content ? (
            <div
              className={clsx(
                "prose prose-sm max-w-none leading-relaxed",
                isError ? "text-[var(--color-error)]" : isUser ? "text-white" : "text-[var(--color-text-primary)]"
              )}
              style={{ '--tw-prose-body': 'var(--color-text-primary)', '--tw-prose-headings': 'var(--color-text-primary)' }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                  code: InteractiveCodeBlock,
                  a: ({ ...props }) => (
                    <a
                      className="inline-flex items-center gap-1 underline underline-offset-2 decoration-dashed hover:decoration-solid transition-all"
                      style={{ color: 'var(--color-primary)' }}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {props.children} <ExternalLink size={12} />
                    </a>
                  ),
                  h1: ({ ...props }) => (
                    <h1
                      className="text-lg font-semibold mb-3 mt-4"
                      style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '12px' }}
                      {...props}
                    />
                  ),
                  h2: ({ ...props }) => (
                    <h2
                      className="text-base font-semibold mb-2 mt-4"
                      style={{ color: 'var(--color-primary)' }}
                      {...props}
                    />
                  ),
                  h3: ({ ...props }) => <h3 className="text-sm font-semibold mb-2 mt-3" {...props} />,
                  ul: ({ ...props }) => <ul className="list-disc pl-6 mb-3 space-y-1" {...props} />,
                  ol: ({ ...props }) => <ol className="list-decimal pl-6 mb-3 space-y-1" {...props} />,
                  li: ({ ...props }) => <li className="text-sm" {...props} />,
                  blockquote: ({ ...props }) => (
                    <blockquote
                      className="pl-4 my-3 text-sm"
                      style={{ borderLeft: '3px solid var(--color-primary)', color: 'var(--color-text-secondary)', background: 'var(--color-surface-soft)', padding: '12px 16px', borderRadius: '0 8px 8px 0' }}
                      {...props}
                    />
                  ),
                  table: ({ ...props }) => (
                    <div className="overflow-x-auto my-4 rounded-xl" style={{ border: '1px solid var(--color-background-soft)' }}>
                      <table className="min-w-full text-left text-sm" {...props} />
                    </div>
                  ),
                  th: ({ ...props }) => (
                    <th className="px-4 py-2.5 font-medium text-xs" style={{ background: 'var(--color-surface-soft)', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-background-soft)' }} {...props} />
                  ),
                  td: ({ ...props }) => (
                    <td className="px-4 py-2.5 text-sm" style={{ borderBottom: '1px solid var(--color-background-soft)', color: 'var(--color-text-primary)' }} {...props} />
                  ),
                  hr: () => <hr className="my-5 border-[var(--color-background-soft)]" />,
                  strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
                  em: ({ ...props }) => <em className="italic" style={{ color: 'var(--color-accent)' }} {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 py-2">
              {[1,2,3].map(n => (
                <motion.div
                  key={n}
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: n * 0.15 }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {!isUser && !isError && !isLoading && content && (
          <div className="absolute right-2 -bottom-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center rounded-xl warm-card soft-shadow overflow-hidden">
              <button
                onClick={() => handleFeedback("positive")}
                disabled={feedbackCooldown}
                className="p-2 transition-colors hover:bg-[var(--color-surface-soft)] disabled:opacity-40"
                style={{ color: feedback === "positive" ? 'var(--color-success)' : 'var(--color-text-muted)' }}
              >
                <ThumbsUp size={14} fill={feedback === "positive" ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => handleFeedback("negative")}
                disabled={feedbackCooldown}
                className="p-2 transition-colors hover:bg-[var(--color-surface-soft)] disabled:opacity-40"
                style={{ color: feedback === "negative" ? 'var(--color-error)' : 'var(--color-text-muted)' }}
              >
                <ThumbsDown size={14} fill={feedback === "negative" ? "currentColor" : "none"} />
              </button>
              <button
                className="px-3 py-2 text-xs font-medium hover:bg-[var(--color-surface-soft)] transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onClick={() => onRefine?.(id, content)}
              >
                Refine
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
