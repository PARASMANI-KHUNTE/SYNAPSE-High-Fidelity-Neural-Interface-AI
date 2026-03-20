import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';

function App() {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(localStorage.getItem('active_chat_id') || null);
  
  const [userId] = useState(() => {
    const saved = localStorage.getItem('chat_user_id');
    if (saved) return saved;
    const newId = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chat_user_id', newId);
    return newId;
  });

  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const isGenerationActiveRef = useRef(false);

  // Initialize Socket once
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to backend:', newSocket.id);
      newSocket.emit('chat:list', { userId });
      if (activeChatId) {
         newSocket.emit('chat:history', { userId, chatId: activeChatId });
      }
    });

    newSocket.on('chat:list:reply', (data) => {
      if (data.chats) {
        setChatSessions(data.chats);
      }
    });

    newSocket.on('chat:created', (data) => {
      setActiveChatId(data.chatId);
      localStorage.setItem('active_chat_id', data.chatId);
      setChatSessions(prev => [{ _id: data.chatId, title: data.title }, ...prev]);
    });

    newSocket.on('chat:history:reply', (data) => {
      if (data.messages) {
        setMessages(data.messages.map(m => ({
          role: m.role,
          content: m.content,
          imageUrls: m.imageUrls,
          audioUrl: m.audioUrl,
          isError: m.isError
        })));
      }
    });

    newSocket.on('chat:reply:start', () => {
      setIsTyping(true);
      isGenerationActiveRef.current = true;
      setMessages((prev) => [...prev, { role: 'assistant', content: '', id: Date.now() }]);
      audioQueueRef.current = [];
    });

    newSocket.on('chat:reply:chunk', (data) => {
      if (!isGenerationActiveRef.current) return;
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        const lastMsg = newMessages[lastIndex];
        if (lastMsg && lastMsg.role === 'assistant') {
          newMessages[lastIndex] = { ...lastMsg, content: lastMsg.content + data.chunk };
        }
        return newMessages;
      });
    });

    newSocket.on('chat:reply:images', (data) => {
       if (!isGenerationActiveRef.current) return;
       setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          const lastMsg = newMessages[lastIndex];
          if (lastMsg && lastMsg.role === 'assistant') {
             const existingImgs = lastMsg.imageUrls || [];
             newMessages[lastIndex] = { ...lastMsg, imageUrls: [...existingImgs, ...data.images] };
          }
          return newMessages;
       });
    });

    newSocket.on('chat:reply:end', () => {
      isGenerationActiveRef.current = false;
      setIsTyping(false);
    });

    newSocket.on('chat:error', (data) => {
      isGenerationActiveRef.current = false;
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, isError: true }]);
    });

    newSocket.on('audio:ready', (data) => {
      if (localStorage.getItem('auto_speak') === 'true' && data.url) {
        // Pre-load audio
        const audio = new Audio(data.url);
        audio.preload = 'auto';
        audioQueueRef.current.push(audio);
        
        if (!isSpeakingRef.current) {
          playNext();
        }
      }
    });

    const playNext = () => {
      if (audioQueueRef.current.length === 0) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        return;
      }

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      const audio = audioQueueRef.current.shift();
      audioRef.current = audio;
      audio.onended = playNext;
      audio.onerror = playNext;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error("Playback error:", err);
          playNext();
        });
      }
    };

    return () => newSocket.close();
  }, [userId]);

  const handleStopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    audioQueueRef.current = [];
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  };

  const handleSendMessage = (content, fileUrl, fileType, voice) => {
    if (!socket) return;
    // Ensure previous session is dead
    isGenerationActiveRef.current = false;

    const msgData = { 
      userId, 
      chatId: activeChatId, 
      message: content, 
      fileUrl: fileType === 'image' ? null : fileUrl, 
      images: fileType === 'image' ? (fileUrl ? [fileUrl] : []) : [], 
      voice 
    };
    setMessages(prev => [...prev, { role: 'user', content, imageUrls: fileType === 'image' ? (fileUrl ? [fileUrl] : []) : [] }]);
    socket.emit('chat:message', msgData);
  };

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    localStorage.setItem('active_chat_id', chatId);
    socket.emit('chat:history', { userId, chatId });
  };

  const handleDeleteChat = (chatId) => {
    socket.emit('chat:delete', { chatId });
    if (activeChatId === chatId) {
       setActiveChatId(null);
       localStorage.removeItem('active_chat_id');
       setMessages([]);
    }
  };

  const handleStopMessage = () => {
    if (socket) socket.emit('chat:stop');
    isGenerationActiveRef.current = false;
    handleStopAudio();
    setIsTyping(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      <Sidebar 
        sessions={chatSessions} 
        activeChatId={activeChatId} 
        onSelectChat={handleSelectChat}
        onNewChat={() => { setActiveChatId(null); localStorage.removeItem('active_chat_id'); setMessages([]); }}
        onDeleteChat={handleDeleteChat}
      />
      <div className="flex flex-col flex-1 pl-64 transition-all duration-300">
        <ChatWindow 
          messages={messages} 
          isTyping={isTyping} 
          isSpeaking={isSpeaking}
          onSendMessage={handleSendMessage} 
          onStopMessage={handleStopMessage} 
          onStopAudio={handleStopAudio}
        />
      </div>
    </div>
  );
}

export default App;
