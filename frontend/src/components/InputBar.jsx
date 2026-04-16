import { useState, useRef, useEffect, useCallback, createElement } from "react";
import { Send, ImagePlus, Mic, X, Loader2, Volume2, VolumeX, Square, FileText, Sparkles, TerminalSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCESS_TOKEN_KEY = "synapse_access_token";

const SPEAKING_BAR_HEIGHTS = [6, 14, 9, 16, 8, 12, 7, 15, 10, 13, 5, 11, 8, 14, 9, 6, 12, 7, 10, 15, 6, 13, 8, 11];

const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "audio/webm", "audio/mp3", "audio/mpeg", "audio/wav", "audio/ogg"
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
        "relative w-9 h-9 flex items-center justify-center transition-all duration-200 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl",
        pulse && "animate-pulse"
      )}
      data-tip={label}
      style={{
        background: active ? `${color || 'var(--color-primary)'}15` : 'transparent',
        color: active ? (color || 'var(--color-primary)') : 'var(--color-text-muted)',
      }}
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
  const [autoSpeak, setAutoSpeak] = useState(() => {
    const saved = localStorage.getItem("auto_speak");
    return saved === null ? true : saved === "true";
  });
  const [focused, setFocused] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const recordingSeedInputRef = useRef("");
  const recordingTimerRef = useRef(null);
  const suggestTimeoutRef = useRef(null);
  const toolsMenuRef = useRef(null);
  const blobUrlRef = useRef(null);
  const [liveTranscript, setLiveTranscript] = useState("");

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
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
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
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 30000);
      const url = `${API_URL}/api/upload`;
      const res = await fetch(url, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: formData,
        signal: ctrl.signal
      });
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
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    recognitionRef.current = null;
    setLiveTranscript("");
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (recognitionRef.current && recognitionRef.current.state !== "inactive") {
        recognitionRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
      }
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      setLiveTranscript("");
      setIsRecording(false);
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm"
      });
      recordingSeedInputRef.current = input.trim() ? `${input.trim()} ` : "";
      setLiveTranscript("");

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const live = new SpeechRecognition();
          live.continuous = true;
          live.interimResults = true;
          live.lang = localStorage.getItem("speech_lang") || "en-US";
          live.onresult = (event) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              transcript += event.results[i][0]?.transcript || "";
            }
            const normalized = transcript.replace(/\s+/g, " ").trim();
            setLiveTranscript(normalized);
            const prefix = recordingSeedInputRef.current;
            setInput(`${prefix}${normalized}`.trimStart());
          };
          live.onerror = () => {};
          speechRecognitionRef.current = live;
          live.start();
        } catch {
          speechRecognitionRef.current = null;
        }
      }

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
      }, 1000);
    } catch (err) {
      setUploadError(
        err.name === "NotAllowedError" ? "Microphone access denied" :
        "Microphone error: " + err.message
      );
    }
  }, [isRecording, stopRecording, input]);

  return (
    <div className="relative mx-auto w-full max-w-3xl flex flex-col">
      <AnimatePresence>
        {suggestion && !disabled && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={applySuggestion}
            className="absolute -top-10 left-4 flex items-center gap-2 px-3 py-2 z-30 rounded-xl warm-card soft-shadow group"
          >
            <Sparkles size={12} style={{ color: 'var(--color-primary)' }} />
            <span className="truncate max-w-[200px] text-sm group-hover:text-[var(--color-primary)] transition-colors">
              {suggestion}
            </span>
            <span className="text-xs opacity-60">Tab</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-3 py-2 mb-2 text-sm rounded-xl warm-card"
            style={{ border: '1px solid var(--color-error)' }}
          >
            <Sparkles size={14} style={{ color: 'var(--color-error)' }} />
            <span className="flex-1" style={{ color: 'var(--color-error)' }}>Error: {uploadError}</span>
            <button onClick={() => setUploadError(null)} className="p-1 rounded-lg hover:bg-[var(--color-background-soft)]" style={{ color: 'var(--color-error)' }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 px-3 py-2 mb-2 self-start rounded-xl warm-card"
            style={{ minWidth: '200px' }}
          >
            {file.type.startsWith("image/") ? (
              <img src={blobUrlRef.current || URL.createObjectURL(file)} alt="preview" className="w-8 h-8 object-cover rounded-lg" />
            ) : file.type.startsWith("audio/") ? (
              <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'var(--color-surface-soft)' }}>
                <Mic size={14} style={{ color: 'var(--color-primary)' }} />
              </div>
            ) : (
              <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'var(--color-surface-soft)' }}>
                <FileText size={14} style={{ color: 'var(--color-primary)' }} />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="truncate text-xs font-medium">{file.name}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
            <button onClick={() => { setFile(null); setUploadError(null); }} className="p-1 rounded-lg hover:bg-[var(--color-background-soft)]" style={{ color: 'var(--color-text-muted)' }}>
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={clsx(
          "relative flex flex-col transition-all duration-300 warm-card w-full",
          focused ? 'soft-shadow-lg' : 'soft-shadow'
        )}
      >
        {isSpeaking && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-end justify-center pb-0.5 gap-1 opacity-30 rounded-2xl">
            {SPEAKING_BAR_HEIGHTS.map((height, i) => (
              <motion.div
                key={i}
                initial={{ height: `${height}px` }}
                animate={{ height: [`${height - 4}px`, `${height + 2}px`, `${height - 4}px`] }}
                transition={{ duration: 0.6 + (i % 4) * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.03 }}
                className="w-[2px] rounded-full"
                style={{ background: 'var(--color-primary)' }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
          <input
            type="file"
            accept="image/*,application/pdf,audio/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
          <ToolBtn
            icon={ImagePlus}
            label="Upload file"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            color="var(--color-primary)"
          />

          <div ref={toolsMenuRef} className="relative z-[60]">
            <ToolBtn
              icon={Sparkles}
              label="Tools"
              onClick={() => setIsToolsOpen(p => !p)}
              active={isToolsOpen}
              color="var(--color-primary)"
            />
            <AnimatePresence>
              {isToolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 left-0 flex flex-col min-w-[200px] rounded-xl warm-card soft-shadow-lg overflow-hidden"
                >
                  {[
                    { icon: TerminalSquare, label: "Code Sandbox", color: 'var(--color-primary)', action: () => { setIsToolsOpen(false); onOpenSandbox?.(); } },
                    { icon: FileText, label: "Create PDF", color: 'var(--color-text-secondary)', action: () => { setInput("Create a PDF report about: "); setIsToolsOpen(false); } },
                   ].map(({ icon: _Icon, label, color, action }) => (
                     <button
                       key={label}
                       onClick={action}
                       className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-soft)]"
                     >
                       <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: `${color}15`, color }}>
                         {createElement(_Icon, { size: 14 })}
                       </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</div>
                     </button>
                   ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ToolBtn
            icon={Mic}
            label={isRecording ? "Stop recording" : "Record audio"}
            onClick={toggleRecording}
            disabled={disabled || isUploading}
            active={isRecording}
            color="var(--color-primary)"
            pulse={isRecording}
          />
          {isRecording && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs animate-pulse" style={{ color: 'var(--color-primary)' }}>
                Recording...
              </span>
              {liveTranscript && (
                <span className="text-[11px] truncate max-w-[240px]" style={{ color: 'var(--color-text-secondary)' }}>
                  Live: {liveTranscript}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-4 pb-2 relative mt-1 w-full bg-transparent">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              disabled ? "Waiting for response..." :
              isRecording ? "Recording audio..." :
              "Type a message..."
            }
            className="w-full bg-transparent text-sm resize-none outline-none py-2 leading-relaxed"
            style={{
              maxHeight: '180px',
              minHeight: '44px',
              color: 'var(--color-text-primary)',
              caretColor: 'var(--color-primary)',
            }}
            rows={1}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between px-4 pb-3 gap-2" style={{ borderTop: '1px solid var(--color-background-soft)', paddingTop: '12px' }}>
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            {Object.entries({ auto: "Auto", chat: "Chat", code: "Code", reasoning: "Reason", casual: "Fast" }).map(([val, label]) => (
              <button
                key={val}
                onClick={() => onModelPreferenceChange?.(val)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200 shrink-0",
                  modelPreference === val 
                    ? 'warm-card' 
                    : 'hover:bg-[var(--color-surface-soft)]'
                )}
                style={modelPreference === val ? { 
                  border: '1px solid var(--color-primary)',
                  background: 'var(--color-primary)10',
                  color: 'var(--color-primary)'
                } : {
                  color: 'var(--color-text-secondary)'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ToolBtn
              icon={autoSpeak ? Volume2 : VolumeX}
              label={autoSpeak ? "Auto speak on" : "Auto speak off"}
              onClick={() => setAutoSpeak(!autoSpeak)}
              active={autoSpeak}
              color="var(--color-primary)"
            />

            {(isTyping || isSpeaking) ? (
              <button
                onClick={() => { onStopMessage?.(); onStopAudio?.(); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95"
                style={{ 
                  background: 'var(--color-error)15', 
                  color: 'var(--color-error)',
                  border: '1px solid var(--color-error)'
                }}
                title="Stop"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !file) || disabled || isUploading}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: (input.trim() || file) && !disabled && !isUploading
                    ? 'var(--color-primary)'
                    : 'var(--color-background-soft)',
                  color: (input.trim() || file) && !disabled && !isUploading ? 'white' : 'var(--color-text-muted)',
                }}
                title="Send message"
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
