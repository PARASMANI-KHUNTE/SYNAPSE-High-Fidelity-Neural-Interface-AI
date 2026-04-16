import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const Avatar2D = ({ emotion = "neutral", isSpeaking, isTyping }) => {
  const getEyeColor = () => {
    switch (emotion) {
      case "happy": return "#00ffcc";
      case "focused": return "#8e44ad";
      case "tired": return "#6677aa";
      case "confused": return "#f1c40f";
      default: return "#00f0ff";
    }
  };

  const eyeColor = getEyeColor();
  const showBlush = emotion === "happy" || isSpeaking;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <motion.div
        animate={{
          scale: isSpeaking ? [1, 1.2, 1] : 1,
          opacity: isSpeaking ? [0.4, 0.7, 0.4] : 0.3,
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background: isSpeaking 
            ? "radial-gradient(circle, #ff5050 0%, transparent 70%)"
            : "radial-gradient(circle, #00f0ff 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full h-full p-6 flex flex-col items-center justify-center">
        <motion.div
          animate={{
            scale: isSpeaking ? [1, 1.02, 1] : isTyping ? [1, 1.01, 1] : 1,
          }}
          transition={{ 
            duration: isSpeaking ? 0.8 : 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="w-48 h-48 relative"
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <defs>
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffe4c4" />
                <stop offset="100%" stopColor="#f5d5b5" />
              </linearGradient>
              <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2d1b4e" />
                <stop offset="100%" stopColor="#1a0f2e" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <ellipse cx="100" cy="115" rx="70" ry="80" fill="url(#skinGrad)" />
            
            <ellipse cx="100" cy="50" rx="65" ry="45" fill="url(#hairGrad)" />
            <path d="M 35 80 Q 20 120 40 160" stroke="url(#hairGrad)" strokeWidth="15" fill="none" />
            <path d="M 165 80 Q 180 120 160 160" stroke="url(#hairGrad)" strokeWidth="15" fill="none" />
            
            <ellipse cx="70" cy="110" rx="18" ry="22" fill="#1a1a2e" />
            <ellipse cx="70" cy="108" rx="12" ry="14" fill={eyeColor} filter="url(#glow)" />
            <circle cx="74" cy="103" r="5" fill="white" opacity="0.8" />
            
            <ellipse cx="130" cy="110" rx="18" ry="22" fill="#1a1a2e" />
            <ellipse cx="130" cy="108" rx="12" ry="14" fill={eyeColor} filter="url(#glow)" />
            <circle cx="134" cy="103" r="5" fill="white" opacity="0.8" />
            
            {showBlush && (
              <>
                <ellipse cx="55" cy="130" rx="15" ry="8" fill="#ff9999" opacity="0.5" />
                <ellipse cx="145" cy="130" rx="15" ry="8" fill="#ff9999" opacity="0.5" />
              </>
            )}
            
            <path d="M 85 145 Q 100 160 115 145" stroke="#cc6666" strokeWidth="3" fill="none" strokeLinecap="round" />
            
            {isTyping && (
              <g>
                <rect x="75" y="165" width="8" height="8" rx="2" fill={eyeColor} opacity="0.6">
                  <animate attributeName="opacity" values="0.6;1;0.6" dur="0.6s" repeatCount="Infinity" />
                </rect>
                <rect x="96" y="165" width="8" height="8" rx="2" fill={eyeColor} opacity="0.6">
                  <animate attributeName="opacity" values="0.6;1;0.6" dur="0.6s" begin="0.2s" repeatCount="Infinity" />
                </rect>
                <rect x="117" y="165" width="8" height="8" rx="2" fill={eyeColor} opacity="0.6">
                  <animate attributeName="opacity" values="0.6;1;0.6" dur="0.6s" begin="0.4s" repeatCount="Infinity" />
                </rect>
              </g>
            )}
          </svg>
        </motion.div>

        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
          {isSpeaking && (
            <>
              <motion.div
                animate={{ height: [4, 12, 4] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                className="w-1 bg-white/40 rounded-full"
              />
              <motion.div
                animate={{ height: [4, 20, 4] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                className="w-1 bg-white/60 rounded-full"
              />
              <motion.div
                animate={{ height: [4, 12, 4] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                className="w-1 bg-white/40 rounded-full"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Avatar2D;
