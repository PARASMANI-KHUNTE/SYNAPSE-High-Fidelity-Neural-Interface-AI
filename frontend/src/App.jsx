import { useState, useEffect, useRef, useCallback, Component } from "react";
import { io } from "socket.io-client";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SandboxPanel from "./components/SandboxPanel";
  
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, Loader2, Sparkles, Eye, EyeOff } from "lucide-react";
import "./App.css";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const ACCESS_TOKEN_KEY = "synapse_access_token";
const REFRESH_TOKEN_KEY = "synapse_refresh_token";
const STREAM_CHUNK_FLUSH_MS = 40;

/* ── Error Boundary ─────────────────────────── */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-center justify-center h-screen"
          style={{ background: 'var(--color-background)', color: 'var(--color-text-primary)' }}
        >
          <div className="text-center p-8 max-w-sm warm-card soft-shadow-lg">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'var(--color-error)15',
                border: '1px solid var(--color-error)30',
              }}
            >
              <WifiOff size={28} style={{ color: 'var(--color-error)' }} />
            </div>
            <h1 className="text-xl font-display font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Something went wrong</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Please refresh the page to continue</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Connection Toast ───────────────────────── */
function ConnectionToast({ isConnected, connectionError }) {
  const show = !isConnected || connectionError;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.95 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium warm-card soft-shadow"
          style={connectionError ? {
            border: '1px solid var(--color-error)30',
            color: 'var(--color-error)',
          } : !isConnected ? {
            border: '1px solid var(--color-primary)30',
            color: 'var(--color-primary)',
          } : {
            border: '1px solid var(--color-success)30',
            color: 'var(--color-success)',
          }}
        >
          {connectionError ? (
            <>
              <WifiOff size={14} style={{ color: 'var(--color-error)' }} />
              <span>Connection lost</span>
            </>
          ) : !isConnected ? (
            <>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wifi size={14} style={{ color: 'var(--color-success)' }} />
              <span>Connected</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Main App ───────────────────────────────── */
function App() {
  const [activeLayoutPreset, setActiveLayoutPreset] = useState(
    () => localStorage.getItem("synapse_layout_preset") || "mission"
  );
  const [panelPrefs, setPanelPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("synapse_panel_prefs") || "{}");
      return {
        memory: saved.memory !== false,
        statusRing: saved.statusRing !== false
      };
    } catch {
      return {
        memory: true,
        statusRing: true
      };
    }
  });
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [operatorName, setOperatorName] = useState("Operator");
  const [modelPreference, setModelPreference] = useState(
    () => localStorage.getItem("chat_model_preference") || "auto"
  );
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(
    () => localStorage.getItem("active_chat_id") || null
  );
  const [suggestion, setSuggestion] = useState("");
  const [isWaitingReply, setIsWaitingReply] = useState(false);
  const [agentTools, setAgentTools] = useState([]);
  const [agentEvents, setAgentEvents] = useState([]);
  const [pendingAgentConfirmation, setPendingAgentConfirmation] = useState(null);
  const [memoryFacts, setMemoryFacts] = useState([]);
  const [memoryProfile, setMemoryProfile] = useState(null);
  const [memoryEpisodes, setMemoryEpisodes] = useState([]);

  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY) || "");
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem(REFRESH_TOKEN_KEY) || "");
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const isGenerationActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const playNextFnRef = useRef(null);
  const scheduleReconnectFnRef = useRef(null);
  const setupListenersFnRef = useRef(null);
  const userIdRef = useRef("");
  const accessTokenRef = useRef(accessToken);
  const activeChatIdRef = useRef(activeChatId);
  const assistantMessageIdRef = useRef(null);
  const pendingAssistantChunkRef = useRef("");
  const chunkFlushTimerRef = useRef(null);

  useEffect(() => { userIdRef.current = authUser?.id || ""; }, [authUser]);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { localStorage.setItem("chat_model_preference", modelPreference); }, [modelPreference]);
  useEffect(() => { localStorage.setItem("synapse_panel_prefs", JSON.stringify(panelPrefs)); }, [panelPrefs]);
  useEffect(() => { localStorage.setItem("synapse_layout_preset", activeLayoutPreset); }, [activeLayoutPreset]);

  const normalizeMediaUrl = useCallback((value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `http:${raw}`;
    if (raw.startsWith("/")) return `${SOCKET_URL}${raw}`;
    const clean = raw.replace(/^\.?\//, "");
    return `${SOCKET_URL}/${clean}`;
  }, []);

  const pushAgentEvent = useCallback((type, payload) => {
    setAgentEvents((prev) => {
      const next = [
        {
          id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type,
          payload
        },
        ...prev
      ];
      return next.slice(0, 20);
    });
  }, []);

  const authHeaders = useCallback(() => (
    accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}
  ), []);

  const fetchMemoryProfile = useCallback(() => {
    fetch(`${SOCKET_URL}/api/memory/profile`, { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load memory");
        }
        return response.json();
      })
      .then((data) => {
        setMemoryProfile(data.profile || null);
        setMemoryFacts(data.facts || []);
        setMemoryEpisodes(data.episodes || []);
      })
      .catch(() => {});
  }, [authHeaders]);

  const clearAudioQueue = useCallback(() => {
    audioQueueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const flushAssistantChunks = useCallback(() => {
    const buffered = pendingAssistantChunkRef.current;
    if (!buffered) {
      chunkFlushTimerRef.current = null;
      return;
    }

    pendingAssistantChunkRef.current = "";
    chunkFlushTimerRef.current = null;
    const activeAssistantId = assistantMessageIdRef.current;

    setMessages((prev) => {
      if (!prev.length) return prev;
      const arr = [...prev];
      let targetIndex = -1;

      if (activeAssistantId) {
        targetIndex = arr.findIndex((item) => item.id === activeAssistantId);
      }
      if (targetIndex < 0) {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].role === "assistant") {
            targetIndex = i;
            break;
          }
        }
      }
      if (targetIndex < 0) return prev;

      const target = arr[targetIndex];
      arr[targetIndex] = { ...target, content: `${target.content || ""}${buffered}` };
      return arr;
    });
  }, []);

  const playNext = useCallback(() => {
    if (!mountedRef.current) return;
    if (audioQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    const audio = audioQueueRef.current.shift();
    audioRef.current = audio;
    const proceed = () => {
      if (mountedRef.current && playNextFnRef.current) {
        setTimeout(() => playNextFnRef.current(), 20);
      }
    };
    audio.onended = proceed;
    audio.onerror = proceed;
    audio.playbackRate = 1.0;
    const p = audio.play();
    if (p !== undefined) p.catch(proceed);
  }, []);

  playNextFnRef.current = playNext;

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionError("Maximum reconnection attempts reached. Please refresh.");
      return;
    }
    reconnectAttemptsRef.current += 1;
    const delay = RECONNECT_DELAY * reconnectAttemptsRef.current;
    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && !socketRef.current?.connected) {
        const token = accessTokenRef.current ? `Bearer ${accessTokenRef.current}` : "";
        const newSocket = io(SOCKET_URL, {
          reconnection: false,
          timeout: 10000,
          auth: { token }
        });
        socketRef.current = newSocket;
        if (setupListenersFnRef.current) setupListenersFnRef.current(newSocket);
      }
    }, delay);
  }, []);

  scheduleReconnectFnRef.current = scheduleReconnect;

  const setSessionTokens = useCallback((nextAccess, nextRefresh) => {
    setAccessToken(nextAccess || "");
    setRefreshToken(nextRefresh || "");
    if (nextAccess) localStorage.setItem(ACCESS_TOKEN_KEY, nextAccess);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
    if (nextRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, nextRefresh);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  }, []);

  const loadCurrentUser = useCallback((token) => {
    if (!token) return Promise.resolve();
    return fetch(`${SOCKET_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Unauthorized"))))
      .then((data) => setAuthUser(data.user || null))
      .catch(() => {
        setAuthUser(null);
      });
  }, []);

  const tryRefreshSession = useCallback(async () => {
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${SOCKET_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) return false;
      const data = await res.json();
      setSessionTokens(data.accessToken, data.refreshToken);
      await loadCurrentUser(data.accessToken);
      return true;
    } catch {
      return false;
    }
  }, [refreshToken, setSessionTokens, loadCurrentUser]);

  const clearAuthSession = useCallback(() => {
    setSessionTokens("", "");
    setAuthUser(null);
    setMessages([]);
    setChatSessions([]);
    setActiveChatId(null);
    localStorage.removeItem("active_chat_id");
  }, [setSessionTokens]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (accessToken) {
        await loadCurrentUser(accessToken);
        return;
      }
      const refreshed = await tryRefreshSession();
      if (!refreshed && !cancelled) {
        setAuthUser(null);
      }
    };
    void boot();
    return () => { cancelled = true; };
  }, [accessToken, tryRefreshSession, loadCurrentUser]);

  useEffect(() => {
    if (!accessToken) return undefined;
    mountedRef.current = true;

    const setupListeners = (socketInstance) => {
      socketInstance.on("connect", () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        socketInstance.emit("chat:list");
        socketInstance.emit("agent:tools:list");
        fetchMemoryProfile();
        if (activeChatIdRef.current) {
          socketInstance.emit("chat:history", { chatId: activeChatIdRef.current });
        }
      });

      socketInstance.on("disconnect", (reason) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        if (reason !== "io client disconnect" && scheduleReconnectFnRef.current) {
          scheduleReconnectFnRef.current();
        }
      });

      socketInstance.on("error", (err) => console.error("Socket error:", err));

      socketInstance.on("connect_error", (err) => {
        if (!mountedRef.current) return;
        setConnectionError(err.message || "Connection failed");
        if (String(err?.message || "").toLowerCase().includes("unauthorized")) {
          clearAuthSession();
          return;
        }
        if (scheduleReconnectFnRef.current) scheduleReconnectFnRef.current();
      });

      socketInstance.on("ping:timeout", () => socketInstance.disconnect());

      socketInstance.on("chat:list:reply", (data) => {
        if (!mountedRef.current) return;
        if (data?.chats) setChatSessions(data.chats);
      });

      socketInstance.on("chat:created", (data) => {
        if (!mountedRef.current) return;
        if (data?.chatId && data?.title) {
          setActiveChatId(data.chatId);
          localStorage.setItem("active_chat_id", data.chatId);
          setChatSessions((prev) => [{ _id: data.chatId, title: data.title }, ...prev]);
        }
      });

      socketInstance.on("chat:history:reply", (data) => {
        if (!mountedRef.current) return;
        if (data?.messages) {
          setMessages(data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            imageUrls: Array.isArray(m.imageUrls) ? m.imageUrls.map((url) => normalizeMediaUrl(url)).filter(Boolean) : [],
            audioUrl: normalizeMediaUrl(m.audioUrl),
            feedback: m.feedback,
            isError: m.isError,
            _id: m._id,
          })));
        }
      });

      socketInstance.on("chat:deleted", () => {
        if (!mountedRef.current) return;
        socketInstance.emit("chat:list");
      });

      socketInstance.on("chat:suggestion", (data) => {
        if (!mountedRef.current) return;
        if (data?.suggestion) setSuggestion(data.suggestion);
      });

      socketInstance.on("agent:tools:list:reply", (data) => {
        if (!mountedRef.current) return;
        if (Array.isArray(data?.tools)) {
          setAgentTools(data.tools);
        }
      });

      socketInstance.on("agent:thinking", (data) => {
        if (!mountedRef.current) return;
        pushAgentEvent("thinking", data);
      });

      socketInstance.on("agent:tool:start", (data) => {
        if (!mountedRef.current) return;
        pushAgentEvent("start", data);
      });

      socketInstance.on("agent:tool:result", (data) => {
        if (!mountedRef.current) return;
        setPendingAgentConfirmation(null);
        pushAgentEvent("done", data);
      });

      socketInstance.on("chat:reply:start", () => {
        if (!mountedRef.current) return;
        setIsWaitingReply(false);
        setIsTyping(true);
        isGenerationActiveRef.current = true;
        pendingAssistantChunkRef.current = "";
        const assistantId = `temp_${Date.now()}`;
        assistantMessageIdRef.current = assistantId;
        setMessages((prev) => [...prev, { role: "assistant", content: "", id: assistantId }]);
        audioQueueRef.current = [];
      });

      socketInstance.on("chat:reply:chunk", (data) => {
        if (!mountedRef.current || !isGenerationActiveRef.current) return;
        if (!data?.chunk) return;
        pendingAssistantChunkRef.current += data.chunk;
        if (!chunkFlushTimerRef.current) {
          chunkFlushTimerRef.current = setTimeout(flushAssistantChunks, STREAM_CHUNK_FLUSH_MS);
        }
      });

      socketInstance.on("chat:reply:images", (data) => {
        if (!mountedRef.current) return;
        if (data?.images) {
          const normalized = data.images.map((img) => normalizeMediaUrl(img)).filter(Boolean);
          setMessages((prev) => {
            const arr = [...prev];
            for (let i = arr.length - 1; i >= 0; i--) {
              if (arr[i].role === "assistant") {
                const existing = arr[i].imageUrls || [];
                const fresh = normalized.filter((img) => !existing.includes(img));
                if (fresh.length > 0) arr[i] = { ...arr[i], imageUrls: [...existing, ...fresh] };
                break;
              }
            }
            return arr;
          });
        }
      });

      socketInstance.on("chat:reply:file", (data) => {
        if (!mountedRef.current || !data?.url) return;
        const fileUrl = normalizeMediaUrl(data.url);
        setMessages((prev) => {
          const arr = [...prev];
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i].role === "assistant") {
              const link = `\n\nDownload ${data.type || "file"}: ${fileUrl}`;
              if (!arr[i].content?.includes(fileUrl))
                arr[i] = { ...arr[i], content: `${arr[i].content || ""}${link}` };
              break;
            }
          }
          return arr;
        });
      });

      socketInstance.on("chat:reply:end", () => {
        if (!mountedRef.current) return;
        flushAssistantChunks();
        isGenerationActiveRef.current = false;
        assistantMessageIdRef.current = null;
        setIsTyping(false);
        fetchMemoryProfile();
      });

      socketInstance.on("chat:stopped", () => {
        if (!mountedRef.current) return;
        setIsWaitingReply(false);
        flushAssistantChunks();
        pendingAssistantChunkRef.current = "";
        isGenerationActiveRef.current = false;
        assistantMessageIdRef.current = null;
        setIsTyping(false);
        clearAudioQueue();
      });

      socketInstance.on("chat:error", (data) => {
        if (!mountedRef.current) return;
        setIsWaitingReply(false);
        flushAssistantChunks();
        pendingAssistantChunkRef.current = "";
        isGenerationActiveRef.current = false;
        assistantMessageIdRef.current = null;
        setIsTyping(false);
        if (data?.message)
          setMessages((prev) => [...prev, { role: "assistant", content: data.message, isError: true, id: `err_${Date.now()}` }]);
      });

      socketInstance.on("audio:ready", (data) => {
        if (!mountedRef.current) return;
        const savedAutoSpeak = localStorage.getItem("auto_speak");
        const autoSpeakEnabled = savedAutoSpeak === null ? true : savedAutoSpeak === "true";
        if (autoSpeakEnabled && data?.url) {
          try {
            const audioUrl = normalizeMediaUrl(data.url);
            const audio = new Audio(audioUrl);
            audio.preload = "auto";
            audio.crossOrigin = "anonymous";
            audioQueueRef.current.push(audio);
            if (!isSpeakingRef.current && playNextFnRef.current) playNextFnRef.current();
          } catch (err) {
            console.error("Audio error:", err);
          }
        }
      });
    };

    setupListenersFnRef.current = setupListeners;

    fetch(`${SOCKET_URL}/api/config`)
      .then((r) => { if (!r.ok) throw new Error("Config failed"); return r.json(); })
      .then((d) => {
        if (d?.operatorName) setOperatorName(d.operatorName);
      })
      .catch(() => {});

    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: 10000,
      timeout: 15000,
      auth: { token: `Bearer ${accessToken}` }
    });

    socketRef.current = newSocket;
    setupListeners(newSocket);

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (chunkFlushTimerRef.current) clearTimeout(chunkFlushTimerRef.current);
      chunkFlushTimerRef.current = null;
      pendingAssistantChunkRef.current = "";
      if (newSocket) { newSocket.removeAllListeners(); newSocket.disconnect(); }
      clearAudioQueue();
    };
  }, [accessToken, clearAudioQueue, scheduleReconnect, clearAuthSession, pushAgentEvent, fetchMemoryProfile, flushAssistantChunks, normalizeMediaUrl]);

  const handleStopAudio = useCallback(() => clearAudioQueue(), [clearAudioQueue]);

  const handleSendMessage = useCallback((content, fileUrl, fileType, voice, selectedModel) => {
    if (!socketRef.current?.connected) return;
    isGenerationActiveRef.current = false;
    setIsWaitingReply(true);
    socketRef.current.emit("chat:message", {
      chatId: activeChatId,
      message: content || "",
      fileUrl: fileType === "image" ? null : fileUrl,
      fileType: fileType || null,
      images: fileType === "image" ? (fileUrl ? [fileUrl] : []) : [],
      voice,
      modelPreference: selectedModel || modelPreference,
    });
    setMessages((prev) => [
      ...prev,
      { role: "user", content, imageUrls: fileType === "image" ? (fileUrl ? [normalizeMediaUrl(fileUrl)] : []) : [] },
    ]);
  }, [activeChatId, modelPreference, normalizeMediaUrl]);

  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    localStorage.setItem("active_chat_id", chatId);
    setMessages([]);
    setSuggestion("");
    if (socketRef.current?.connected)
      socketRef.current.emit("chat:history", { chatId });
  }, []);

  const handleDeleteChat = useCallback((chatId) => {
    if (socketRef.current?.connected)
      socketRef.current.emit("chat:delete", { chatId });
    if (activeChatId === chatId) {
      setActiveChatId(null);
      localStorage.removeItem("active_chat_id");
      setMessages([]);
    }
  }, [activeChatId]);

  const handleStopMessage = useCallback(() => {
    if (socketRef.current?.connected) socketRef.current.emit("chat:stop");
    isGenerationActiveRef.current = false;
    setIsTyping(false);
    handleStopAudio();
  }, [handleStopAudio]);

  const handleFeedback = useCallback((messageId, type) => {
    if (socketRef.current?.connected && activeChatId)
      socketRef.current.emit("chat:feedback", { chatId: activeChatId, messageId, feedback: type });
  }, [activeChatId]);

  const handleSuggest = useCallback((input) => {
    if (socketRef.current?.connected && input?.length > 5)
      socketRef.current.emit("chat:suggest", { input: input.substring(0, 500) });
  }, []);

  const handleClearSuggestion = useCallback(() => setSuggestion(""), []);
  const handleTogglePanel = useCallback((key) => {
    setActiveLayoutPreset("custom");
    setPanelPrefs((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const handleApplyLayoutPreset = useCallback((preset) => {
    const presets = {
      focus: {
        memory: false,
        statusRing: true
      },
      dev: {
        memory: false,
        statusRing: true
      },
      mission: {
        memory: true,
        statusRing: true
      }
    };

    const nextPrefs = presets[preset];
    if (!nextPrefs) {
      return;
    }

    setActiveLayoutPreset(preset);
    setPanelPrefs(nextPrefs);
  }, []);

  const handleRunAgentTool = useCallback((tool, params) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("agent:run", {
      tool,
      params,
      sessionId: activeChatId || `session-${authUser?.id || "unknown"}`
    });
  }, [activeChatId, authUser]);

  const handleConfirmAgentTool = useCallback((token) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("agent:confirm", { token });
    setPendingAgentConfirmation(null);
  }, []);

  const handleCancelAgentTool = useCallback((token) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("agent:cancel", { token });
    setPendingAgentConfirmation(null);
  }, []);

  const handleClearAgentEvents = useCallback(() => {
    setAgentEvents([]);
  }, []);

  const handleRefine = useCallback((messageId, content) => {
    if (!socketRef.current?.connected || !activeChatId) return;
    const refinePrompt = `Please refine and improve the following response: ${content}`;
    socketRef.current.emit("chat:message", {
      chatId: activeChatId,
      message: refinePrompt,
      modelPreference,
    });
  }, [activeChatId, modelPreference]);

  const handleAuthSubmit = useCallback(async () => {
    setIsAuthLoading(true);
    setAuthError("");
    try {
      const email = authEmail.trim().toLowerCase();
      const password = authPassword;
      const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!EMAIL_PATTERN.test(email)) {
        throw new Error("Enter a valid email address");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload = authMode === "register"
        ? { email, password, displayName: authDisplayName }
        : { email, password };
      const res = await fetch(`${SOCKET_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Invalid credentials");
        }
        if (res.status === 409) {
          throw new Error("Email already registered");
        }
        throw new Error(data.error || "Authentication failed");
      }
      setSessionTokens(data.accessToken, data.refreshToken);
      setAuthUser(data.user || null);
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setIsAuthLoading(false);
    }
  }, [authMode, authEmail, authPassword, authDisplayName, setSessionTokens]);

  const handleLogout = useCallback(async () => {
    try {
      if (accessToken) {
        await fetch(`${SOCKET_URL}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
    } catch (err) {
      console.warn("Logout failed:", err);
    }
    clearAuthSession();
  }, [accessToken, clearAuthSession]);

  if (!authUser) {
    return (
      <div className="h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-background)' }}>
        <div className="w-full max-w-md rounded-2xl p-8 warm-card soft-shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold" style={{ color: 'var(--color-text-primary)' }}>Sign in to Synapse</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {authMode === "register" ? "Create an account" : "Welcome back"}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Email</label>
              <input 
                value={authEmail} 
                onChange={(e) => setAuthEmail(e.target.value)} 
                placeholder="you@example.com" 
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ 
                  background: 'var(--color-surface-soft)', 
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-background-soft)'
                }} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Password</label>
              <div className="relative">
                <input 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Min. 8 characters" 
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                  style={{ 
                    background: 'var(--color-surface-soft)', 
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-background-soft)'
                  }} 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {authMode === "register" && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Display name (optional)</label>
                <input 
                  value={authDisplayName} 
                  onChange={(e) => setAuthDisplayName(e.target.value)} 
                  placeholder="Your name" 
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ 
                    background: 'var(--color-surface-soft)', 
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-background-soft)'
                  }} 
                />
              </div>
            )}
            {authError && (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>{authError}</p>
            )}
            <button 
              disabled={isAuthLoading} 
              onClick={handleAuthSubmit} 
              className="w-full px-4 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--color-primary)' }}
            >
              {isAuthLoading ? "Please wait..." : authMode === "register" ? "Create account" : "Sign in"}
            </button>
            <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {authMode === "register" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                onClick={() => setAuthMode((m) => (m === "register" ? "login" : "register"))} 
                className="font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                {authMode === "register" ? "Sign in" : "Register"}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Connection toast */}
      <ConnectionToast isConnected={isConnected} connectionError={connectionError} />

      {/* Layout */}
      <div
        className="flex h-screen w-full overflow-hidden relative"
        style={{ zIndex: 1 }}
      >
        <Sidebar
          sessions={chatSessions}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={() => {
            setActiveChatId(null);
            localStorage.removeItem("active_chat_id");
            setMessages([]);
            setSuggestion("");
          }}
          onDeleteChat={handleDeleteChat}
          onLogout={handleLogout}
          panelPrefs={panelPrefs}
          onTogglePanel={handleTogglePanel}
          activeLayoutPreset={activeLayoutPreset}
          onApplyLayoutPreset={handleApplyLayoutPreset}
          memoryFacts={memoryFacts}
          memoryEpisodes={memoryEpisodes}
          memoryProfile={memoryProfile}
          isConnected={isConnected}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        />

        {/* Main content — flexible center column */}
        <main
          className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative"
        >
          <ChatWindow
            messages={messages}
            isTyping={isTyping}
            isWaitingReply={isWaitingReply}
            isSpeaking={isSpeaking}
            operatorName={operatorName}
            suggestion={suggestion}
            modelPreference={modelPreference}
            onModelPreferenceChange={setModelPreference}
            onOpenSandbox={() => setIsSandboxOpen(true)}
            onSendMessage={handleSendMessage}
            onStopMessage={handleStopMessage}
            onStopAudio={handleStopAudio}
            onFeedback={handleFeedback}
            onRefine={handleRefine}
            onSuggest={handleSuggest}
            clearSuggestion={handleClearSuggestion}
            agentEvents={agentEvents}
            pendingAgentConfirmation={pendingAgentConfirmation}
            showStatusRing={panelPrefs.statusRing}
          />
        </main>

        <SandboxPanel isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
