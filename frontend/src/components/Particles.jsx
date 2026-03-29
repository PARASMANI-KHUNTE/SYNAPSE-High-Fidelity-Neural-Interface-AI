import React, { useMemo } from 'react';
 
import { motion } from 'framer-motion';

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Tactical Data Packets
const DataPacket = ({ delay, duration, x, size, isActive, colorType }) => {
  const colors = {
    cyan: { bg: 'var(--color-cyan)', shadow: 'rgba(0,240,255,0.4)' },
    red:  { bg: 'var(--color-neon-red)',  shadow: 'rgba(255,42,42,0.4)' },
    orange:   { bg: 'var(--color-neon-orange)',   shadow: 'rgba(255,144,0,0.4)' },
  };
  const c = colors[colorType] || colors.cyan;

  // Tactical packets fall down like a terminal buffer
  return (
    <motion.div
      initial={{ y: '-10%', opacity: 0 }}
      animate={{
        y: '105%',
        opacity: isActive ? [0, 0.8, 0] : [0, 0.2, 0],
      }}
      transition={{
        duration: isActive ? duration * 0.3 : duration * 0.8,
        repeat: Infinity,
        delay,
        ease: 'linear',
      }}
      className="absolute border"
      style={{
        left: `${x}%`,
        width: size,
        height: size * (isActive ? 4 : 2), // streak effect
        background: c.bg,
        boxShadow: `0 0 ${size * 2}px ${c.shadow}`,
        borderColor: c.bg,
        opacity: 0.6,
      }}
    />
  );
};

const Particles = React.memo(({ isSpeaking }) => {
  const particleCount = isSpeaking ? 60 : 20;

  const packets = useMemo(() => {
    const BASE = 420;
    return Array.from({ length: particleCount }).map((_, i) => {
      const s = BASE + i * 19;
      const colorIndex = Math.floor(seededRandom(s + 7) * 10);
      const colorType = colorIndex < 7 ? 'cyan' : colorIndex < 9 ? 'red' : 'orange';
      return {
        id: i,
        delay: seededRandom(s) * 5,
        duration: 3 + seededRandom(s + 1) * 8, // fast falling
        x: seededRandom(s + 2) * 100,
        size: 2 + seededRandom(s + 3) * 3, // tiny blocks
        colorType,
      };
    });
  }, [particleCount]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {packets.map(p => (
        <DataPacket
          key={p.id}
          delay={p.delay}
          duration={p.duration}
          x={p.x}
          size={p.size}
          colorType={p.colorType}
          isActive={isSpeaking}
        />
      ))}
    </div>
  );
});

export default Particles;
