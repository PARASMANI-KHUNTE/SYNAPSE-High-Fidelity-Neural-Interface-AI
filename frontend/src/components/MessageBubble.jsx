import { motion } from 'framer-motion';
import { User, Bot, AlertCircle, Copy, Check, Play, ExternalLink, Cpu, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';
import { useState } from 'react';
import VoiceVisualizer from './VoiceVisualizer';

const InteractiveCodeBlock = ({ inline, className, children }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : null;
  const codeText = String(children).replace(/\n$/, '');

  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setOutput("Executing script...");
    try {
      const res = await fetch("http://localhost:3000/api/sandbox", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeText, language })
      });
      const data = await res.json();
      if (data.error) setOutput(data.output ? `${data.output}\n\n[Error]: ${data.error}` : `Error: ${data.error}`);
      else setOutput(data.output || "(Code executed cleanly without stdout)");
    } catch(err) {
      setOutput(`Fatal Network Sandbox Error: ${err.message}`);
    }
    setIsRunning(false);
  };

  const isRunnable = language === 'javascript' || language === 'js' || language === 'python' || language === 'py';

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
              <button onClick={handleRun} disabled={isRunning} className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-400/10 px-2.5 py-1.5 rounded transition-all tracking-widest uppercase border border-emerald-500/20">
                <Play size={10} fill="currentColor" className={isRunning ? "animate-pulse" : ""} /> {isRunning ? 'Processing' : 'Execute'}
              </button>
            )}
            <button onClick={handleCopy} className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 hover:bg-blue-400/10 px-2.5 py-1.5 rounded transition-all tracking-widest uppercase border border-blue-500/20">
              {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? 'Cached' : 'Clone'}
            </button>
          </div>
        </div>
        
        <SyntaxHighlighter language={language} style={vscDarkPlus} customStyle={{ margin: 0, padding: '20px', fontSize: '13px', background: 'transparent' }}>
          {codeText}
        </SyntaxHighlighter>
        
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

export default function MessageBubble({ id, role, content, isError, imageUrls, isSpeaking, operatorName, initialFeedback, onFeedback }) {
  const isUser = role === 'user';
  const [feedback, setFeedback] = useState(initialFeedback);

  const handleFeedback = (type) => {
    if (feedback === type) return;
    setFeedback(type);
    onFeedback(id, type);
  };

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
      {/* Avatar with Glow and Voice Visualizer */}
      <div className="relative shrink-0 flex items-center justify-center w-12 h-12">
        <div className={clsx(
          "relative z-10 w-full h-full rounded-full flex items-center justify-center border transition-all duration-500",
          isUser 
            ? "bg-blue-600 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
            : isError 
              ? "bg-red-500/20 border-red-500/50 text-red-400" 
              : "bg-slate-900 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        )}>
          {isUser ? <User size={24} /> : isError ? <AlertCircle size={24} /> : <Bot size={24} className={clsx("text-cyan-400", isSpeaking ? "animate-pulse" : "animate-float")} />}
        </div>
        
        {/* 🚀 SCI-FI NEURAL ORBIT */}
        {!isUser && !isError && <VoiceVisualizer isActive={isSpeaking} />}
        
        {!isUser && !isError && !isSpeaking && (
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
        )}
      </div>

      {/* Bubble with Seamless Aesthetic */}
      <div className={clsx(
        "relative px-2 py-1 text-sm/relaxed max-w-[calc(100%-4rem)] font-sans transition-all",
        isUser 
          ? "bg-blue-600/20 border border-blue-500/30 text-blue-50 rounded-2xl px-6 py-4 rounded-tr-sm shadow-xl backdrop-blur-md" 
          : isError
            ? "bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl px-6 py-4 rounded-tl-sm"
            : "text-slate-100"
      )}>
        
        {/* Assistant Glow Underlay */}
        {!isUser && !isError && (
          <div className="absolute -inset-4 bg-blue-500/5 rounded-[40px] blur-2xl -z-10"></div>
        )}

        {/* Identity identifier badge */}
        <div className={clsx(
          "absolute -top-8 text-[9px] font-black tracking-[0.2em] uppercase opacity-50",
          isUser ? "right-0" : "left-0"
        )}>
          {isUser ? `Identity: ${operatorName || 'Operator'}` : "Identity: SYNAPSE (Neural)"}
        </div>

        {imageUrls && imageUrls.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-4">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative group/img overflow-hidden rounded-xl border border-white/10 shadow-lg">
                <img 
                  src={url} 
                  alt="media" 
                  className="max-w-[280px] max-h-[280px] object-cover transition-transform duration-700 group-hover/img:scale-110" 
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
                p: ({node, ...props}) => <p className="mb-4 last:mb-0 leading-relaxed font-normal" {...props} />,
                code: InteractiveCodeBlock,
                a: ({node, ...props}) => (
                  <a 
                    className="text-cyan-400 font-bold underline underline-offset-4 hover:text-cyan-300 inline-flex items-center gap-1 transition-all pointer-events-auto cursor-pointer relative z-10" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    {...props}
                  >
                    {props.children} <ExternalLink size={12} />
                  </a>
                ),
                h1: ({node, ...props}) => <h1 className="text-lg font-bold text-white mb-4 mt-6 first:mt-0 font-sci-fi tracking-widest border-l-2 border-cyan-500 pl-3" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-base font-bold text-white mb-3 mt-5 font-sci-fi tracking-wider border-l-2 border-blue-500/50 pl-3" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 marker:text-cyan-500" {...props} />,
                li: ({node, ...props}) => <li className="text-slate-300" {...props} />
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          !isError && (
            <div className="flex items-center gap-3 py-3 px-1">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]"></div>
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-cyan-500/60 animate-pulse">Syncing...</span>
            </div>
          )
        )}
        {/* Assistant Feedback & Actions Footer */}
        {!isUser && !isError && content && (
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-lg p-1 border border-white/5">
              <button 
                onClick={() => handleFeedback('positive')}
                className={clsx(
                  "p-1.5 rounded transition-all hover:bg-emerald-500/20",
                  feedback === 'positive' ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 hover:text-emerald-400"
                )}
                title="Accurate & Relevant"
              >
                <ThumbsUp size={14} fill={feedback === 'positive' ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={() => handleFeedback('negative')}
                className={clsx(
                  "p-1.5 rounded transition-all hover:bg-red-500/20",
                  feedback === 'negative' ? "text-red-400 bg-red-500/10" : "text-slate-500 hover:text-red-400"
                )}
                title="Inaccurate or Irrelevant"
              >
                <ThumbsDown size={14} fill={feedback === 'negative' ? "currentColor" : "none"} />
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
