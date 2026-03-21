import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ImagePlus, Mic, X, Loader2, Volume2, VolumeX, Square, FileText, Zap } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_RECORDING_DURATION = 60000;

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/webm",
  "audio/mp3",
  "audio/mpeg"
];

const validateFile = (file) => {
  if (!file) return { valid: false, error: "No file selected" };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return { valid: false, error: `File type ${file.type} not supported` };
  return { valid: true };
};

export default function InputBar({ 
  onSendMessage, 
  onStopMessage, 
  onStopAudio, 
  isTyping, 
  isSpeaking, 
  disabled, 
  suggestion, 
  onSuggest, 
  clearSuggestion,
  modelPreference,
  onModelPreferenceChange,
  availableModels,
  onOpenSandbox
}) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem("auto_speak") === "true");
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const suggestTimeoutRef = useRef(null);
  const streamRef = useRef(null);
  const toolsMenuRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("auto_speak", String(autoSpeak));
    if (!autoSpeak && isSpeaking) {
      onStopAudio?.();
    }
  }, [autoSpeak, isSpeaking, onStopAudio]);

  useEffect(() => {
    if (input.length > 5 && onSuggest) {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
      suggestTimeoutRef.current = setTimeout(() => {
        onSuggest(input);
      }, 1000);
    } else {
      if (suggestion) {
        clearSuggestion?.();
      }
    }
    
    return () => {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    };
  }, [input, onSuggest, clearSuggestion]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!toolsMenuRef.current?.contains(event.target)) {
        setIsToolsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const uploadFile = useCallback(async (fileToUpload) => {
    setIsUploading(true);
    setUploadError(null);
    
    const validation = validateFile(fileToUpload);
    if (!validation.valid) {
      setUploadError(validation.error);
      setIsUploading(false);
      return { url: null, type: null };
    }

    const formData = new FormData();
    formData.append("file", fileToUpload);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(errorData.error || `Upload failed with status ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data.url) {
        throw new Error("No URL returned from server");
      }
      
      const fileType = fileToUpload.type.startsWith("audio") ? "audio" : 
                       fileToUpload.type.startsWith("image") ? "image" : "file";
      
      return { url: data.url, type: fileType };
      
    } catch (err) {
      console.error("Upload failed:", err.message);
      setUploadError(err.name === "AbortError" ? "Upload timed out" : err.message);
      return { url: null, type: null };
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && !file) || disabled || isUploading || isRecording) return;

    if (isRecording) {
      stopRecording();
    }

    let fileUrl = null;
    let fileType = null;
    let voicePref = localStorage.getItem("voice_gender") || "male";

    if (file) {
      const result = await uploadFile(file);
      if (result.url) {
        fileUrl = result.url;
        fileType = result.type;
      } else if (uploadError) {
        return;
      }
    }
    
    onSendMessage(input, fileUrl, fileType, voicePref, modelPreference);
    
    setInput("");
    setFile(null);
    setUploadError(null);
    clearSuggestion?.();
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, file, disabled, isUploading, isRecording, uploadError, uploadFile, onSendMessage, clearSuggestion, stopRecording, modelPreference]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validation = validateFile(selectedFile);
      if (!validation.valid) {
        setUploadError(validation.error);
        return;
      }
      setFile(selectedFile);
      setUploadError(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setUploadError(null);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm"
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const audioFile = new File([blob], `recording_${Date.now()}.webm`, { type: "audio/webm" });
        setFile(audioFile);
      };

      mediaRecorder.onerror = (err) => {
        console.error("MediaRecorder error:", err);
        stopRecording();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= MAX_RECORDING_DURATION - 1000) {
            stopRecording();
            return prev;
          }
          return prev + 1000;
        });
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err.message);
      if (err.name === "NotAllowedError") {
        setUploadError("Microphone access denied. Please allow microphone access.");
      } else if (err.name === "NotFoundError") {
        setUploadError("No microphone found. Please connect a microphone.");
      } else {
        setUploadError(`Microphone error: ${err.message}`);
      }
    }
  }, [isRecording, stopRecording]);

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const applySuggestion = useCallback(() => {
    const newInput = (input + " " + (suggestion || "")).trim();
    setInput(newInput);
    clearSuggestion?.();
    textareaRef.current?.focus();
  }, [input, suggestion, clearSuggestion]);

  return (
    <div className={clsx(
      "relative mx-auto w-full max-w-3xl flex flex-col items-center bg-[#1e293b] rounded-2xl shadow-xl border transition-all duration-500 z-10",
      isSpeaking 
        ? "border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-2 ring-cyan-500/20" 
        : "border-slate-700/80 shadow-black/20 focus-within:ring-2 focus-within:ring-blue-500/50"
    )}>
      
      {isSpeaking && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none flex items-end justify-center pb-1 gap-[2px]">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                height: [2, 6 + Math.random() * 12, 4, 8 + Math.random() * 10, 2],
                opacity: [0.2, 0.6, 0.2]
              }}
              transition={{ 
                duration: 0.6 + (i % 3) * 0.15, 
                repeat: Infinity, 
                ease: "easeInOut",
                delay: i * 0.03
              }}
              className="w-[2px] bg-cyan-400/40 rounded-full"
            />
          ))}
        </div>
      )}

      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-red-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-red-500/30 shadow-lg shadow-red-500/10 z-20">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-red-400 text-xs font-semibold tracking-wide uppercase">
            Recording {formatDuration(recordingDuration)}
          </span>
          <button
            onClick={stopRecording}
            className="p-1 hover:bg-red-500/20 rounded-full transition-colors"
            title="Stop recording"
          >
            <Square size={14} className="text-red-400" fill="currentColor" />
          </button>
        </div>
      )}

      {uploadError && (
        <div className="w-full flex items-center gap-2 p-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs rounded-t-2xl z-20">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded">
            <X size={12} />
          </button>
        </div>
      )}

      {file && (
        <div className="w-full flex items-center gap-3 p-3 border-b border-slate-700/50 bg-slate-800/50 rounded-t-2xl z-20">
          {file.type.startsWith("image/") ? (
            <img src={URL.createObjectURL(file)} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-slate-600" />
          ) : file.type.startsWith("audio/") ? (
            <div className="h-12 w-12 flex items-center justify-center bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400">
              <Mic size={24} />
            </div>
          ) : (
            <div className="h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
              <FileText size={24} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm text-slate-300 font-medium">{file.name}</div>
            <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
          <button onClick={handleRemoveFile} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="w-full flex items-center p-2 pl-4 z-10">
        <input 
          type="file" 
          accept="image/*,application/pdf,audio/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isRecording || isUploading}
          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition-all mr-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Upload Image, PDF, or Audio"
        >
          <ImagePlus size={22} />
        </button>

        <div ref={toolsMenuRef} className="relative mr-1">
          <button 
            type="button"
            onClick={() => setIsToolsOpen((prev) => !prev)}
            className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-800 rounded-xl transition-all shrink-0"
            title="AI Tools"
          >
            <Zap size={22} />
          </button>
          
          <div className={clsx(
            "absolute bottom-full mb-2 left-0 flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-2xl min-w-[200px] overflow-hidden z-50",
            isToolsOpen ? "flex" : "hidden"
          )}>
            <button 
              onClick={() => {
                setIsToolsOpen(false);
                onOpenSandbox?.();
              }}
              className="flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 text-slate-200 transition-colors border-b border-slate-700/50"
            >
              <Square size={16} className="text-cyan-400" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Open Sandbox</span>
                <span className="text-xs text-slate-400">Run JS or Python</span>
              </div>
            </button>
            <button 
              onClick={() => {
                setInput("Generate an image of: ");
                setIsToolsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 text-slate-200 transition-colors border-b border-slate-700/50"
            >
              <ImagePlus size={16} className="text-yellow-400" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Generate Image</span>
                <span className="text-xs text-slate-400">Using Stable Diffusion</span>
              </div>
            </button>
            <button 
              onClick={() => {
                setInput("Create a PDF report about: ");
                setIsToolsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <FileText size={16} className="text-blue-400" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Create PDF</span>
                <span className="text-xs text-slate-400">Generate professional doc</span>
              </div>
            </button>
          </div>
        </div>

        <button 
          onClick={toggleRecording}
          disabled={disabled || isUploading}
          className={clsx(
            "p-2 rounded-xl transition-all mr-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed",
            isRecording 
              ? "text-red-400 bg-red-400/10 hover:bg-red-400/20 animate-pulse" 
              : "text-slate-400 hover:text-red-400 hover:bg-slate-800"
          )}
          title={isRecording ? "Stop Recording" : "Start Live Dictation"}
        >
          <Mic size={22} />
        </button>

        <div className="relative flex-1 flex flex-col">
          {suggestion && !disabled && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-10 left-0 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide cursor-pointer hover:bg-cyan-500/30 transition-all flex items-center gap-2 group/suggest shadow-xl shadow-cyan-500/10 z-50 backdrop-blur-md"
              onClick={applySuggestion}
            >
              <Zap size={10} className="text-cyan-400 animate-pulse" />
              <span>{suggestion}</span>
              <span className="text-[8px] opacity-40 ml-1 group-hover/suggest:opacity-100 transition-opacity uppercase tracking-widest font-black">Neural Complete</span>
            </motion.div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "SYNAPSE is processing..." : isRecording ? "Neural Transcription active..." : "Initialize query for SYNAPSE..."}
            className="w-full max-h-48 min-h-[44px] bg-transparent text-slate-100 placeholder-slate-500 font-sans text-sm resize-none outline-none py-3 disabled:opacity-50"
            rows={1}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-2 border-l border-slate-700/50 pl-2 ml-2 h-10">
          <select
            value={modelPreference}
            onChange={(e) => onModelPreferenceChange?.(e.target.value)}
            className="max-w-[110px] bg-slate-800/60 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-2 outline-none hover:border-cyan-500/40 focus:border-cyan-500/60"
            title="Select model mode"
          >
            <option value="auto">Auto</option>
            <option value="chat">Chat</option>
            <option value="code">Code</option>
            <option value="reasoning">Reason</option>
            <option value="casual">Fast</option>
          </select>

          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={clsx(
              "p-2 rounded-xl transition-all duration-300",
              autoSpeak 
                ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                : "bg-slate-800/40 text-slate-500 border border-transparent"
            )}
            title={autoSpeak ? "Voice Enabled" : "Voice Disabled"}
          >
            {autoSpeak ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {isSpeaking && (
            <button
              onClick={onStopAudio}
              className="group relative p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-all animate-pulse"
              title="Silence AI"
            >
              <VolumeX size={18} />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-xl shadow-red-500/20 whitespace-nowrap z-50">MUTE AI</span>
            </button>
          )}

          {(isTyping || isSpeaking) ? (
            <button
              onClick={() => { onStopMessage?.(); onStopAudio?.(); }}
              className="p-2.5 ml-1 shrink-0 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center animate-pulse"
              title="Stop AI"
            >
              <Square fill="currentColor" size={18} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !file) || disabled || isUploading}
              className="p-2.5 ml-1 shrink-0 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center"
              title="Send Message"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          )}
        </div>
      </div>
      <div className="w-full px-4 pb-3 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-[0.18em]">
        <span>Mode: {modelPreference}</span>
        <span className="truncate max-w-[60%] text-right">
          {modelPreference === "chat" && availableModels?.chat ? availableModels.chat : null}
          {modelPreference === "code" && availableModels?.code ? availableModels.code : null}
          {modelPreference === "reasoning" && availableModels?.reasoning ? availableModels.reasoning : null}
          {modelPreference === "casual" && availableModels?.casual ? availableModels.casual : null}
          {modelPreference === "auto" ? "router-selected" : null}
        </span>
      </div>
    </div>
  );
}
