'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Heart, ChevronRight, Sparkles, TrendingUp, Headphones } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSongs } from '@/hooks/use-songs';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { setUserSongPreference, type Song } from '@/firebase/firestore';
import { useUser } from '@/firebase';
import { MOOD_DEFS, PRIMARY_MOODS, type MoodDefinition, isMoodMatch } from '@/app/lib/mood-definitions';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { MoodScanner } from '@/components/MoodScanner';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { FloatingNavPill } from '@/components/FloatingNavPill';


export const dynamic = 'force-dynamic';

// Mood accent colors (used for card left borders & tint)
const MOOD_COLORS: Record<string, string> = {
  happy: '#FDB813',
  sad: '#6B8EAD',
  joyfull: '#FF6B6B',
  depressed: '#7A6F8A',
};

// ============================================================
// MOOD CARD — large editorial style
// ============================================================
function MoodCard({ moodId, def, count, onClick }: { moodId: string; def: MoodDefinition; count: number; onClick: () => void }) {
  const accent = MOOD_COLORS[moodId] || '#8C867A';
  return (
    <motion.button
      whileHover={{ y: -6, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseEnter={() => document.documentElement.setAttribute('data-mood', moodId)}
      onMouseLeave={() => document.documentElement.setAttribute('data-mood', 'default')}
      className="relative overflow-hidden rounded-2xl text-left w-full bg-white border border-[rgba(26,24,20,0.06)] shadow-[0_4px_24px_rgba(26,24,20,0.06)] hover:shadow-[0_12px_40px_rgba(26,24,20,0.12)] transition-all duration-500 group"
      style={{ minHeight: 160 }}
    >
      {/* Colored top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: accent }} />

      {/* Large faded emoji background */}
      <div className="absolute top-2 right-4 text-8xl select-none leading-none opacity-[0.07] group-hover:opacity-[0.13] group-hover:scale-110 transition-all duration-700">
        {def.emoji}
      </div>

      <div className="relative z-10 p-5 flex flex-col gap-3 h-full">
        {/* Emoji + label row */}
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{def.emoji}</span>
          <span
            className="text-[10px] font-black tracking-[0.18em] uppercase px-2.5 py-0.5 rounded-full"
            style={{ background: `${accent}18`, color: accent }}
          >
            {def.title}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#1A1814] leading-tight">{def.subtitle}</h3>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-xs text-[#8C867A] font-medium">{count} {count === 1 ? 'song' : 'songs'}</span>
          <div
            className="flex items-center gap-1 text-xs font-bold opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300"
            style={{ color: accent }}
          >
            Listen <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Bottom glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl"
        style={{ boxShadow: `inset 0 -80px 60px -20px ${accent}18` }}
      />
    </motion.button>
  );
}

// ============================================================
// TRACK CARD — carousel item
// ============================================================
function TrackCard({
  track, moodId, index, isLiked, onPlay, onLike,
}: {
  track: Song; moodId: string; index: number; isLiked: boolean;
  onPlay: () => void; onLike: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      onMouseEnter={() => document.documentElement.setAttribute('data-mood', moodId)}
      onMouseLeave={() => document.documentElement.setAttribute('data-mood', 'default')}
      className="min-w-[180px] w-[180px] sm:min-w-[210px] sm:w-[210px] snap-start flex-none group"
    >
      {/* Cover art */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#F0EDE8] shadow-[0_4px_16px_rgba(26,24,20,0.08)] group-hover:shadow-[0_8px_32px_rgba(26,24,20,0.14)] transition-all duration-500">
        <Image
          src={track.cover || '/placeholder-album.png'}
          alt={track.title}
          fill
          sizes="210px"
          className="object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button
            onClick={onPlay}
            className="w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center translate-y-3 group-hover:translate-y-0 scale-90 group-hover:scale-100 transition-all duration-300"
          >
            <Play className="w-5 h-5 ml-0.5 text-[#1A1814]" fill="currentColor" />
          </button>
        </div>
        {/* Like button */}
        <button
          onClick={(e) => { e.stopPropagation(); onLike(); }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 shadow-sm"
        >
          <Heart className={cn('w-3.5 h-3.5', isLiked ? 'fill-[#FF6B6B] text-[#FF6B6B]' : 'text-[#5C5850]')} />
        </button>
      </div>
      <p className="font-semibold text-sm text-[#1A1814] truncate leading-tight">{track.title}</p>
      <p className="text-xs text-[#8C867A] truncate mt-0.5">{track.artist}</p>
    </motion.div>
  );
}

// ============================================================
// MOOD CAROUSEL SECTION
// ============================================================
function MoodCarousel({
  moodId, def, tracks, likedSongs, onPlay, onLike,
}: {
  moodId: string; def: MoodDefinition; tracks: Song[];
  likedSongs: string[];
  onPlay: (id: string, queue: Song[]) => void;
  onLike: (id: string) => void;
}) {
  const router = useRouter();
  const accent = MOOD_COLORS[moodId] || '#8C867A';

  return (
    <div className="mb-14">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: `${accent}1A` }}
          >
            {def.emoji}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1A1814]">{def.title} Vibes</h2>
            <p className="text-xs text-[#8C867A]">{tracks.length} songs</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/${moodId}`)}
          className="text-xs font-semibold text-[#5C5850] hover:text-[#1A1814] transition-colors flex items-center gap-1"
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {tracks.length === 0 ? (
        <div className="mx-4 md:mx-8 flex items-center gap-4 p-5 bg-white rounded-2xl border border-[rgba(26,24,20,0.05)] text-[#8C867A]">
          <span className="text-3xl">{def.emoji}</span>
          <div>
            <p className="font-semibold text-sm text-[#1A1814]">No {def.title.toLowerCase()} tracks yet</p>
            <p className="text-xs mt-0.5">Add songs tagged &quot;{moodId}&quot; to Firebase.</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-8 hide-scrollbar snap-x snap-mandatory">
          {tracks.slice(0, 10).map((track, i) => (
            <TrackCard
              key={track.id}
              track={track}
              moodId={moodId}
              index={i}
              isLiked={likedSongs.includes(track.id!)}
              onPlay={() => onPlay(track.id!, tracks)}
              onLike={() => onLike(track.id!)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// HOME PAGE
// ============================================================
export default function Home() {
  const router = useRouter();
  const { songs, loading: songsLoading } = useSongs();
  const { user } = useUser();
  const { preferences } = useUserPreferences(user?.uid);
  const { toast } = useToast();
  const { setPlaylist, setNowPlayingId } = useAppContext();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handlePlay = useCallback(
    (trackId: string, queue: Song[]) => {
      setPlaylist(queue);
      setNowPlayingId(trackId);
    },
    [setPlaylist, setNowPlayingId]
  );

  const handleLike = useCallback(
    async (songId: string) => {
      if (!user) {
        toast({ title: 'Sign in required', description: 'Please sign in to save songs.' });
        router.push('/login');
        return;
      }
      const isLiked = preferences?.likedSongs?.includes(songId);
      await setUserSongPreference(user.uid, songId, isLiked ? 'remove' : 'like');
      toast({
        title: isLiked ? 'Removed' : 'Saved',
        description: isLiked ? 'Removed from your library.' : 'Added to your library.',
      });
    },
    [user, preferences, toast, router]
  );

  // Sort songs by mood (case-insensitive)
  const moodPlaylists = useMemo(() => {
    const playlists: Record<string, Song[]> = {};
    PRIMARY_MOODS.forEach((moodKey) => {
      playlists[moodKey] = songs.filter(
        (s) => isMoodMatch(s.mood, moodKey)
      );
    });
    return playlists;
  }, [songs]);

  // Featured / recently added
  const recentSongs = useMemo(() => [...songs].sort((a, b) => {
    const aTime = (a as any).createdAt?.seconds ?? 0;
    const bTime = (b as any).createdAt?.seconds ?? 0;
    return bTime - aTime;
  }).slice(0, 8), [songs]);

  const likedSongs = preferences?.likedSongs || [];

  return (
    <div className="min-h-screen bg-[var(--void)] pb-40 selection:bg-[var(--mood-primary)]/20">
      <GradientBackground />
      <FloatingNavPill onScanClick={() => setIsScannerOpen(true)} />


      <main className="relative z-10 max-w-7xl mx-auto">

        {/* ── HERO ──────────────────────────────── */}
        <section className="pt-28 pb-16 px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 bg-white border border-[rgba(26,24,20,0.06)] rounded-full px-4 py-1.5 mb-6 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
              <span className="text-xs font-semibold text-[#5C5850] tracking-wide">Live • Mood-based music</span>
            </div>
            <h1 className="text-[clamp(2.8rem,7vw,5.5rem)] font-black text-[#1A1814] leading-[0.92] tracking-tight mb-5 font-display">
              Music that{' '}
              <span style={{ color: 'var(--mood-primary)', transition: 'color 800ms ease' }}>feels</span>
              <br />like you do.
            </h1>
            <p className="text-[clamp(1rem,2vw,1.2rem)] text-[#5C5850] max-w-xl leading-relaxed mb-8">
              Choose your emotion and let the right songs find you — or let AI scan your face and pick for you.
            </p>
            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#1A1814] text-white font-bold text-sm hover:bg-[#2d2a24] hover:scale-105 transition-all duration-300 shadow-[0_8px_24px_rgba(26,24,20,0.2)]"
              >
                <Headphones className="w-4 h-4" />
                Scan My Mood
              </button>
              {songs.length > 0 && (
                <button
                  onClick={() => handlePlay(songs[0].id!, songs)}
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-white border border-[rgba(26,24,20,0.1)] text-[#1A1814] font-bold text-sm hover:shadow-md hover:scale-105 transition-all duration-300"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  Play All
                </button>
              )}
            </div>
          </motion.div>
        </section>

        {/* ── MOOD CARDS GRID ───────────────────── */}
        <section className="px-4 md:px-8 mb-16">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-[#8C867A]" />
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8C867A]">Choose Your Mood</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PRIMARY_MOODS.map((moodKey, i) => (
              <motion.div
                key={moodKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
              >
                <MoodCard
                  moodId={moodKey}
                  def={MOOD_DEFS[moodKey]}
                  count={moodPlaylists[moodKey]?.length || 0}
                  onClick={() => router.push(`/${moodKey}`)}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── RECENTLY ADDED ────────────────────── */}
        {recentSongs.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center justify-between mb-5 px-4 md:px-8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FDB813]" />
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8C867A]">Recently Added</h2>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-8 hide-scrollbar snap-x snap-mandatory">
              {recentSongs.map((track, i) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  moodId={track.mood?.toLowerCase() || 'default'}
                  index={i}
                  isLiked={likedSongs.includes(track.id!)}
                  onPlay={() => handlePlay(track.id!, recentSongs)}
                  onLike={() => handleLike(track.id!)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── MOOD PLAYLISTS ────────────────────── */}
        <section className="pb-8">
          <div className="flex items-center gap-2 mb-6 px-4 md:px-8">
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8C867A]">By Emotion</h2>
          </div>

          {songsLoading ? (
            <div className="flex gap-4 px-4 md:px-8">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="min-w-[180px] w-[180px] skeleton aspect-square rounded-xl" />
              ))}
            </div>
          ) : (
            PRIMARY_MOODS.map((moodKey) => (
              <MoodCarousel
                key={moodKey}
                moodId={moodKey}
                def={MOOD_DEFS[moodKey]}
                tracks={moodPlaylists[moodKey] || []}
                likedSongs={likedSongs}
                onPlay={handlePlay}
                onLike={handleLike}
              />
            ))
          )}
        </section>

      </main>

      <MoodScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onMoodDetected={(mood) => {
          if (PRIMARY_MOODS.includes(mood)) {
            setIsScannerOpen(false);
            router.push(`/${mood}`);
          } else {
            toast({ title: 'Mood not supported', description: 'Only Happy, Sad, Joyfull, or Depressed are supported.' });
          }
        }}
      />
    </div>
  );
}
