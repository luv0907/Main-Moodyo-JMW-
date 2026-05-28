'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser, useFirestore } from '@/firebase';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { useSongs } from '@/hooks/use-songs';
import { Play, Heart, Library as LibraryIcon, Music, Sparkles, ChevronRight, Pause } from 'lucide-react';
import { useAppContext, usePlaybackState } from '@/context/AppContext';
import { setUserSongPreference } from '@/firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { FloatingNavPill } from '@/components/FloatingNavPill';

import { MoodScanner } from '@/components/MoodScanner';
import { cn } from '@/lib/utils';
import { PRIMARY_MOODS } from '@/app/lib/mood-definitions';

export const dynamic = 'force-dynamic';

const MOOD_COLORS: Record<string, string> = {
  happy: '#FDB813',
  sad: '#6B8EAD',
  joyfull: '#FF6B6B',
  depressed: '#7A6F8A',
};

export default function LibraryPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { preferences, loading: prefsLoading } = useUserPreferences(user?.uid);
  const { songs, loading: songsLoading } = useSongs();
  const { setNowPlayingId, setPlaylist } = useAppContext();
  const { isPlaying, handlePlayPause } = usePlaybackState();
  const currentTrack = usePlaybackState((s) => s.currentTrack);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const likedTracks = songs.filter(song => preferences?.likedSongs?.includes(song.id!));
  const isLoading = isUserLoading || prefsLoading || songsLoading;
  const isPlayingThisPlaylist = !!(currentTrack && likedTracks.some(t => t.id === currentTrack.id));

  const playSong = (songId: string) => {
    setPlaylist(likedTracks);
    setNowPlayingId(songId);
  };

  const playAll = () => {
    if (!likedTracks.length) return;
    setPlaylist(likedTracks);
    setNowPlayingId(likedTracks[0].id!);
  };

  const handleToggleLike = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (!user) return;
    await setUserSongPreference(firestore, user.uid, songId, false);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--void)] pb-40">
      <GradientBackground />
      <FloatingNavPill onScanClick={() => setShowScanner(true)} />

      <MoodScanner 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)} 
        onMoodDetected={(mood) => {
          if (PRIMARY_MOODS.includes(mood)) {
            setShowScanner(false);
            router.push(`/${mood}`);
          }
        }} 
      />

      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-8 pt-32 pb-20">
        
        {/* ── HERO ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14"
        >
          <div className="flex items-center gap-2 mb-4">
            <LibraryIcon className="w-4 h-4 text-[#8C867A]" />
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8C867A]">Your Collection</h2>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-8">
            {/* Playlist Cover Large */}
            <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-3xl overflow-hidden bg-white shadow-[0_20px_60px_rgba(26,24,20,0.12)] border border-[rgba(26,24,20,0.06)] flex-none group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] to-[#FF8E8E] opacity-90 group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Heart className="w-20 h-20 text-white drop-shadow-lg fill-white" />
              </div>
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button 
                  onClick={playAll}
                  disabled={likedTracks.length === 0}
                  className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 disabled:opacity-50"
                >
                  <Play className="w-7 h-7 ml-1 text-[#FF6B6B]" fill="currentColor" />
                </button>
              </div>
            </div>

            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md bg-[#FF6B6B]/10 text-[#FF6B6B]">Private</span>
                <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md bg-[#F5F4F0] text-[#8C867A]">User Playlist</span>
              </div>
              
              <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-black text-[#1A1814] leading-[0.9] tracking-tight mb-4 font-display">
                Liked <span className="text-[#FF6B6B]">Songs</span>.
              </h1>
              
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-[#5C5850] font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FDB813]" />
                  {likedTracks.length} tracks saved to your library
                </p>
                
                <button
                  onClick={isPlayingThisPlaylist ? handlePlayPause : playAll}
                  disabled={likedTracks.length === 0}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-full font-bold text-sm text-white bg-[#1A1814] hover:bg-[#2d2a24] hover:scale-105 hover:shadow-lg active:scale-95 transition-all duration-300 disabled:opacity-40"
                >
                  {isPlayingThisPlaylist && isPlaying
                    ? <><Pause className="w-4 h-4" fill="currentColor" /> Pause</>
                    : <><Play className="w-4 h-4 ml-0.5" fill="currentColor" /> Play All</>
                  }
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── LIST CONTENT ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="h-[72px] skeleton rounded-xl w-full" />
              ))}
            </motion.div>
          ) : likedTracks.length > 0 ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-1"
            >
              {likedTracks.map((track, i) => {
                const active = currentTrack?.id === track.id;
                const accent = MOOD_COLORS[track.mood?.toLowerCase().trim() || ''] || '#FF6B6B';
                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => playSong(track.id!)}
                    className={cn(
                      'group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300',
                      active ? 'bg-white shadow-[0_4px_20px_rgba(26,24,20,0.08)]' : 'hover:bg-white/70'
                    )}
                    style={active ? { borderLeft: `3px solid ${accent}` } : { borderLeft: '3px solid transparent' }}
                  >
                    <div className="w-7 flex items-center justify-center flex-none">
                      <span className="text-xs font-mono font-bold text-[#8C867A]">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-none shadow-sm bg-[#F0EDE8]">
                      <Image src={track.cover || track.coverUrl || '/placeholder-album.png'} alt={track.title} fill sizes="48px" className="object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-5 h-5 text-white" fill="currentColor" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={cn("font-bold text-sm truncate leading-tight", active ? "text-[#1A1814]" : "text-[#1A1814]")}>{track.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#5C5850] truncate">{track.artist}</p>
                        {track.mood && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#F5F4F0] text-[#8C867A]" style={{ color: accent }}>
                            {track.mood}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleToggleLike(e, track.id!)}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-[#F5F4F0]"
                      aria-label="Remove from Liked Songs"
                    >
                      <Heart className="w-4 h-4 fill-[#FF6B6B] text-[#FF6B6B]" />
                    </button>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[40px] border border-[rgba(26,24,20,0.06)] shadow-soft"
            >
              <div className="w-24 h-24 rounded-3xl bg-[#F5F4F0] flex items-center justify-center mb-8">
                <LibraryIcon className="w-10 h-10 text-[#8C867A] opacity-50" />
              </div>
              <h3 className="text-2xl font-black text-[#1A1814] mb-3 font-display">Your library is empty</h3>
              <p className="text-sm text-[#5C5850] max-w-sm mx-auto mb-10 leading-relaxed px-8">
                Every track you heart will be kept here safely. Ready to discover some music you&apos;ll love?
              </p>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-10 py-4 bg-[#1A1814] text-white rounded-full font-bold hover:scale-105 hover:shadow-xl active:scale-95 transition-all shadow-lg"
              >
                Discover New Vibes
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
