'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, Shuffle, Heart, Music, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOOD_DEFS, PRIMARY_MOODS, isMoodMatch } from '@/app/lib/mood-definitions';
import { useSongs } from '@/hooks/use-songs';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { useUser, useFirestore } from '@/firebase';
import { setUserSongPreference, type Song } from '@/firebase/firestore';
import { useAppContext, usePlaybackState } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { FloatingNavPill } from '@/components/FloatingNavPill';

import { MoodScanner } from '@/components/MoodScanner';

export const dynamic = 'force-dynamic';

const MOOD_COLORS: Record<string, string> = {
  happy: '#FDB813',
  sad: '#6B8EAD',
  joyfull: '#FF6B6B',
  depressed: '#7A6F8A',
};

export default function MoodRoute({ params }: { params: Promise<{ mood: string }> | { mood: string } }) {
  const router = useRouter();
  const resolvedParams = typeof (params as any).then === 'function'
    ? React.use(params as Promise<{ mood: string }>)
    : params as { mood: string };
  const moodKey = resolvedParams.mood?.toLowerCase() ?? '';
  const def = MOOD_DEFS[moodKey];
  const accent = MOOD_COLORS[moodKey] || '#8C867A';

  const { songs, loading } = useSongs();
  const { user } = useUser();
  const firestore = useFirestore();
  const { preferences } = useUserPreferences(user?.uid);
  const { setPlaylist, setNowPlayingId } = useAppContext();
  const { isPlaying, handlePlayPause } = usePlaybackState();
  const currentTrack = usePlaybackState((s) => s.currentTrack);
  const { toast } = useToast();
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!def || !PRIMARY_MOODS.includes(moodKey)) {
      router.replace('/');
    }
  }, [def, moodKey, router]);

  if (!def || !PRIMARY_MOODS.includes(moodKey)) return null;

  const tracks = songs.filter((s) => isMoodMatch(s.mood, moodKey));
  const isPlayingThisMood = !!(currentTrack && tracks.some((t) => t.id === currentTrack.id));

  const playAll = () => {
    if (!tracks.length) return;
    setPlaylist(tracks);
    setNowPlayingId(tracks[0].id!);
  };

  const openTrack = (songId: string) => {
    setPlaylist(tracks);
    setNowPlayingId(songId);
  };

  const handleToggleLike = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (!user) { router.push('/login'); return; }
    const isLiked = preferences?.likedSongs?.includes(songId);
    await setUserSongPreference(firestore, user.uid, songId, !isLiked);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4] pb-40 overflow-x-hidden">
      {/* GLOBAL CSS OVERRIDE TO FORCE VISIBILITY */}
      <style jsx global>{`
        body { background-color: #F9F8F4 !important; color: #1A1814 !important; }
        .track-title { color: #1A1814 !important; }
        .track-artist { color: #5C5850 !important; }
        .song-art { border-radius: 16px !important; }
      `}</style>

      <GradientBackground mood={moodKey} />
      <FloatingNavPill onScanClick={() => setShowScanner(true)} />

      <MoodScanner 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)} 
        onMoodDetected={(m) => {
          if (PRIMARY_MOODS.includes(m)) { setShowScanner(false); router.push(`/${m}`); }
        }} 
      />

      {/* ── HERO ─────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-32 pb-12">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#8C867A] hover:text-[#1A1814] transition-colors text-sm font-bold mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Explore
        </button>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="text-6xl md:text-7xl">{def.emoji}</span>
            <div className="flex flex-col">
               <span className="text-[10px] font-black tracking-[0.2em] uppercase text-[#8C867A] mb-1">Playlist</span>
               <div className="h-1 w-12 rounded-full" style={{ backgroundColor: accent }} />
            </div>
          </div>

          <h1 className="text-[clamp(3.5rem,10vw,6rem)] font-black text-[#1A1814] leading-[0.85] tracking-tighter mb-8 font-display">
            {def.title}<span style={{ color: accent }}>.</span>
          </h1>

          <p className="text-xl md:text-2xl text-[#5C5850] max-w-2xl leading-relaxed mb-10 font-medium">
            {def.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={isPlayingThisMood ? handlePlayPause : playAll}
              disabled={!tracks.length}
              className="flex items-center gap-3 px-10 py-5 rounded-full font-black text-lg text-white transition-all shadow-[0_12px_32px_rgba(26,24,20,0.1)] hover:scale-105 active:scale-95 disabled:opacity-40"
              style={{ background: accent }}
            >
              {isPlayingThisMood && isPlaying
                ? <><Pause className="w-6 h-6" fill="currentColor" /> Pause</>
                : <><Play className="w-6 h-6 ml-1" fill="currentColor" /> Play All</>
              }
            </button>
            <span className="text-lg font-bold text-[#8C867A] px-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: accent }} />
              {tracks.length} Vibes
            </span>
          </div>
        </motion.div>
      </div>

      {/* ── TRACK LIST ───────────────────────────────── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(n => <div key={n} className="h-20 skeleton rounded-3xl" />)}
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-32 text-center bg-white/50 rounded-[40px] border border-[rgba(26,24,20,0.06)]">
             <Music className="w-16 h-16 mx-auto mb-6 text-[#8C867A] opacity-20" />
             <h3 className="text-2xl font-black text-[#1A1814] mb-2">The void is silent</h3>
             <p className="text-[#5C5850]">Add some {moodKey} tracks to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tracks.map((track, i) => {
              const active = currentTrack?.id === track.id;
              const liked = preferences?.likedSongs?.includes(track.id!);
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.5 }}
                  onClick={() => openTrack(track.id!)}
                  className={cn(
                    'group flex items-center gap-6 p-4 rounded-[32px] cursor-pointer transition-all duration-500',
                    active ? 'bg-white shadow-[0_16px_48px_rgba(26,24,20,0.12)] scale-[1.02]' : 'hover:bg-white/70'
                  )}
                >
                  {/* Number / EQ */}
                  <div className="w-10 flex items-center justify-center flex-none">
                    {active && isPlaying ? (
                      <div className="flex items-end gap-[2.5px] h-4">
                        {[1, 2, 3].map((b) => (
                          <span
                            key={b}
                            className="inline-block w-[3px] rounded-full"
                            style={{
                              background: accent,
                              animation: `equalizer ${0.3 + b * 0.1}s ease-in-out infinite`,
                              height: `${40 + b * 20}%`,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs font-black text-[#8C867A] tabular-nums group-hover:text-[#1A1814]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    )}
                  </div>

                  {/* Art */}
                  <div className="relative w-16 h-16 bg-[#E8E6E0] shadow-md flex-none song-art overflow-hidden">
                    <Image
                      src={track.cover || '/placeholder-album.png'}
                      alt={track.title}
                      fill
                      sizes="64px"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className={cn("absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", active && "opacity-100 bg-black/10")}>
                      {active && isPlaying ? <Pause className="text-white w-6 h-6" fill="currentColor" /> : <Play className="text-white w-6 h-6 ml-1" fill="currentColor" />}
                    </div>
                  </div>

                  {/* Info - NO CLIPPING, FIXED COLORS */}
                  <div className="flex-1 min-w-0">
                    <h4 className="track-title text-lg font-black truncate leading-tight group-hover:text-[var(--mood-primary)] transition-colors">
                      {track.title}
                    </h4>
                    <p className="track-artist text-sm font-bold mt-1 truncate">
                      {track.artist}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pr-4">
                    <button
                      onClick={(e) => handleToggleLike(e, track.id!)}
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300',
                        liked ? 'text-[#FF6B6B]' : 'text-[#8C867A] opacity-0 group-hover:opacity-100 hover:bg-[rgba(26,24,20,0.05)]'
                      )}
                    >
                      <Heart className={cn('w-5 h-5', liked && 'fill-[#FF6B6B]')} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
