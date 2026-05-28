'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, SkipBack, Play, Pause, SkipForward, Music,
  Shuffle, ListMusic, X, ChevronDown, Repeat, Repeat1, Volume2, VolumeX,
  Maximize2, Move
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlaybackState, useAppContext } from '@/context/AppContext';
import type { Song } from '@/firebase/firestore';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { useUser, useFirestore } from '@/firebase';
import { setUserSongPreference } from '@/firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const formatTime = (secs: number) => {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Seek Bar ─────────────────────────────────────────────
function SeekBar({ light = false }: { light?: boolean }) {
  const { progress, handleSeek } = usePlaybackState((s) => ({ progress: s.progress, handleSeek: s.handleSeek }));
  const pct = progress.duration ? (progress.currentTime / progress.duration) * 100 : 0;
  const trackRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el || !progress.duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const seek = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      handleSeek(ratio * progress.duration);
    };
    const up = () => {
      window.removeEventListener('pointermove', seek);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', seek);
    window.addEventListener('pointerup', up);
    seek(e.nativeEvent);
  };

  return (
    <div className="group/seek relative flex items-center h-4" onPointerDown={onPointerDown}>
      <div
        ref={trackRef}
        className={cn('w-full h-1 group-hover/seek:h-1.5 rounded-full transition-all duration-200 cursor-pointer',
          light ? 'bg-white/20' : 'bg-[rgba(26,24,20,0.12)]'
        )}
      >
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${pct}%`,
            background: light ? '#ffffff' : 'var(--mood-primary)',
            transition: 'background 800ms ease',
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Player ──────────────────────────────────────────
export function FloatingPlayer() {
  const { currentTrack, isPlaying } = usePlaybackState();
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { preferences } = useUserPreferences(user?.uid);
  const constraintsRef = useRef(null);

  // Mini Player Size State
  const [width, setWidth] = useState(560);
  const [isResizing, setIsResizing] = useState(false);

  const handleLike = async () => {
    if (!user || !currentTrack?.id) return;
    const isLiked = preferences?.likedSongs?.includes(currentTrack.id);
    await setUserSongPreference(firestore, user.uid, currentTrack.id, !isLiked);
  };

  if (!currentTrack) return null;

  return (
    <>
      {/* 1. MINI PLAYER (Draggable) */}
      <AnimatePresence>
        {!isExpanded && (
          <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[100]">
            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0}
              dragConstraints={constraintsRef}
              initial={{ y: 200, x: '-50%', left: '50%', bottom: 40 }}
              animate={{ y: 0, x: '-50%' }}
              exit={{ y: 200, opacity: 0 }}
              className="absolute pointer-events-auto shadow-[0_32px_80px_rgba(26,24,20,0.2)]"
              style={{ width, maxWidth: '90vw' }}
            >
              <div className="bg-white/95 backdrop-blur-3xl border border-[rgba(26,24,20,0.08)] rounded-[24px] overflow-hidden">
                {/* Drag Handle Area */}
                <div className="h-4 bg-black/5 flex items-center justify-center cursor-move group">
                  <div className="w-12 h-1 rounded-full bg-black/10 group-hover:bg-black/20 transition-colors" />
                </div>

                <div className="px-5 pt-2 pb-1">
                  <SeekBar />
                </div>

                <div className="flex items-center gap-4 px-5 py-4">
                  <div 
                    className="relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer shadow-lg flex-none"
                    onClick={() => setIsExpanded(true)}
                  >
                    <Image src={currentTrack.cover} alt="" fill className="object-cover" />
                  </div>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsExpanded(true)}>
                    <h4 className="text-sm font-black text-[#1A1814] truncate leading-tight">
                      {currentTrack.title}
                    </h4>
                    <p className="text-[11px] font-bold text-[#8C867A] truncate">
                      {currentTrack.artist}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Heart 
                      className={cn("w-5 h-5 cursor-pointer transition-colors", 
                        preferences?.likedSongs?.includes(currentTrack.id!) ? "fill-red-500 text-red-500" : "text-[#8C867A] hover:text-[#1A1814]"
                      )}
                      onClick={handleLike}
                    />
                    <PlayerControls mini />
                    <button onClick={() => setIsExpanded(true)} className="p-2 hover:bg-black/5 rounded-full">
                      <Maximize2 className="w-4 h-4 text-[#8C867A]" />
                    </button>
                  </div>
                </div>

                {/* Resize Handle */}
                <div 
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 group"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsResizing(true);
                    const startX = e.clientX;
                    const startWidth = width;
                    const move = (me: MouseEvent) => {
                      const newWidth = Math.max(320, Math.min(800, startWidth + (me.clientX - startX)));
                      setWidth(newWidth);
                    };
                    const up = () => {
                      setIsResizing(false);
                      window.removeEventListener('mousemove', move);
                      window.removeEventListener('mouseup', up);
                    };
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', up);
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-black/10 group-hover:bg-black/30" />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. FULL SCREEN PLAYER (Not Draggable, Fixed) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-[#F9F8F4] overflow-hidden"
          >
            <FullPlayer onClose={() => setIsExpanded(false)} track={currentTrack} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PlayerControls({ mini = false }: { mini?: boolean }) {
  const { isPlaying, handlePlayPause, handleNext, handlePrev } = usePlaybackState();
  
  if (mini) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={handlePrev} className="p-1 hover:bg-black/5 rounded-full">
          <SkipBack className="w-5 h-5 fill-[#1A1814] text-[#1A1814]" />
        </button>
        <button 
          onClick={handlePlayPause}
          className="w-10 h-10 rounded-full bg-[#1A1814] text-white flex items-center justify-center hover:scale-105 transition-transform"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>
        <button onClick={handleNext} className="p-1 hover:bg-black/5 rounded-full">
          <SkipForward className="w-5 h-5 fill-[#1A1814] text-[#1A1814]" />
        </button>
      </div>
    );
  }
  return null;
}

function FullPlayer({ onClose, track }: { onClose: () => void, track: Song }) {
  const { isPlaying, handlePlayPause, handleNext, handlePrev, progress } = usePlaybackState();
  const { user } = useUser();
  const firestore = useFirestore();
  const { preferences } = useUserPreferences(user?.uid);
  const isLiked = preferences?.likedSongs?.includes(track.id!);

  const toggleLike = async () => {
    if (!user) return;
    await setUserSongPreference(firestore, user.uid, track.id!, !isLiked);
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row relative">
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 z-50 p-4 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
      >
        <ChevronDown className="w-8 h-8 text-[#1A1814]" />
      </button>

      {/* Art Side */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full p-12 flex items-center justify-center relative">
        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: 'var(--mood-primary)', filter: 'blur(100px)' }} />
        <div className="relative aspect-square w-full max-w-[500px] shadow-[0_40px_120px_rgba(26,24,20,0.3)] rounded-[64px] overflow-hidden group">
          <Image src={track.cover} alt={track.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
        </div>
      </div>

      {/* Controls Side */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full p-12 md:p-24 flex flex-col justify-center">
        <div className="flex items-end justify-between mb-12">
          <div className="flex-1">
            <h2 className="text-5xl md:text-7xl font-black text-[#1A1814] tracking-tighter leading-none mb-4 line-clamp-2">
              {track.title}
            </h2>
            <p className="text-xl md:text-2xl font-bold text-[#8C867A]">
              {track.artist}
            </p>
          </div>
          <button onClick={toggleLike} className={cn("p-4 rounded-full bg-white shadow-xl transition-all hover:scale-110 flex-none ml-4", isLiked ? "text-red-500" : "text-[#8C867A]")}>
            <Heart className={cn("w-8 h-8", isLiked && "fill-current")} />
          </button>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <SeekBar light={false} />
            <div className="flex justify-between text-sm font-black text-[#8C867A] tabular-nums">
              <span>{formatTime(progress.currentTime)}</span>
              <span>{formatTime(progress.duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button className="p-4 text-[#8C867A] hover:text-[#1A1814]"><Shuffle className="w-6 h-6" /></button>
            <div className="flex items-center gap-8">
              <button onClick={handlePrev} className="p-4 text-[#1A1814] hover:scale-110 transition-transform"><SkipBack className="w-10 h-10 fill-current" /></button>
              <button 
                onClick={handlePlayPause}
                className="w-24 h-24 rounded-full bg-[#1A1814] text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-2" />}
              </button>
              <button onClick={handleNext} className="p-4 text-[#1A1814] hover:scale-110 transition-transform"><SkipForward className="w-10 h-10 fill-current" /></button>
            </div>
            <button className="p-4 text-[#8C867A] hover:text-[#1A1814]"><Repeat className="w-6 h-6" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FloatingPlayerWrapper() {
  return <FloatingPlayer />;
}
