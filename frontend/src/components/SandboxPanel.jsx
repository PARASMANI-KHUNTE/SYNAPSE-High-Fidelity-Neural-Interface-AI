import { useState } from "react";
import { Play, TerminalSquare, Loader2, X, RotateCcw, Shield } from "lucide-react";
 
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const ACCESS_TOKEN_KEY = "synapse_access_token";

const STARTER_SNIPPET = `const values = [3, 7, 11, 19];
const sum = values.reduce((acc, v) => acc + v, 0);

console.log("Values:", values.join(", "));
console.log("Sum:", sum);
console.log("Average:", (sum / values.length).toFixed(2));`;

export default function SandboxPanel({ isOpen, onClose }) {
  const [code, setCode] = useState(STARTER_SNIPPET);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true); setOutput(""); setError("");
    try {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
      const res = await fetch(`${API_URL}/api/sandbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ code, language: "javascript" })
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
    setCode(STARTER_SNIPPET);
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
          style={{ background: 'rgba(31, 45, 61, 0.75)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="w-full max-w-5xl flex flex-col overflow-hidden rounded-2xl"
            style={{
              height: '80vh',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-background-soft)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
            }}
          >
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{
                borderBottom: '1px solid var(--color-background-soft)',
                background: 'var(--color-surface-soft)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--color-primary)15', border: '1px solid var(--color-primary)30', color: 'var(--color-primary)' }}
              >
                <TerminalSquare size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Code Sandbox</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Shield size={10} style={{ color: 'var(--color-success)' }} />
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    Docker-isolated JavaScript runner
                  </p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all warm-card-hover"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Reset"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: 'var(--color-error)10', color: 'var(--color-text-muted)' }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0">
              <div
                className="flex flex-col min-h-0"
                style={{ borderRight: '1px solid var(--color-background-soft)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid var(--color-background-soft)', background: 'var(--color-surface-soft)' }}
                >
                  <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-muted)' }}>EDITOR</span>
                  <button
                    onClick={handleRun}
                    disabled={isRunning || !code.trim()}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: 'var(--color-primary)',
                      color: 'white',
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
                  placeholder="Write your JavaScript code here..."
                  className="flex-1 min-h-0 w-full p-5 outline-none resize-none text-sm leading-relaxed font-mono"
                  style={{
                    background: 'var(--color-background)',
                    color: 'var(--color-text-primary)',
                    caretColor: 'var(--color-primary)',
                  }}
                />
              </div>

              <div className="flex flex-col min-h-0">
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid var(--color-background-soft)', background: 'var(--color-surface-soft)' }}
                >
                  <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--color-text-muted)' }}>OUTPUT</span>
                  {error && (
                    <span className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>ERROR</span>
                  )}
                </div>

                <div
                  className="flex-1 min-h-0 overflow-auto p-5 font-mono text-sm whitespace-pre-wrap leading-relaxed"
                  style={{
                    background: 'var(--color-background)',
                    color: output ? 'var(--color-success)' : 'var(--color-text-muted)',
                  }}
                >
                  {output || "Run code to see output here..."}
                </div>

                {error && (
                  <div
                    className="font-mono text-sm whitespace-pre-wrap p-4 leading-relaxed"
                    style={{
                      borderTop: '1px solid var(--color-error)30',
                      background: 'var(--color-error)10',
                      color: 'var(--color-error)',
                      maxHeight: '140px',
                      overflowY: 'auto',
                    }}
                  >
                    <span className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-error)' }}>ERROR</span>
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
