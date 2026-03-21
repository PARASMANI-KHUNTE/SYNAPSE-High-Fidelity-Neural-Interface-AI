import React, { useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

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

const Particles = React.memo(({ isSpeaking }) => {
  const particleCount = isSpeaking ? 40 : 15;
  
  const particles = useMemo(() => {
    const baseSeed = 12345 + particleCount;
    return Array.from({ length: particleCount }).map((_, i) => {
      const seed = baseSeed + i * 17;
      return {
        id: i,
        delay: seededRandom(seed) * 10,
        duration: 10 + seededRandom(seed + 1) * 15,
        x: seededRandom(seed + 2) * 100,
        size: 1 + seededRandom(seed + 3) * 3
      };
    });
  }, [particleCount]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <Particle key={p.id} {...p} isActive={isSpeaking} />
      ))}
    </div>
  );
});

Particles.displayName = 'Particles';

export default Particles;
