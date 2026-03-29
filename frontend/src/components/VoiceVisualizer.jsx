import React, { useMemo } from 'react';
 
import { motion } from 'framer-motion';

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const VoiceVisualizer = React.memo(({ isActive }) => {
  const particleCount = 16;

  const particles = useMemo(() => {
    const base = 99991 + particleCount;
    return Array.from({ length: particleCount }).map((_, i) => {
      const s = base + i * 17;
      const angle = (i / particleCount) * Math.PI * 2;
      return {
        angle,
        radius: 22 + seededRandom(s + 1) * 10,
        duration: 2.2 + seededRandom(s + 2) * 1.8,
        delay: seededRandom(s + 3) * 2.2,
        size: 1.5 + seededRandom(s + 4) * 1.5,
      };
    });
  }, []);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
      <div className="relative" style={{ width: 68, height: 68 }}>

        {/* Outer glow halo */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)',
            filter: 'blur(16px)',
          }}
        />

        {/* Amber secondary halo */}
        <motion.div
          animate={{ scale: [1.1, 0.95, 1.1], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute inset-0 rounded-full"
          style={{
            margin: '-8px',
            background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 65%)',
            filter: 'blur(20px)',
          }}
        />

        {/* Orbit ring 1 */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute rounded-full"
          style={{
            inset: '-4px',
            border: '1px solid rgba(168,85,247,0.25)',
          }}
        />

        {/* Orbit ring 2 - reverse */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
          className="absolute rounded-full"
          style={{
            inset: '-10px',
            border: '1px dashed rgba(245,158,11,0.15)',
          }}
        />

        {/* Orbiting particles */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 0.9, 0],
              scale: [0, 1.2, 0],
              rotate: 360,
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: `calc(50% + ${Math.cos(p.angle) * p.radius}px)`,
              top: `calc(50% + ${Math.sin(p.angle) * p.radius}px)`,
              background: i % 3 === 0 ? '#f59e0b' : '#a855f7',
              boxShadow: i % 3 === 0
                ? '0 0 6px rgba(245,158,11,0.8)'
                : '0 0 6px rgba(168,85,247,0.8)',
              transformOrigin: `${-Math.cos(p.angle) * p.radius}px ${-Math.sin(p.angle) * p.radius}px`,
            }}
          />
        ))}

        {/* Inner pulsing core ring */}
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
            boxShadow: [
              '0 0 8px rgba(168,85,247,0.4), inset 0 0 4px rgba(168,85,247,0.2)',
              '0 0 20px rgba(168,85,247,0.7), inset 0 0 10px rgba(168,85,247,0.5)',
              '0 0 8px rgba(168,85,247,0.4), inset 0 0 4px rgba(168,85,247,0.2)',
            ],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute rounded-full"
          style={{
            inset: '8px',
            border: '1.5px solid rgba(168,85,247,0.6)',
          }}
        />

      </div>
    </div>
  );
});

VoiceVisualizer.displayName = 'VoiceVisualizer';
export default VoiceVisualizer;
