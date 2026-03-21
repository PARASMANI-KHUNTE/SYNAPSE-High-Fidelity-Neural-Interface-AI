import React, { useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const VoiceVisualizer = React.memo(({ isActive }) => {
  const particleCount = 20;
  
  const particles = useMemo(() => {
    const baseSeed = 54321 + particleCount;
    return Array.from({ length: particleCount }).map((_, i) => {
      const seed = baseSeed + i * 13;
      return {
        angle: seededRandom(seed) * Math.PI * 2,
        radius: 12 + seededRandom(seed + 1) * 12,
        duration: 2.5 + seededRandom(seed + 2) * 2,
        delay: seededRandom(seed + 3) * 2.5
      };
    });
  }, [particleCount]);
  
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <div className="relative w-20 h-20 flex items-center justify-center">
        
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-28 h-28 bg-blue-600/10 rounded-full blur-[30px]"
        />

        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.8, 0],
              rotate: 360,
              scale: [0, 1.2, 0],
            }}
            transition={{ 
              duration: p.duration, 
              repeat: Infinity,
              delay: p.delay,
              ease: "linear"
            }}
            className="absolute bg-cyan-200 rounded-full shadow-[0_0_4px_#fff]"
            style={{ 
              width: '1px',
              height: '1px',
              left: `calc(50% + ${Math.cos(p.angle) * p.radius}px)`,
              top: `calc(50% + ${Math.sin(p.angle) * p.radius}px)`,
              transformOrigin: `${-Math.cos(p.angle) * p.radius}px ${-Math.sin(p.angle) * p.radius}px`
            }}
          />
        ))}

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

        <motion.div
           animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.4, 0.2] }}
           transition={{ duration: 3, repeat: Infinity }}
           className="absolute w-10 h-10 bg-cyan-500/10 rounded-full blur-xl mix-blend-plus-lighter"
        />

        <motion.div 
            animate={{ opacity: [0, 0.5, 0], scale: [0.9, 1.1, 1] }} 
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute w-18 h-18 border border-white/5 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        />

      </div>
    </div>
  );
});

VoiceVisualizer.displayName = 'VoiceVisualizer';

export default VoiceVisualizer;
