import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const Particle = ({ delay, duration, x, size, isActive }) => (
  <motion.div
    initial={{ y: "110%", opacity: 0, scale: 0 }}
    animate={{ 
      y: "-10%", 
      opacity: isActive ? [0, 0.8, 0] : [0, 0.3, 0],
      scale: [0, 1, 0.5],
      x: `calc(${x}% + ${Math.sin(delay) * 20}px)`
    }}
    transition={{ 
      duration: isActive ? duration * 0.6 : duration, 
      repeat: Infinity, 
      delay, 
      ease: "linear" 
    }}
    className="absolute bg-cyan-400 rounded-full blur-[1px]"
    style={{ left: `${x}%`, width: size, height: size }}
  />
);

const Particles = ({ isSpeaking }) => {
  const particleCount = isSpeaking ? 40 : 15;
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      delay: Math.random() * 10,
      duration: 10 + Math.random() * 15,
      x: Math.random() * 100,
      size: 1 + Math.random() * 3
    }));
  }, [particleCount]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <Particle key={p.id} {...p} isActive={isSpeaking} />
      ))}
    </div>
  );
};

export default React.memo(Particles);
