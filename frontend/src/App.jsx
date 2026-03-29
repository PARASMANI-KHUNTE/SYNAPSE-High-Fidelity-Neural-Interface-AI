import { useState, useEffect, useRef, useCallback, Component } from "react";
import { io } from "socket.io-client";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import SandboxPanel from "./components/SandboxPanel";
import ThreeBackground from "./components/ThreeBackground";
import AvatarCanvas from "./components/AvatarCanvas";
import AgentDebugPanel from "./components/AgentDebugPanel";
import MemoryPanel from "./components/MemoryPanel";
import SystemPanel from "./components/SystemPanel";
import TriggerPanel from "./components/TriggerPanel";
import ToolFeed from "./components/ToolFeed";
 
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import "./App.css";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

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
          style={{ background: '#0d0a1a', color: '#f1e9ff', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <div className="text-center p-8 max-w-sm">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{
                background: 'rgba(244,63,94,0.12)',
                border: '1px solid rgba(244,63,94,0.3)',
              }}
            >
              <WifiOff size={28} style={{ color: '#f43f5e' }} />
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: '#f1e9ff' }}>Something went wrong</h1>
            <p className="text-sm mb-6" style={{ color: '#6b5f8a' }}>Please refresh the page to continue</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: '#f1e9ff',
                border: 'none',
                boxShadow: '0 0 20px rgba(168,85,247,0.4)',
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
          className="fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-medium"
          style={connectionError ? {
            background: 'rgba(22,17,46,0.9)',
            border: '1px solid rgba(244,63,94,0.3)',
            color: '#fb7185',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          } : !isConnected ? {
            background: 'rgba(22,17,46,0.9)',
            border: '1px solid rgba(168,85,247,0.25)',
            color: '#b8a8d8',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          } : {
            background: 'rgba(22,17,46,0.9)',
            border: '1px solid rgba(74,222,128,0.3)',
            color: '#4ade80',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {connectionError ? (
            <>
              <WifiOff size={14} style={{ color: '#fb7185' }} />
              <span>Connection lost</span>
            </>
          ) : !isConnected ? (
            <>
              <Loader2 size={14} className="animate-spin" style={{ color: '#a855f7' }} />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wifi size={14} style={{ color: '#4ade80' }} />
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
        triggers: saved.triggers !== false,
        system: saved.system !== false,
        console: saved.console !== false,
        toolFeed: saved.toolFeed !== false,
        statusRing: saved.statusRing !== false
      };
    } catch {
      return {
        memory: true,
        triggers: true,
        system: true,
        console: true,
        toolFeed: true,
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
  const [systemStatus, setSystemStatus] = useState(null);
  const [triggers, setTriggers] = useState([]);
  const [triggerAlerts, setTriggerAlerts] = useState([]);
  const [updatingTriggerId, setUpdatingTriggerId] = useState("");
  const [isCreatingTrigger, setIsCreatingTrigger] = useState(false);
  const hasRightDockPanels = panelPrefs.memory || panelPrefs.triggers || panelPrefs.system || panelPrefs.console;

  const [userId] = useState(() => {
    const saved = localStorage.getItem("chat_user_id");
    if (saved) return saved;
    const newId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("chat_user_id", newId);
    return newId;
  });

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
  const userIdRef = useRef(userId);
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { localStorage.setItem("chat_model_preference", modelPreference); }, [modelPreference]);
  useEffect(() => { localStorage.setItem("synapse_panel_prefs", JSON.stringify(panelPrefs)); }, [panelPrefs]);
  useEffect(() => { localStorage.setItem("synapse_layout_preset", activeLayoutPreset); }, [activeLayoutPreset]);

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

  const fetchMemoryProfile = useCallback(() => {
    const query = new URLSearchParams({ userId }).toString();
    fetch(`${SOCKET_URL}/api/memory/profile?${query}`)
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
  }, [userId]);

  const fetchTriggers = useCallback(() => {
    fetch(`${SOCKET_URL}/api/triggers`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load triggers");
        }
        return response.json();
      })
      .then((data) => {
        setTriggers(data.triggers || []);
      })
      .catch(() => {});
  }, []);

  const pushTriggerAlert = useCallback((payload) => {
    setTriggerAlerts((prev) => {
      const next = [
        {
          id: payload?.id || `trigger_${Date.now()}`,
          ...payload
        },
        ...prev
      ];
      return next.slice(0, 5);
    });
  }, []);

  const fetchSystemStatus = useCallback(() => {
    fetch(`${SOCKET_URL}/api/system`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load system status");
        }
        return response.json();
      })
      .then((data) => {
        setSystemStatus(data);
      })
      .catch(() => {});
  }, []);

  const clearAudioQueue = useCallback(() => {
    audioQueueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
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
    audio.onended = () => { if (mountedRef.current && playNextFnRef.current) playNextFnRef.current(); };
    audio.onerror  = () => { if (mountedRef.current && playNextFnRef.current) playNextFnRef.current(); };
    const p = audio.play();
    if (p !== undefined) p.catch(() => { if (mountedRef.current && playNextFnRef.current) playNextFnRef.current(); });
  }, []);

  // eslint-disable-next-line react-hooks/refs
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
        const newSocket = io(SOCKET_URL, { reconnection: false, timeout: 10000 });
        socketRef.current = newSocket;
        if (setupListenersFnRef.current) setupListenersFnRef.current(newSocket);
      }
    }, delay);
  }, []);

  // eslint-disable-next-line react-hooks/refs
  scheduleReconnectFnRef.current = scheduleReconnect;

  useEffect(() => {
    mountedRef.current = true;

    const setupListeners = (socketInstance) => {
      socketInstance.on("connect", () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        socketInstance.emit("chat:list", { userId: userIdRef.current });
        socketInstance.emit("agent:tools:list");
        fetchMemoryProfile();
        fetchSystemStatus();
        fetchTriggers();
        if (activeChatIdRef.current) {
          socketInstance.emit("chat:history", { userId: userIdRef.current, chatId: activeChatIdRef.current });
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
        setConnectionError(err.message);
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
            role: m.role, content: m.content, imageUrls: m.imageUrls,
            audioUrl: m.audioUrl, feedback: m.feedback, isError: m.isError, _id: m._id,
          })));
        }
      });

      socketInstance.on("chat:deleted", () => {
        if (!mountedRef.current) return;
        socketInstance.emit("chat:list", { userId: userIdRef.current });
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
        pushAgentEvent("result", data);
      });

      socketInstance.on("agent:tool:error", (data) => {
        if (!mountedRef.current) return;
        pushAgentEvent("error", data);
      });

      socketInstance.on("agent:confirm:req", (data) => {
        if (!mountedRef.current) return;
        setPendingAgentConfirmation(data);
        pushAgentEvent("confirm", data);
      });

      socketInstance.on("agent:done", (data) => {
        if (!mountedRef.current) return;
        setPendingAgentConfirmation(null);
        pushAgentEvent("done", data);
      });

      socketInstance.on("trigger:alert", (data) => {
        if (!mountedRef.current) return;
        pushTriggerAlert(data);
      });

      socketInstance.on("chat:reply:start", () => {
        if (!mountedRef.current) return;
        setIsWaitingReply(false);
        setIsTyping(true);
        isGenerationActiveRef.current = true;
        setMessages((prev) => [...prev, { role: "assistant", content: "", id: `temp_${Date.now()}` }]);
        audioQueueRef.current = [];
      });

      socketInstance.on("chat:reply:chunk", (data) => {
        if (!mountedRef.current || !isGenerationActiveRef.current) return;
        setMessages((prev) => {
          const arr = [...prev];
          const last = arr[arr.length - 1];
          if (last?.role === "assistant") arr[arr.length - 1] = { ...last, content: last.content + (data?.chunk || "") };
          return arr;
        });
      });

      socketInstance.on("chat:reply:images", (data) => {
        if (!mountedRef.current) return;
        if (data?.images) {
          setMessages((prev) => {
            const arr = [...prev];
            for (let i = arr.length - 1; i >= 0; i--) {
              if (arr[i].role === "assistant") {
                const existing = arr[i].imageUrls || [];
                const fresh = data.images.filter((img) => !existing.includes(img));
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
        setMessages((prev) => {
          const arr = [...prev];
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i].role === "assistant") {
              const link = `\n\nDownload ${data.type || "file"}: ${data.url}`;
              if (!arr[i].content?.includes(data.url))
                arr[i] = { ...arr[i], content: `${arr[i].content || ""}${link}` };
              break;
            }
          }
          return arr;
        });
      });

      socketInstance.on("chat:reply:end", () => {
        if (!mountedRef.current) return;
        isGenerationActiveRef.current = false;
        setIsTyping(false);
        fetchMemoryProfile();
      });

      socketInstance.on("chat:stopped", () => {
        if (!mountedRef.current) return;
        setIsWaitingReply(false);
        isGenerationActiveRef.current = false;
        setIsTyping(false);
        clearAudioQueue();
      });

      socketInstance.on("chat:error", (data) => {
        if (!mountedRef.current) return;
        setIsWaitingReply(false);
        isGenerationActiveRef.current = false;
        setIsTyping(false);
        if (data?.message)
          setMessages((prev) => [...prev, { role: "assistant", content: data.message, isError: true, id: `err_${Date.now()}` }]);
      });

      socketInstance.on("audio:ready", (data) => {
        if (!mountedRef.current) return;
        if (localStorage.getItem("auto_speak") === "true" && data?.url) {
          try {
            const audio = new Audio(data.url);
            audio.preload = "auto";
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
    });

    socketRef.current = newSocket;
    setupListeners(newSocket);

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (newSocket) { newSocket.removeAllListeners(); newSocket.disconnect(); }
      clearAudioQueue();
    };
  }, [clearAudioQueue, scheduleReconnect, pushAgentEvent, pushTriggerAlert, fetchMemoryProfile, fetchSystemStatus, fetchTriggers]);

  useEffect(() => {
    if (!isConnected) {
      return undefined;
    }

    fetchSystemStatus();
    const intervalId = window.setInterval(fetchSystemStatus, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isConnected, fetchSystemStatus]);

  const handleStopAudio = useCallback(() => clearAudioQueue(), [clearAudioQueue]);

  const handleSendMessage = useCallback((content, fileUrl, fileType, voice, selectedModel) => {
    if (!socketRef.current?.connected) return;
    isGenerationActiveRef.current = false;
    setIsWaitingReply(true);
    socketRef.current.emit("chat:message", {
      userId,
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
      { role: "user", content, imageUrls: fileType === "image" ? (fileUrl ? [fileUrl] : []) : [] },
    ]);
  }, [userId, activeChatId, modelPreference]);

  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    localStorage.setItem("active_chat_id", chatId);
    setMessages([]);
    setSuggestion("");
    if (socketRef.current?.connected)
      socketRef.current.emit("chat:history", { userId, chatId });
  }, [userId]);

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
        triggers: false,
        system: false,
        console: false,
        toolFeed: false,
        statusRing: true
      },
      dev: {
        memory: false,
        triggers: false,
        system: true,
        console: true,
        toolFeed: true,
        statusRing: true
      },
      mission: {
        memory: true,
        triggers: true,
        system: true,
        console: true,
        toolFeed: true,
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
      userId,
      sessionId: activeChatId || `session-${userId}`
    });
  }, [activeChatId, userId]);

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
      userId,
      chatId: activeChatId,
      message: refinePrompt,
      modelPreference,
    });
  }, [userId, activeChatId, modelPreference]);

  const handleToggleTrigger = useCallback((trigger) => {
    setUpdatingTriggerId(trigger.id);
    fetch(`${SOCKET_URL}/api/triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !trigger.enabled })
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update trigger");
        }
        return response.json();
      })
      .then(() => {
        fetchTriggers();
      })
      .catch(() => {})
      .finally(() => {
        setUpdatingTriggerId("");
      });
  }, [fetchTriggers]);

  const handleCreateTrigger = useCallback((triggerDraft) => {
    setIsCreatingTrigger(true);
    fetch(`${SOCKET_URL}/api/triggers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(triggerDraft)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to create trigger");
        }
        return response.json();
      })
      .then(() => {
        fetchTriggers();
      })
      .catch(() => {})
      .finally(() => {
        setIsCreatingTrigger(false);
      });
  }, [fetchTriggers]);

  return (
    <ErrorBoundary>
      {/* 3D Background */}
      <ThreeBackground isSpeaking={isSpeaking} />

      {/* Connection toast */}
      <ConnectionToast isConnected={isConnected} connectionError={connectionError} />

      {/* Layout */}
      <div
        className="flex h-screen w-full overflow-hidden relative"
        style={{ zIndex: 1, fontFamily: 'Space Grotesk, sans-serif' }}
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
          panelPrefs={panelPrefs}
          onTogglePanel={handleTogglePanel}
          activeLayoutPreset={activeLayoutPreset}
          onApplyLayoutPreset={handleApplyLayoutPreset}
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
            showToolFeed={panelPrefs.toolFeed && !hasRightDockPanels}
            showStatusRing={panelPrefs.statusRing}
          />
          
          {/* 3D Interactive Avatar on the right (hidden on smaller screens) */}
          <AvatarCanvas
            isTyping={isTyping}
            isSpeaking={isSpeaking}
            isDockCompressed={hasRightDockPanels}
          />
        </main>

        {/* Right Sidebar — strictly for auxiliary panels */}
        {hasRightDockPanels && (
          <aside className="w-[320px] shrink-0 h-full hidden lg:flex flex-col gap-3 border-l border-[var(--color-tactical-blue)] bg-[rgba(5,7,15,0.85)] overflow-y-auto hide-scrollbar relative z-10 backdrop-blur-sm p-3">
            {panelPrefs.memory && (
              <MemoryPanel
                facts={memoryFacts}
                episodes={memoryEpisodes}
                profile={memoryProfile}
                isConnected={isConnected}
              />
            )}
            {panelPrefs.triggers && (
              <TriggerPanel
                triggers={triggers}
                alerts={triggerAlerts}
                isConnected={isConnected}
                onToggleTrigger={handleToggleTrigger}
                isUpdatingId={updatingTriggerId}
                onCreateTrigger={handleCreateTrigger}
                isCreating={isCreatingTrigger}
              />
            )}
            {panelPrefs.system && (
              <SystemPanel
                status={systemStatus}
                isConnected={isConnected}
              />
            )}
            {panelPrefs.toolFeed && (
              <ToolFeed
                events={agentEvents}
                docked
              />
            )}
            <div className="flex-1 min-h-[20px]" />
            {panelPrefs.console && (
              <AgentDebugPanel
                isConnected={isConnected}
                tools={agentTools}
                events={agentEvents}
                pendingConfirmation={pendingAgentConfirmation}
                onRunTool={handleRunAgentTool}
                onConfirm={handleConfirmAgentTool}
                onCancel={handleCancelAgentTool}
                onClearEvents={handleClearAgentEvents}
              />
            )}
          </aside>
        )}

        <SandboxPanel isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
