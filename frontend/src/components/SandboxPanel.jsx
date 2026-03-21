import { useMemo, useState } from "react";
import { Play, SquareTerminal, Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const STARTER_SNIPPETS = {
  javascript: `const values = [3, 7, 11, 19];
const sum = values.reduce((acc, value) => acc + value, 0);

console.log("Values:", values.join(", "));
console.log("Sum:", sum);
console.log("Average:", sum / values.length);`,
  python: `values = [3, 7, 11, 19]
total = sum(values)

print("Values:", ", ".join(str(value) for value in values))
print("Sum:", total)
print("Average:", total / len(values))`
};

export default function SandboxPanel({ isOpen, onClose }) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(STARTER_SNIPPETS.javascript);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const placeholder = useMemo(() => STARTER_SNIPPETS[language], [language]);

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    setCode((current) => current.trim() ? current : STARTER_SNIPPETS[nextLanguage]);
    setOutput("");
    setError("");
  };

  const handleRun = async () => {
    if (!code.trim() || isRunning) return;

    setIsRunning(true);
    setOutput("");
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Sandbox failed with ${res.status}`);
      }

      if (data.timedOut) {
        setError(data.error || "Execution timed out");
      } else if (data.error) {
        setError(data.error);
      }

      setOutput(data.output || "(No stdout)");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setCode(STARTER_SNIPPETS[language]);
    setOutput("");
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-6xl h-[80vh] bg-[#07111f] border border-cyan-500/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-cyan-500/10 flex items-center gap-3 bg-slate-900/70">
          <SquareTerminal size={18} className="text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-[0.18em] uppercase text-cyan-300">Sandbox</span>
            <span className="text-xs text-slate-500">Run JavaScript or Python in an isolated backend runner</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
            </select>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-lg text-xs uppercase tracking-[0.18em] border border-slate-700 text-slate-300 hover:border-slate-500"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-xs uppercase tracking-[0.18em] border border-slate-700 text-slate-300 hover:border-slate-500"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0">
          <div className="border-r border-cyan-500/10 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
              <span className="text-[11px] tracking-[0.18em] uppercase text-slate-500">Editor</span>
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white text-xs uppercase tracking-[0.18em]"
              >
                {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder={placeholder}
              className="flex-1 min-h-0 w-full bg-[#04101d] text-slate-100 p-5 font-mono text-sm outline-none resize-none"
            />
          </div>

          <div className="flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
              <span className="text-[11px] tracking-[0.18em] uppercase text-slate-500">Output</span>
              {error ? <span className="text-[11px] uppercase tracking-[0.18em] text-red-400">Error</span> : null}
            </div>
            <div className="flex-1 min-h-0 bg-black/30 overflow-auto p-5 font-mono text-sm whitespace-pre-wrap text-emerald-300">
              {output || "Run code to see stdout here."}
            </div>
            {error ? (
              <div className="border-t border-red-500/20 bg-red-500/10 p-4 font-mono text-xs whitespace-pre-wrap text-red-300">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
