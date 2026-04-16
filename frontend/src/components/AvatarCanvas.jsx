import React from "react";
import Avatar2D from "./Avatar2D";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Heart, Zap } from "lucide-react";

const AvatarCanvas = ({ isTyping, isSpeaking, emotion = "neutral" }) => {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, x: 50, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 50, scale: 0.9 }}
        className="w-[320px] h-[480px] rounded-[2.5rem] overflow-hidden warm-card soft-shadow-2xl border pointer-events-auto group relative"
        style={{ 
          background: "rgba(var(--color-surface-rgb), 0.7)",
          borderColor: "rgba(var(--color-primary-rgb), 0.2)",
          backdropFilter: "blur(20px)"
        }}
      >
        {/* Animated Neon Border */}
        <div className="absolute inset-0 p-[2px] rounded-[2.5rem] overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-full h-full opacity-30"
            style={{
              background: "conic-gradient(from 0deg, transparent, var(--color-primary), transparent 40%)"
            }}
          />
        </div>

        {/* Content Container */}
        <div className="relative w-full h-full flex flex-col">
          {/* Header Status Bar */}
          <div className="px-6 pt-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-soft">
                Vision Active
              </span>
            </div>
            <div className="flex gap-1.5">
              <Zap size={10} className="text-secondary" />
              <Brain size={10} className="text-primary-soft" />
            </div>
          </div>

          {/* Main Avatar Section */}
          <div className="flex-1 min-h-0 relative">
            <Avatar2D 
              emotion={emotion} 
              isSpeaking={isSpeaking} 
              isTyping={isTyping} 
            />
          </div>

          {/* Footer Info */}
          <div className="px-6 pb-6 mt-auto">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/40 uppercase font-medium">Operator Emotion</span>
                <Heart size={10} className="text-error/60" />
              </div>
              <div className="text-sm font-semibold text-white/90 capitalize flex items-center gap-2">
                {emotion}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hover Interaction Layer */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </motion.div>
    </div>
  );
};

export default AvatarCanvas;
