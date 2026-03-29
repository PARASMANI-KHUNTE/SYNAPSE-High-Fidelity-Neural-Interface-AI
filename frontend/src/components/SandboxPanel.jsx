import { useMemo, useState } from "react";
import { Play, TerminalSquare, Loader2, X, RotateCcw } from "lucide-react";
 
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const STARTER_SNIPPETS = {
  javascript: `const values = [3, 7, 11, 19];
const sum = values.reduce((acc, v) => acc + v, 0);

console.log("Values:", values.join(", "));
console.log("Sum:", sum);
console.log("Average:", (sum / values.length).toFixed(2));`,
  python: `values = [3, 7, 11, 19]
total = sum(values)

print("Values:", ", ".join(str(v) for v in values))
print("Sum:", total)
print("Average:", round(total / len(values), 2))`
};

export default function SandboxPanel({ isOpen, onClose }) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(STARTER_SNIPPETS.javascript);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const placeholder = useMemo(() => STARTER_SNIPPETS[language], [language]);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setCode((c) => c.trim() ? c : STARTER_SNIPPETS[lang]);
    setOutput(""); setError("");
  };

  const handleRun = async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true); setOutput(""); setError("");
    try {
      const res = await fetch(`${API_URL}/api/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Sandbox failed ${res.status}`);
      if (data.timedOut) { setError(data.error || "Execution timed out"); }
      else if (data.error) { setError(data.error); }
      setOutput(data.output || "(No output)");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCode(STARTER_SNIPPETS[language]);
    setOutput(""); setError("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(9,6,18,0.75)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="w-full max-w-5xl flex flex-col overflow-hidden"
            style={{
              height: '80vh',
              background: 'rgba(13,10,26,0.96)',
              border: '1px solid rgba(168,85,247,0.18)',
              borderRadius: '24px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.05)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{
                borderBottom: '1px solid rgba(168,85,247,0.08)',
                background: 'rgba(22,17,46,0.6)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}
              >
                <TerminalSquare size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#f1e9ff' }}>Code Sandbox</p>
                <p className="text-[10px]" style={{ color: '#6b5f8a' }}>Isolated backend runner — JavaScript & Python</p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {/* Language tabs */}
                <div
                  className="flex rounded-xl p-0.5 gap-0.5"
                  style={{ background: 'rgba(22,17,46,0.8)', border: '1px solid rgba(168,85,247,0.1)' }}
                >
                  {["javascript", "python"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                      style={{
                        background: language === lang ? 'rgba(168,85,247,0.2)' : 'transparent',
                        border: language === lang ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                        color: language === lang ? '#c4a3ff' : '#6b5f8a',
                      }}
                    >
                      {lang === "javascript" ? "JavaScript" : "Python"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleReset}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', color: '#6b5f8a' }}
                  title="Reset"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', color: '#6b5f8a' }}
                  title="Close"
                  onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6b5f8a'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0">
              {/* Editor pane */}
              <div
                className="flex flex-col min-h-0"
                style={{ borderRight: '1px solid rgba(168,85,247,0.08)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid rgba(168,85,247,0.06)', background: 'rgba(22,17,46,0.3)' }}
                >
                  <span className="font-label text-[9px] tracking-widest" style={{ color: '#6b5f8a' }}>EDITOR</span>
                  <button
                    onClick={handleRun}
                    disabled={isRunning || !code.trim()}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, rgba(45,212,191,0.6), rgba(45,212,191,0.8))',
                      border: '1px solid rgba(45,212,191,0.3)',
                      color: '#0d0a1a',
                      boxShadow: isRunning ? 'none' : '0 0 16px rgba(45,212,191,0.3)',
                    }}
                  >
                    {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                    {isRunning ? "Running..." : "Run Code"}
                  </button>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  placeholder={placeholder}
                  className="flex-1 min-h-0 w-full p-5 outline-none resize-none text-sm leading-relaxed font-mono"
                  style={{
                    background: 'rgba(9,6,18,0.8)',
                    color: '#e2d9f3',
                    caretColor: '#a855f7',
                  }}
                />
              </div>

              {/* Output pane */}
              <div className="flex flex-col min-h-0">
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid rgba(168,85,247,0.06)', background: 'rgba(22,17,46,0.3)' }}
                >
                  <span className="font-label text-[9px] tracking-widest" style={{ color: '#6b5f8a' }}>OUTPUT</span>
                  {error && (
                    <span className="font-label text-[9px] tracking-widest" style={{ color: '#f43f5e' }}>ERROR</span>
                  )}
                </div>

                <div
                  className="flex-1 min-h-0 overflow-auto p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed"
                  style={{
                    background: 'rgba(9,6,18,0.9)',
                    color: output ? '#86efac' : '#3d3360',
                  }}
                >
                  {output || "Run code to see output here..."}
                </div>

                {error && (
                  <div
                    className="font-mono text-xs whitespace-pre-wrap p-4 leading-relaxed"
                    style={{
                      borderTop: '1px solid rgba(244,63,94,0.2)',
                      background: 'rgba(244,63,94,0.06)',
                      color: '#fda4af',
                      maxHeight: '140px',
                      overflowY: 'auto',
                    }}
                  >
                    <span className="font-label text-[9px] block mb-1.5 tracking-widest" style={{ color: '#f43f5e' }}>ERROR</span>
                    {error}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
