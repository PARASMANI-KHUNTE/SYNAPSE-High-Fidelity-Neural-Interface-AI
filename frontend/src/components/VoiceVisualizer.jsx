import React from 'react';
import { motion } from 'framer-motion';

const VoiceVisualizer = ({ isActive }) => {
  if (!isActive) return null;

  // Optimized particle count for performance
  const particleCount = 20;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <div className="relative w-20 h-20 flex items-center justify-center">
        
        {/* 🌌 NEBULAR ATMOSPHERE (COMPACT BACK GLOW) */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-28 h-28 bg-blue-600/10 rounded-full blur-[30px]"
        />

        {/* 💫 SWIRLING PARTICLE FIELD (OPTIMIZED) */}
        {[...Array(particleCount)].map((_, i) => {
          const angle = Math.random() * Math.PI * 2;
          const radius = 12 + Math.random() * 12;
          const duration = 2.5 + Math.random() * 2;
          
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: [0, 0.8, 0],
                rotate: 360,
                scale: [0, 1.2, 0],
              }}
              transition={{ 
                duration: duration, 
                repeat: Infinity, 
                delay: Math.random() * duration,
                ease: "linear"
              }}
              className="absolute bg-cyan-200 rounded-full shadow-[0_0_4px_#fff]"
              style={{ 
                width: '1px',
                height: '1px',
                left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                transformOrigin: `${-Math.cos(angle) * radius}px ${-Math.sin(angle) * radius}px`
              }}
            />
          );
        })}

        {/* 🔥 MAIN ENERGY RING (COMPACT PORTAL) */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 0.98, 1.02, 1],
            boxShadow: [
              "0 0 10px rgba(34,211,238,0.4), inset 0 0 5px rgba(34,211,238,0.3)",
              "0 0 25px rgba(6,182,212,0.8), inset 0 0 15px rgba(6,182,212,0.6)",
              "0 0 10px rgba(34,211,238,0.4), inset 0 0 5px rgba(34,211,238,0.3)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-14 h-14 border-[2px] border-cyan-400 rounded-full mix-blend-screen overflow-hidden"
        />

        {/* ✨ INNER GLOWING CORE */}
        <motion.div
           animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.4, 0.2] }}
           transition={{ duration: 3, repeat: Infinity }}
           className="absolute w-10 h-10 bg-cyan-500/10 rounded-full blur-xl mix-blend-plus-lighter"
        />

        {/* ⚡ ACTIVE DISCHARGE (SUBTLE) */}
        <motion.div 
            animate={{ opacity: [0, 0.5, 0], scale: [0.9, 1.1, 1] }} 
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute w-18 h-18 border border-white/5 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        />

      </div>
    </div>
  );
};

export default VoiceVisualizer;
