
'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Pause, Shuffle, Heart, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { MoodDefinition } from '@/app/lib/mood-definitions';
import { usePlaybackState, useAppContext } from '@/context/AppContext';
import type { Song } from '@/firebase/firestore';
import { useScrollReveal } from '@/hooks/useScrollReveal';

// ============================================================
// MOOD PAGE HERO
// ============================================================
interface MoodHeroProps {
  mood: string;
  definition: MoodDefinition;
  tracks: Song[];
  openPlayer: (songId: string) => void;
}

function MoodPageHero({ mood, definition, tracks, openPlayer }: MoodHeroProps) {
  const { isPlaying, handlePlayPause } = usePlaybackState();
  const { currentTrack } = useAppContext();
  const router = useRouter();

  const isPlayingThisMood = currentTrack && tracks?.some(t => t.id === currentTrack.id);

  const handleShuffle = () => {
    if (!tracks || tracks.length === 0) return;
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    openPlayer(randomTrack.id!);
  };

  const handlePlayPauseHero = () => {
    if (isPlayingThisMood) {
      handlePlayPause();
    } else if (tracks?.[0]) {
      openPlayer(tracks[0].id!);
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ minHeight: '45svh', display: 'flex', alignItems: 'flex-end' }}
    >
      {/* Mood aura background */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 100% 80% at 70% -10%, rgba(var(--mood-primary-rgb), 0.20), transparent 70%)`,
          transition: 'background 1200ms ease',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--void)] to-transparent pointer-events-none" />

      <div className="relative z-10 w-full section-px pb-12 pt-24">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="glass-light btn-ghost-pill flex items-center gap-2 px-4 py-2 text-micro mb-8 focus-mood"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        {/* Mood content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col gap-4"
        >
          {/* Emoji */}
          <motion.span
            className="text-6xl md:text-8xl"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {definition.emoji}
          </motion.span>

          {/* Mood name */}
          <div>
            <span className="text-label-caps mb-2 block" style={{ color: 'rgba(var(--mood-primary-rgb), 0.7)', transition: 'color 800ms ease' }}>
              Mood Universe
            </span>
            <h1 className="text-hero-lg text-[#1A1814] mb-3">
              {definition.title}
            </h1>
            <p className="text-body max-w-md" style={{ color: 'rgba(26,24,20,0.65)' }}>
              {definition.subtitle}
            </p>
          </div>

          {/* Track count + actions */}
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {tracks?.length > 0 && (
              <span className="text-label-caps" style={{ color: 'var(--mood-primary)', transition: 'color 800ms ease' }}>
                {tracks.length} TRACKS
              </span>
            )}
            <button
              onClick={handlePlayPauseHero}
              className="btn-mood flex items-center gap-2 px-5 py-2.5 text-sm font-bold focus-mood"
            >
              {isPlayingThisMood && isPlaying ? (
                <><Pause className="w-4 h-4" /> Pause</>
              ) : (
                <><Play className="w-4 h-4 ml-0.5" fill="currentColor" /> Play All</>
              )}
            </button>
            <button
              onClick={handleShuffle}
              className="btn-ghost-pill flex items-center gap-2 px-5 py-2.5 text-sm focus-mood"
            >
              <Shuffle className="w-4 h-4" />
              Shuffle
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================
// TRACK LIST
// ============================================================
interface TrackListProps {
  tracks: Song[];
  openPlayer: (songId: string) => void;
  handleLike: (e: React.MouseEvent, songId: string) => void;
  isLiked: (songId: string) => boolean;
}

function MoodTrackList({ tracks, openPlayer, handleLike, isLiked }: TrackListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { currentTrack } = useAppContext();
  const { isPlaying } = usePlaybackState();

  useScrollReveal(listRef as React.RefObject<HTMLElement>, {
    selector: '.track-row',
    fromVars: { opacity: 0, y: 20, duration: 0.4, ease: 'power2.out' },
    stagger: 0.05,
    start: 'top 88%',
  });

  if (!tracks || tracks.length === 0) {
    return (
      <div className="section-px text-center py-24">
        <div className="text-6xl mb-6">🎵</div>
        <h3 className="text-section-title text-[#1A1814] mb-3">No tracks here yet</h3>
        <p className="text-body" style={{ color: 'rgba(26,24,20,0.45)' }}>
          Be the first to add music to this mood.
        </p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="section-px py-8">
      <div className="flex flex-col gap-2">
        {tracks.map((track, i) => {
          const isActiveTrack = currentTrack?.id === track.id;
          return (
            <div
              key={track.id || i}
              role="button"
              tabIndex={0}
              onClick={() => openPlayer(track.id!)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayer(track.id!); } }}
              className={cn(
                'track-row w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 text-left group cursor-pointer focus-mood',
                isActiveTrack
                  ? 'glass-mood'
                  : 'hover:glass-light'
              )}
              style={isActiveTrack ? {
                borderLeft: '3px solid var(--mood-primary)',
                transition: 'border-color 800ms ease',
              } : {
                borderLeft: '3px solid transparent',
              }}
            >
              {/* Track number / equalizer */}
              <div className="w-6 flex items-center justify-center flex-none">
                {isActiveTrack && isPlaying ? (
                  <div className="flex items-end gap-[2px] h-4">
                    <span className="eq-bar" style={{ height: '60%' }} />
                    <span className="eq-bar" style={{ height: '100%' }} />
                    <span className="eq-bar" style={{ height: '40%' }} />
                  </div>
                ) : (
                  <span
                    className="text-micro font-mono"
                    style={{ color: isActiveTrack ? 'var(--mood-primary)' : 'rgba(26,24,20,0.3)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
              </div>

              {/* Album art */}
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-none relative">
                <Image
                  src={track.cover || '/placeholder-album.png'}
                  alt={track.title}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>

              {/* Title + Artist */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-card-title font-semibold line-clamp-1 transition-colors duration-300"
                  style={{ color: isActiveTrack ? 'var(--mood-primary)' : '#1A1814' }}
                >
                  {track.title}
                </p>
                <p className="text-micro line-clamp-1 mt-0.5" style={{ color: 'rgba(26,24,20,0.5)' }}>
                  {track.artist}
                </p>
              </div>

              {/* Like button */}
              <button
                onClick={(e) => handleLike(e, track.id!)}
                className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 focus-mood"
                aria-label="Like track"
              >
                <Heart
                  className={cn('w-4 h-4', isLiked(track.id!) ? 'fill-[#FF6B6B] text-[#FF6B6B]' : 'text-[#5C5850]/40 hover:text-[#1A1814]')}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MOOD PAGE WRAPPER
// ============================================================
type MoodPageProps = {
  mood: string;
  definition?: MoodDefinition;
  tracks: Song[];
  handleLike: (e: React.MouseEvent, songId: string) => void;
  isLiked: (songId: string) => boolean;
  openPlayer: (songId: string) => void;
};

export function MoodPage({
  mood,
  definition,
  tracks,
  handleLike,
  isLiked,
  openPlayer,
}: MoodPageProps) {
  const { currentTrack } = usePlaybackState();

  if (!definition) return null;

  return (
    <motion.div
      key={mood}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen pb-40"
    >
      <MoodPageHero
        mood={mood}
        definition={definition}
        tracks={tracks}
        openPlayer={openPlayer}
      />
      <MoodTrackList
        tracks={tracks}
        openPlayer={openPlayer}
        handleLike={handleLike}
        isLiked={isLiked}
      />
    </motion.div>
  );
}
