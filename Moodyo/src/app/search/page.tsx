'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useUser } from '@/firebase';
import { searchSongs, type Song } from '@/firebase/firestore';
import { Search as SearchIcon, Play, X, Heart, Sparkles, TrendingUp, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/AppContext';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { setUserSongPreference } from '@/firebase/firestore';
import { useDebounce } from '@/hooks/use-debounce';
import { motion, AnimatePresence } from 'framer-motion';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { FloatingNavPill } from '@/components/FloatingNavPill';

import { MoodScanner } from '@/components/MoodScanner';
import { MOOD_DEFS, PRIMARY_MOODS } from '@/app/lib/mood-definitions';
import { useToast } from '@/hooks/use-toast';

export const dynamic = 'force-dynamic';

const MOOD_COLORS: Record<string, string> = {
  happy: '#FDB813',
  sad: '#6B8EAD',
  joyfull: '#FF6B6B',
  depressed: '#7A6F8A',
};

export default function SearchPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { setNowPlayingId, setPlaylist } = useAppContext();
  const { preferences } = useUserPreferences(user?.uid);
  const { toast } = useToast();
  const [showScanner, setShowScanner] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleSearch = useCallback(async (term: string) => {
    if (term.trim() === '') {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const searchResults = await searchSongs(firestore, term);
      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, [firestore]);

  useEffect(() => {
    handleSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, handleSearch]);

  const playSong = (song: Song) => {
    if (!song.id) return;
    setPlaylist(results.length > 0 ? results : [song]);
    setNowPlayingId(song.id);
    
    if (song.mood) {
      document.documentElement.setAttribute('data-mood', song.mood.toLowerCase().trim());
    }
  };

  const handleToggleLike = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (!user) return;
    const isLiked = preferences?.likedSongs?.includes(songId);
    await setUserSongPreference(user.uid, songId, isLiked ? 'remove' : 'like');
  };

  const hasQuery = searchTerm.length > 0;

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

      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-8 pt-32">
        
        {/* ── HEADER ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <SearchIcon className="w-4 h-4 text-[#8C867A]" />
            <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8C867A]">Explore the Void</h2>
          </div>
          <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-black text-[#1A1814] leading-[0.9] tracking-tight mb-8 font-display">
            Find your <span style={{ color: 'var(--mood-primary)', transition: 'color 800ms ease' }}>sound</span>.
          </h1>
          
          <div className="relative group max-w-2xl">
            <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#8C867A] group-focus-within:text-[var(--mood-primary)] transition-colors" />
            <input
              type="text"
              placeholder="Search artists, songs, or moods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[rgba(26,24,20,0.08)] shadow-[0_8px_32px_rgba(26,24,20,0.04)] rounded-2xl py-6 pl-16 pr-14 text-lg text-[#1A1814] placeholder-[#8C867A] focus:outline-none focus:ring-2 focus:ring-[var(--mood-primary)] focus:shadow-[0_12px_48px_rgba(26,24,20,0.08)] transition-all duration-300"
            />
            <AnimatePresence>
              {searchTerm && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchTerm('')}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#F5F4F0] text-[#8C867A] hover:text-[#1A1814] transition-all"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── CONTENT ──────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!hasQuery ? (
            <motion.div
              key="browse"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-[#8C867A]" />
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-[#8C867A]">Browse Moods</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {PRIMARY_MOODS.map((mood, i) => {
                  const def = MOOD_DEFS[mood];
                  const accent = MOOD_COLORS[mood];
                  return (
                    <motion.button
                      key={mood}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSearchTerm(mood)}
                      className="group relative aspect-[4/5] rounded-3xl p-6 flex flex-col items-start justify-end gap-2 bg-white border border-[rgba(26,24,20,0.06)] shadow-soft hover:shadow-medium transition-all duration-500 overflow-hidden text-left"
                    >
                      <div 
                        className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500" 
                        style={{ backgroundColor: accent }} 
                      />
                      <div 
                        className="absolute -top-4 -right-4 text-8xl opacity-[0.05] group-hover:scale-110 group-hover:rotate-6 transition-transform duration-700 select-none"
                      >
                        {def?.emoji}
                      </div>
                      
                      <span className="text-3xl mb-auto">{def?.emoji}</span>
                      <span className="text-xs font-black tracking-widest uppercase text-[#8C867A] group-hover:text-[#1A1814] transition-colors">Playlist</span>
                      <span className="text-xl font-black text-[#1A1814]">{def?.title}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : isSearching ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 pt-4"
            >
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="h-[72px] skeleton rounded-xl w-full" />
              ))}
            </motion.div>
          ) : results.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-1 pt-4"
            >
              <div className="flex items-center gap-2 mb-4 px-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--mood-primary)]" />
                <h3 className="text-sm font-bold text-[#1A1814]">{results.length} results found</h3>
              </div>
              
              {results.map((track, i) => {
                const isLiked = preferences?.likedSongs?.includes(track.id!);
                const accent = MOOD_COLORS[track.mood?.toLowerCase().trim() || ''] || '#8C867A';
                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-[rgba(26,24,20,0.04)] shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                    onClick={() => playSong(track)}
                  >
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-none shadow-sm bg-[#F0EDE8]">
                      <Image src={track.cover || track.coverUrl || '/placeholder-album.png'} alt={track.title} fill sizes="48px" className="object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-5 h-5 text-white" fill="currentColor" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-[#1A1814] truncate group-hover:text-[var(--mood-primary)] transition-colors">{track.title}</h4>
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
                      className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#F5F4F0]"
                    >
                      <Heart className={cn('w-4 h-4 transition-all', isLiked ? 'fill-[#FF6B6B] text-[#FF6B6B]' : 'text-[#8C867A] hover:text-[#1A1814]')} />
                    </button>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-white border border-[rgba(26,24,20,0.06)] shadow-soft flex items-center justify-center mb-6">
                <Music className="w-8 h-8 text-[#8C867A] opacity-40" />
              </div>
              <h3 className="text-xl font-bold text-[#1A1814] mb-2">No results found</h3>
              <p className="text-sm text-[#5C5850] max-w-xs leading-relaxed">
                We couldn&apos;t find any songs matching &quot;{searchTerm}&quot;. Try searching for a different track, artist, or mood.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
