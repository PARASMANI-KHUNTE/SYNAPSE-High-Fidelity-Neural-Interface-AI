import { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, Mic, X, Loader2, Volume2, VolumeX, Square, FileText, Zap, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

export default function InputBar({ onSend, onStop, onStopAudio, isTyping, isSpeaking, disabled }) {
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Quick status toggle
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem('auto_speak') === 'true');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('auto_speak', autoSpeak);
    // If user turns off voice while AI is speaking, stop the audio immediately
    if (!autoSpeak && isSpeaking) {
      onStopAudio();
    }
  }, [autoSpeak, isSpeaking, onStopAudio]);

  const handleSend = async () => {
    if (!input.trim() && !file) return;
    if (disabled || isUploading) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }

    setIsUploading(true);
    let fileUrl = null;
    let fileType = null;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.url) {
          fileUrl = data.url;
          fileType = file.type.startsWith('audio') ? 'audio' : 'image';
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    setIsUploading(false);
    
    // Read current settings from localStorage
    const voicePref = localStorage.getItem('voice_gender') || 'male';
    onSend(input, fileUrl, fileType, voicePref);
    
    setInput('');
    setFile(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
          setFile(audioFile);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Error accessing microphone:', err);
      }
    }
  };

  return (
    <div className={clsx(
      "relative mx-auto w-full max-w-3xl flex flex-col items-center bg-[#1e293b] rounded-2xl shadow-xl border transition-all duration-500 z-10",
      isSpeaking 
        ? "border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-2 ring-cyan-500/20" 
        : "border-slate-700/80 shadow-black/20 focus-within:ring-2 focus-within:ring-blue-500/50"
    )}>
      
      {/* Subtle Voice Waveform (Overlay) */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none opacity-30">
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[pulse_1.5s_infinite]"></div>
        </div>
      )}

      {/* Live Recording Animation */}
      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-red-500/10 backdrop-blur-md px-4 py-2 rounded-full border border-red-500/20 shadow-lg shadow-red-500/10 z-20">
          <span className="w-1.5 h-3 bg-red-400 rounded-full animate-[bounce_1s_infinite_0ms]"></span>
          <span className="w-1.5 h-4 bg-red-400 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
          <span className="w-1.5 h-5 bg-red-400 rounded-full animate-[bounce_1s_infinite_400ms]"></span>
          <span className="w-1.5 h-4 bg-red-400 rounded-full animate-[bounce_1s_infinite_600ms]"></span>
          <span className="w-1.5 h-3 bg-red-400 rounded-full animate-[bounce_1s_infinite_800ms]"></span>
          <span className="ml-2 text-red-400 text-xs font-semibold tracking-wide uppercase">Listening Live</span>
        </div>
      )}


      {/* File Preview */}
      {file && (
        <div className="w-full flex items-center gap-3 p-3 border-b border-slate-700/50 bg-slate-800/50 rounded-t-2xl z-20">
          {file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="preview" className="h-12 w-12 object-cover rounded-lg border border-slate-600" />
          ) : (
            <div className="h-12 w-12 flex items-center justify-center bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
              <FileText size={24} />
            </div>
          )}
          <div className="flex-1 truncate text-sm text-slate-300 font-medium">{file.name}</div>
          <button onClick={() => setFile(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="w-full flex items-center p-2 pl-4 z-10">
        <input 
          type="file" 
          accept="image/*,application/pdf" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isRecording || isUploading}
          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition-all mr-1 shrink-0"
          title="Upload Image or PDF"
        >
          <ImagePlus size={22} />
        </button>

        <div className="relative group mr-1">
          <button 
            type="button"
            className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-800 rounded-xl transition-all shrink-0"
            title="AI Tools"
          >
            <Zap size={22} />
          </button>
          
          <div className="absolute bottom-full mb-2 left-0 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-2xl min-w-[200px] overflow-hidden z-50">
            <button 
              onClick={() => setInput("Generate an image of: ")}
              className="flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 text-slate-200 transition-colors border-b border-slate-700/50"
            >
              <ImagePlus size={16} className="text-yellow-400" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Generate Image</span>
                <span className="text-xs text-slate-400">Using Stable Diffusion</span>
              </div>
            </button>
            <button 
              onClick={() => setInput("Create a PDF report about: ")}
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
          className={`p-2 rounded-xl transition-all mr-2 shrink-0 ${isRecording ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20' : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'}`}
          title="Live Dictation"
        >
          <Mic size={22} />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "AI is typing..." : isRecording ? "Speak now (transcribing live)..." : "Message OS Assistant..."}
          className="flex-1 max-h-48 min-h-[44px] bg-transparent text-slate-100 placeholder-slate-500 font-sans text-sm resize-none outline-none py-3"
          rows={1}
          disabled={disabled}
        />

        <div className="flex items-center gap-2 border-l border-slate-700/50 pl-2 ml-2 h-10">
          {/* Global Voice Toggle */}
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`p-2 rounded-xl transition-all duration-300 ${autoSpeak ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'bg-slate-800/40 text-slate-500 border border-transparent'}`}
            title={autoSpeak ? "Voice Enabled (Personality in Sidebar)" : "Voice Disabled"}
          >
            {autoSpeak ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Immediate Silence (Only visible when speaking) */}
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
              onClick={() => { onStop?.(); onStopAudio?.(); }}
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
    </div>
  );
}
