import { useState, useEffect, useRef, useCallback, Component } from "react";
import { io } from "socket.io-client";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

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
        <div className="flex items-center justify-center h-screen bg-[#020617] text-white">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-4">Please refresh the page to continue</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold"
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

function App() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [operatorName, setOperatorName] = useState("Operator");
  const [availableModels, setAvailableModels] = useState({});
  const [modelPreference, setModelPreference] = useState(() => localStorage.getItem("chat_model_preference") || "auto");
  
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(() => localStorage.getItem("active_chat_id") || null);
  const [suggestion, setSuggestion] = useState("");
  
  const [userId] = useState(() => {
    const saved = localStorage.getItem("chat_user_id");
    if (saved) return saved;
    const newId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("chat_user_id", newId);
    return newId;
  });

  const socketRef = useRef(null);
  const [, setSocket] = useState(null);
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

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    localStorage.setItem("chat_model_preference", modelPreference);
  }, [modelPreference]);

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
    
    audio.onended = () => {
      if (mountedRef.current && playNextFnRef.current) playNextFnRef.current();
    };
    
    audio.onerror = () => {
      if (mountedRef.current && playNextFnRef.current) playNextFnRef.current();
    };
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (mountedRef.current && playNextFnRef.current) playNextFnRef.current();
      });
    }
  }, []);

  // eslint-disable-next-line react-hooks/refs
  playNextFnRef.current = playNext;

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionError("Maximum reconnection attempts reached. Please refresh the page.");
      return;
    }
    
    reconnectAttemptsRef.current += 1;
    const delay = RECONNECT_DELAY * reconnectAttemptsRef.current;
    
    console.log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && !socketRef.current?.connected) {
        const newSocket = io(SOCKET_URL, {
          reconnection: false,
          timeout: 10000
        });
        socketRef.current = newSocket;
        if (setupListenersFnRef.current) {
          setupListenersFnRef.current(newSocket);
        }
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
        console.log("Connected to backend:", socketInstance.id);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        socketInstance.emit("chat:list", { userId: userIdRef.current });
        
        if (activeChatIdRef.current) {
          socketInstance.emit("chat:history", { userId: userIdRef.current, chatId: activeChatIdRef.current });
        }
      });

      socketInstance.on("disconnect", (reason) => {
        if (!mountedRef.current) return;
        console.log("Disconnected from backend:", reason);
        setIsConnected(false);
        
        if (reason !== "io client disconnect" && scheduleReconnectFnRef.current) {
          scheduleReconnectFnRef.current();
        }
      });

      socketInstance.on("error", (err) => {
        console.error("Socket level error:", err);
      });

      socketInstance.on("connect_error", (err) => {
        if (!mountedRef.current) return;
        console.error("Connection error:", err.message);
        setConnectionError(err.message);
        if (scheduleReconnectFnRef.current) scheduleReconnectFnRef.current();
      });

      socketInstance.on("ping:timeout", () => {
        console.warn("Server ping timeout");
        socketInstance.disconnect();
      });

      socketInstance.on("chat:list:reply", (data) => {
        if (!mountedRef.current) return;
        if (data?.chats) {
          setChatSessions(data.chats);
        }
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
          setMessages(
            data.messages.map((m) => ({
              role: m.role,
              content: m.content,
              imageUrls: m.imageUrls,
              audioUrl: m.audioUrl,
              feedback: m.feedback,
              isError: m.isError,
              _id: m._id
            }))
          );
        }
      });

      socketInstance.on("chat:deleted", () => {
        if (!mountedRef.current) return;
        socketInstance.emit("chat:list", { userId: userIdRef.current });
      });

      socketInstance.on("chat:suggestion", (data) => {
        if (!mountedRef.current) return;
        if (data?.suggestion) {
          setSuggestion(data.suggestion);
        }
      });

      socketInstance.on("chat:reply:start", () => {
        if (!mountedRef.current) return;
        setIsTyping(true);
        isGenerationActiveRef.current = true;
        setMessages((prev) => [...prev, { role: "assistant", content: "", id: `temp_${Date.now()}` }]);
        audioQueueRef.current = [];
      });

      socketInstance.on("chat:reply:chunk", (data) => {
        if (!mountedRef.current || !isGenerationActiveRef.current) return;
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          const lastMsg = newMessages[lastIndex];
          if (lastMsg && lastMsg.role === "assistant") {
            newMessages[lastIndex] = { ...lastMsg, content: lastMsg.content + (data?.chunk || "") };
          }
          return newMessages;
        });
      });

      socketInstance.on("chat:reply:images", (data) => {
        if (!mountedRef.current) return;
        if (data?.images) {
          setMessages((prev) => {
            const newMessages = [...prev];
            // Find the last assistant message to attach images to
            for (let i = newMessages.length - 1; i >= 0; i--) {
              if (newMessages[i].role === "assistant") {
                const existingImgs = newMessages[i].imageUrls || [];
                const newImgs = data.images.filter(img => !existingImgs.includes(img));
                if (newImgs.length > 0) {
                  newMessages[i] = { ...newMessages[i], imageUrls: [...existingImgs, ...newImgs] };
                }
                break;
              }
            }
            return newMessages;
          });
        }
      });

      socketInstance.on("chat:reply:end", () => {
        if (!mountedRef.current) return;
        isGenerationActiveRef.current = false;
        setIsTyping(false);
      });

      socketInstance.on("chat:stopped", () => {
        if (!mountedRef.current) return;
        isGenerationActiveRef.current = false;
        setIsTyping(false);
        clearAudioQueue();
      });

      socketInstance.on("chat:error", (data) => {
        if (!mountedRef.current) return;
        isGenerationActiveRef.current = false;
        setIsTyping(false);
        if (data?.message) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.message, isError: true, id: `err_${Date.now()}` }]);
        }
      });

      socketInstance.on("audio:ready", (data) => {
        if (!mountedRef.current) return;
        if (localStorage.getItem("auto_speak") === "true" && data?.url) {
          try {
            const audio = new Audio(data.url);
            audio.preload = "auto";
            audioQueueRef.current.push(audio);
            
            if (!isSpeakingRef.current && playNextFnRef.current) {
              playNextFnRef.current();
            }
          } catch (err) {
            console.error("Failed to create audio:", err);
          }
        }
      });
    };

    setupListenersFnRef.current = setupListeners;

    fetch(`${SOCKET_URL}/api/config`)
      .then((res) => {
        if (!res.ok) throw new Error("Config fetch failed");
        return res.json();
      })
      .then((data) => {
        if (data?.operatorName) setOperatorName(data.operatorName);
        if (data?.models) setAvailableModels(data.models);
      })
      .catch(() => {});

    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: 10000,
      timeout: 15000
    });

    socketRef.current = newSocket;
    setupListeners(newSocket);
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (newSocket) {
        newSocket.removeAllListeners();
        newSocket.disconnect();
      }
      clearAudioQueue();
    };
  }, [clearAudioQueue, scheduleReconnect]);

  const handleStopAudio = useCallback(() => {
    clearAudioQueue();
  }, [clearAudioQueue]);

  const handleSendMessage = useCallback((content, fileUrl, fileType, voice, selectedModelPreference) => {
    if (!socketRef.current?.connected) {
      console.warn("Socket not connected, message not sent");
      return;
    }
    
    isGenerationActiveRef.current = false;

    const msgData = {
      userId,
      chatId: activeChatId,
      message: content || "",
      fileUrl: fileType === "image" ? null : fileUrl,
      fileType: fileType || null,
      images: fileType === "image" ? (fileUrl ? [fileUrl] : []) : [],
      voice,
      modelPreference: selectedModelPreference || modelPreference
    };
    
    setMessages((prev) => [
      ...prev,
      { role: "user", content, imageUrls: fileType === "image" ? (fileUrl ? [fileUrl] : []) : [] }
    ]);
    
    socketRef.current.emit("chat:message", msgData);
  }, [userId, activeChatId, modelPreference]);

  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    localStorage.setItem("active_chat_id", chatId);
    setMessages([]);
    setSuggestion("");
    
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:history", { userId, chatId });
    }
  }, [userId]);

  const handleDeleteChat = useCallback((chatId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:delete", { chatId });
    }
    
    if (activeChatId === chatId) {
      setActiveChatId(null);
      localStorage.removeItem("active_chat_id");
      setMessages([]);
    }
  }, [activeChatId]);

  const handleStopMessage = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:stop");
    }
    isGenerationActiveRef.current = false;
    setIsTyping(false);
    handleStopAudio();
  }, [handleStopAudio]);

  const handleFeedback = useCallback((messageId, type) => {
    if (socketRef.current?.connected && activeChatId) {
      socketRef.current.emit("chat:feedback", { chatId: activeChatId, messageId, feedback: type });
    }
  }, [activeChatId]);

  const handleSuggest = useCallback((input) => {
    if (socketRef.current?.connected && input?.length > 5) {
      socketRef.current.emit("chat:suggest", { input: input.substring(0, 500) });
    }
  }, []);

  const handleClearSuggestion = useCallback(() => {
    setSuggestion("");
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-cyan-500/30">
        {!isConnected && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            {connectionError ? "Connection lost" : "Connecting..."}
          </div>
        )}
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
        />
        <div className="flex flex-col flex-1 pl-64 transition-all duration-300">
          <ChatWindow
            messages={messages}
            isTyping={isTyping}
            isSpeaking={isSpeaking}
            operatorName={operatorName}
            suggestion={suggestion}
            modelPreference={modelPreference}
            onModelPreferenceChange={setModelPreference}
            availableModels={availableModels}
            onSendMessage={handleSendMessage}
            onStopMessage={handleStopMessage}
            onFeedback={handleFeedback}
            onSuggest={handleSuggest}
            clearSuggestion={handleClearSuggestion}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
