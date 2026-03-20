import React from 'react';
import { motion } from 'framer-motion';

const VoiceVisualizer = ({ isActive }) => {
  if (!isActive) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 scale-125">
      {/* 🌌 OUTER NEURAL RINGS */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: [0.1, 0.4, 0.1], 
            scale: [1, 1.4 + (i * 0.2), 1],
            rotate: i % 2 === 0 ? 360 : -360
          }}
          transition={{ 
            duration: 3 + i, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="absolute inset-0 border border-cyan-500/20 rounded-full blur-[2px]"
          style={{ borderStyle: 'dashed', borderDasharray: `${10 + i * 5} ${20 + i * 5}` }}
        />
      ))}

      {/* 🚀 CENTRAL FREQUENCY CORE */}
      <div className="relative flex items-end gap-[2px] h-8 pt-4">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ 
              height: [4, 12 + Math.random() * 20, 8, 15 + Math.random() * 15, 4],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{ 
              duration: 0.6 + (Math.random() * 0.4), 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: i * 0.05
            }}
            className="w-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.6)]"
          />
        ))}
      </div>

      {/* AMBIENT GLOW */}
      <motion.div 
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-cyan-500/10 rounded-full blur-2xl"
      />
    </div>
  );
};

export default VoiceVisualizer;
