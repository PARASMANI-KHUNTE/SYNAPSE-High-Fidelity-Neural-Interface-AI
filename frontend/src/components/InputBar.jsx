import { useState, useRef, useEffect, useCallback, createElement } from "react";
import { Send, ImagePlus, Mic, X, Loader2, Volume2, VolumeX, Square, FileText, Zap, TerminalSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SPEAKING_BAR_HEIGHTS = [6, 14, 9, 16, 8, 12, 7, 15, 10, 13, 5, 11, 8, 14, 9, 6, 12, 7, 10, 15, 6, 13, 8, 11];

const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "audio/webm", "audio/mp3", "audio/mpeg"
];

const validateFile = (file) => {
  if (!file) return { valid: false, error: "No file selected" };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return { valid: false, error: `File type not supported` };
  return { valid: true };
};

function ToolBtn({ onClick, disabled, icon: _Icon, label, active, color, pulse }) {
  const Icon = _Icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={clsx(
        "tooltip relative w-9 h-9 flex items-center justify-center transition-all duration-200 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
        pulse && "animate-pulse"
      )}
      data-tip={label}
      style={{
        background: active ? `rgba(${color || '0,240,255'}, 0.15)` : 'transparent',
        border: active ? `1px solid rgba(${color || '0,240,255'}, 0.3)` : '1px solid var(--color-tactical-blue)',
        color: active ? `rgb(${color || '0,240,255'})` : '#6b5f8a',
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.color = `rgb(${color || '0,240,255'})`; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#6b5f8a'; }}
    >
      <Icon size={16} />
    </button>
  );
}

export default function InputBar({
  onSendMessage, onStopMessage, onStopAudio, isTyping, isSpeaking,
  disabled, suggestion, onSuggest, clearSuggestion,
  modelPreference, onModelPreferenceChange, onOpenSandbox
}) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem("auto_speak") === "true");
  const [focused, setFocused] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const suggestTimeoutRef = useRef(null);
  const toolsMenuRef = useRef(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("auto_speak", String(autoSpeak));
    if (!autoSpeak && isSpeaking) onStopAudio?.();
  }, [autoSpeak, isSpeaking, onStopAudio]);

  useEffect(() => {
    if (input.length > 5 && onSuggest) {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
      suggestTimeoutRef.current = setTimeout(() => onSuggest(input), 1000);
    } else {
      clearSuggestion?.();
    }
    return () => { if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current); };
  }, [input, onSuggest, clearSuggestion]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const handleOut = (e) => { if (!toolsMenuRef.current?.contains(e.target)) setIsToolsOpen(false); };
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = URL.createObjectURL(file);
    }
    return () => {
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, [file]);

  const uploadFile = useCallback(async (fileToUpload) => {
    setIsUploading(true);
    setUploadError(null);
    const validation = validateFile(fileToUpload);
    if (!validation.valid) { setUploadError(validation.error); setIsUploading(false); throw new Error(validation.error); }
    const formData = new FormData();
    formData.append("file", fileToUpload);
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(`${API_URL}/api/upload`, { method: "POST", body: formData, signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Upload failed`); }
      const data = await res.json();
      if (!data.url) throw new Error("No URL returned");
      const fileType = fileToUpload.type.startsWith("audio") ? "audio" : fileToUpload.type.startsWith("image") ? "image" : "file";
      return { url: data.url, type: fileType };
    } catch (err) {
      const msg = err.name === "AbortError" ? "Upload timed out" : err.message;
      setUploadError(msg);
      throw new Error(msg);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && !file) || disabled || isUploading) return;
    if (isRecording && recognitionRef.current) { recognitionRef.current.stop(); setIsRecording(false); }
    let fileUrl = null, fileType = null;
    const voice = localStorage.getItem("voice_gender") || "male";
    if (file) {
      try {
        const result = await uploadFile(file);
        fileUrl = result.url;
        fileType = result.type;
      } catch {
        return;
      }
    }
    onSendMessage(input, fileUrl, fileType, voice, modelPreference);
    setInput(""); setFile(null); setUploadError(null); clearSuggestion?.();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, file, disabled, isUploading, isRecording, uploadFile, onSendMessage, clearSuggestion, modelPreference]);

  const applySuggestion = useCallback(() => {
    setInput(prev => (prev + " " + (suggestion || "")).trim() + " ");
    clearSuggestion?.();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [suggestion, clearSuggestion]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    else if (e.key === "Tab" && suggestion && !disabled) { e.preventDefault(); applySuggestion(); }
  }, [handleSend, suggestion, disabled, applySuggestion]);

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) {
      const v = validateFile(f);
      if (!v.valid) { setUploadError(v.error); return; }
      setFile(f); setUploadError(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (recognitionRef.current && recognitionRef.current.state !== "inactive") {
      recognitionRef.current.stop();
    }
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm"
      });
      recognitionRef.current = mr;
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setFile(new File([blob], `rec_${Date.now()}.webm`, { type: "audio/webm" }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.onerror = () => stopRecording();
      mr.start(100);
      setIsRecording(true);
      
      recordingTimerRef.current = setInterval(() => {
        // Enforce 60 sec limits
      }, 1000);
    } catch (err) {
      setUploadError(
        err.name === "NotAllowedError" ? "SYS_FAULT: Microphone access denied." :
        "MIC_FAULT: " + err.message
      );
    }
  }, [isRecording, stopRecording]);

  return (
    <div className="relative mx-auto w-full max-w-3xl flex flex-col font-mono">
      {/* Suggestion chip */}
      <AnimatePresence>
        {suggestion && !disabled && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={applySuggestion}
            className="absolute -top-10 left-4 flex items-center gap-2 px-3 py-1.5 z-30 hud-panel border-[var(--color-neon-orange)] group bg-[rgba(10,17,32,0.95)]"
          >
            <Zap size={10} className="text-[var(--color-neon-orange)] animate-pulse" />
            <span className="truncate max-w-[200px] text-[10px] text-[var(--color-neon-orange)] group-hover:text-white transition-colors">{" >> "} {suggestion}</span>
            <span className="opacity-50 text-[9px] text-[var(--color-neon-orange)] tracking-wider">`[TAB]`</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Error notice */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-3 py-2 mb-2 text-[10px] uppercase tracking-widest hud-panel border-[var(--color-neon-red)] bg-black"
          >
            <Zap size={12} className="text-[var(--color-neon-red)] animate-flicker" />
            <span className="flex-1 text-[var(--color-neon-red)]">ERR: {uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-[var(--color-neon-red)] hover:text-white">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File preview chip */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 px-2 py-2 mb-2 self-start hud-panel border-[var(--color-cyan)] bg-[rgba(5,7,15,0.9)] min-w-[200px]"
          >
            {file.type.startsWith("image/") ? (
              <img src={blobUrlRef.current || URL.createObjectURL(file)} alt="preview" className="w-8 h-8 object-cover border border-[var(--color-tactical-blue)]" />
            ) : file.type.startsWith("audio/") ? (
              <div className="w-8 h-8 flex items-center justify-center border border-[var(--color-tactical-blue)] text-[var(--color-cyan)] bg-[rgba(0,240,255,0.05)]"><Mic size={14} /></div>
            ) : (
              <div className="w-8 h-8 flex items-center justify-center border border-[var(--color-tactical-blue)] text-[var(--color-cyan)] bg-[rgba(0,240,255,0.05)]"><FileText size={14} /></div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="truncate text-[9px] text-white uppercase font-bold">{file.name}</div>
              <div className="text-[8px] text-[var(--color-cyan)] tracking-widest mt-0.5">SIZE: {(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => { setFile(null); setUploadError(null); }} className="text-slate-500 hover:text-[var(--color-neon-red)] pr-1">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main input container ── */}
      <div
        className={`relative flex flex-col transition-all duration-300 hud-panel bg-[rgba(10,17,32,0.9)] w-full block ${ 
          focused ? 'border-[var(--color-cyan)] shadow-[0_0_20px_rgba(0,240,255,0.15)]' : isSpeaking ? 'border-[var(--color-neon-red)]' : 'border-[var(--color-tactical-blue)]'
        }`}
      >
        {isSpeaking && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-end justify-center pb-0.5 gap-1 opacity-40">
            {SPEAKING_BAR_HEIGHTS.map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: `${height}px` }}
                animate={{ height: [`${height - 4}px`, `${height + 2}px`, `${height - 4}px`] }}
                transition={{ duration: 0.6 + (i % 4) * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.03 }}
                className="w-[2px] bg-[var(--color-neon-red)]"
              />
            ))}
          </div>
        )}

        {/* Toolbar row */}
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
          <input
            type="file"
            accept="image/*,application/pdf,audio/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
          <ToolBtn
            icon={ImagePlus}
            label="Upload Data"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            color="0,240,255"
          />

          <div ref={toolsMenuRef} className="relative z-[60]">
            <ToolBtn
              icon={Zap}
              label="Sys Tools"
              onClick={() => setIsToolsOpen(p => !p)}
              active={isToolsOpen}
              color="255,144,0"
            />
            <AnimatePresence>
              {isToolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="absolute bottom-full mb-2 left-0 flex flex-col min-w-[210px] hud-panel bg-[rgba(5,7,15,0.95)] z-[90]"
                >
                  {[
                    { icon: TerminalSquare, label: "EXECUTE_SANDBOX", color: '#00f0ff', action: () => { setIsToolsOpen(false); onOpenSandbox?.(); } },
                    { icon: ImagePlus, label: "GEN_IMAGERY", color: '#ff9000', action: () => { setInput("Generate an image of: "); setIsToolsOpen(false); } },
                    { icon: FileText, label: "COMPILE_DOC", color: '#1e3a8a', action: () => { setInput("Create a PDF report about: "); setIsToolsOpen(false); } },
                   ].map(({ icon: _Icon, label, color, action }) => (
                     <button
                       key={label}
                       onClick={action}
                       className="flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[var(--color-tactical-blue)] hover:bg-[rgba(0,240,255,0.05)]"
                     >
                       <div className="w-5 h-5 flex items-center justify-center border border-dashed" style={{ borderColor: color, color }}>
                         {createElement(_Icon, { size: 12 })}
                       </div>
                       <div className="text-[9px] font-bold uppercase tracking-widest text-white">{label}</div>
                     </button>
                   ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ToolBtn
            icon={Mic}
            label={isRecording ? "Halt Mic" : "Open Mic"}
            onClick={toggleRecording}
            disabled={disabled || isUploading}
            active={isRecording}
            color="255,42,42"
            pulse={isRecording}
          />
          {isRecording && (
            <span className="text-[9px] text-[var(--color-neon-red)] ml-2 animate-pulse tracking-widest font-bold">
              [ REC_SYNC ]
            </span>
          )}
        </div>

        {/* Textarea */}
        <div className="px-4 pb-2 relative mt-1 w-full bg-transparent">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              disabled ? "AWAITING_RESPONSE..." :
              isRecording ? "RECORDING_AUDIO >>_" :
              "AWAITING_INPUT >>_"
            }
            className="w-full bg-transparent text-[11px] resize-none outline-none py-2 leading-relaxed text-[#f1e9ff] break-words"
            style={{
              maxHeight: '180px',
              minHeight: '44px',
              caretColor: 'var(--color-cyan)',
            }}
            rows={1}
            disabled={disabled}
          />
          <style>{`textarea::placeholder { color: #475569; letter-spacing: 0.1em; }`}</style>
        </div>

        {/* Bottom action row */}
        <div className="flex items-center justify-between px-3 pb-3 gap-2 border-t border-[var(--color-tactical-blue)] pt-3 w-full">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {Object.entries({ auto: "SYS_AUTO", chat: "CL_CHAT", code: "CX_CODE", reasoning: "R_REASON", casual: "FAST" }).map(([val, label]) => (
              <button
                key={val}
                onClick={() => onModelPreferenceChange?.(val)}
                className={`px-2 py-1 text-[8px] font-bold uppercase tracking-widest whitespace-nowrap transition-all duration-200 shrink-0 border ${
                  modelPreference === val 
                    ? 'border-[var(--color-cyan)] text-[var(--color-cyan)] bg-[rgba(0,240,255,0.1)] shadow-[0_0_8px_rgba(0,240,255,0.2)]' 
                    : 'border-[var(--color-tactical-blue)] text-slate-500 hover:border-[var(--color-cyan)]'
                }`}
              >
                [{label}]
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ToolBtn
              icon={autoSpeak ? Volume2 : VolumeX}
              label={autoSpeak ? "v_sync on" : "v_sync off"}
              onClick={() => setAutoSpeak(!autoSpeak)}
              active={autoSpeak}
              color="0,240,255"
            />

            {(isTyping || isSpeaking) ? (
              <button
                onClick={() => { onStopMessage?.(); onStopAudio?.(); }}
                className="w-8 h-8 flex items-center justify-center border border-[var(--color-neon-red)] bg-[rgba(255,42,42,0.15)] text-[var(--color-neon-red)] hover:bg-[var(--color-neon-red)] hover:text-white transition-all duration-200 active:scale-95 animate-pulse shrink-0"
                title="Halt Process"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !file) || disabled || isUploading}
                className="w-8 h-8 flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border shrink-0"
                style={{
                  background: (input.trim() || file) && !disabled && !isUploading
                    ? 'rgba(0,240,255,0.15)'
                    : 'rgba(30,58,138,0.1)',
                  borderColor: (input.trim() || file) && !disabled && !isUploading
                    ? 'var(--color-cyan)'
                    : 'var(--color-tactical-blue)',
                  color: (input.trim() || file) && !disabled && !isUploading ? 'var(--color-cyan)' : '#64748b',
                  boxShadow: (input.trim() || file) ? '0 0 10px rgba(0,240,255,0.2)' : 'none',
                }}
                title="Transmit"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
