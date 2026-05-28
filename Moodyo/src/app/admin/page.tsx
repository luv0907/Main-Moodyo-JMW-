'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { addSong, updateSong, deleteSong, type Song } from '@/firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { useSongs } from '@/hooks/use-songs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader, Trash2, Pencil, ArrowLeft, Plus, Music, 
  Image as ImageIcon, Link as LinkIcon, Sparkles, Search, Filter 
} from 'lucide-react';
import { MOOD_DEFS, PRIMARY_MOODS, isMoodMatch } from '../lib/mood-definitions';
import { useAppContext } from '@/context/AppContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Image from 'next/image';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const MOOD_COLORS: Record<string, string> = {
  happy: '#FDB813',
  sad: '#6B8EAD',
  joyfull: '#FF6B6B',
  depressed: '#7A6F8A',
};

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { setLoadingFlag, globalLoading } = useAppContext();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { songs, loading: songsLoading } = useSongs();

  // State
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [src, setSrc] = useState('');
  const [cover, setCover] = useState('');
  const [mood, setMood] = useState('happy');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | string>('all');

  // Sync Loading
  useEffect(() => {
    setLoadingFlag('user', isUserLoading);
    setLoadingFlag('songs', songsLoading);
  }, [isUserLoading, songsLoading, setLoadingFlag]);

  // Auth Protection
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const resetForm = useCallback(() => {
    setTitle('');
    setArtist('');
    setSrc('');
    setCover('');
    setMood('happy');
    setEditMode(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !artist || !src || !cover || !mood) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all fields.' });
      return;
    }
    setIsSubmitting(true);

    const songData: Omit<Song, 'id'> = { 
      title, 
      artist, 
      src, 
      cover, 
      mood: mood.toLowerCase(), 
      emotions: [mood.toLowerCase()] 
    };

    try {
      if (editMode) {
        await updateSong(firestore, editMode, songData);
        toast({ title: 'Song Updated!', description: `${title} by ${artist} has been updated.` });
      } else {
        await addSong(firestore, songData);
        toast({ title: 'Song Added!', description: `${title} by ${artist} has been added.` });
      }
      resetForm();
    } catch (error) {
      if (!(error as any).name?.includes('FirestorePermissionError')) {
        toast({ variant: 'destructive', title: 'Error', description: (error as any).message || "Could not save song." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (song: Song) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditMode(song.id!);
    setTitle(song.title);
    setArtist(song.artist);
    setSrc(song.src);
    setCover(song.cover);
    setMood(song.mood);
  };

  const handleDelete = async (songId: string) => {
    try {
      await deleteSong(firestore, songId);
      toast({ title: 'Song Deleted', description: 'Removed from database.' });
    } catch (error) {
      if (!(error as any).name?.includes('FirestorePermissionError')) {
        toast({ variant: 'destructive', title: 'Error', description: "Could not delete song." });
      }
    }
  };

  const filteredSongs = useMemo(() => {
    return songs.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           s.artist.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMood = activeTab === 'all' || isMoodMatch(s.mood, activeTab);
      return matchesSearch && matchesMood;
    });
  }, [songs, searchQuery, activeTab]);

  const moodCounts = useMemo(() => {
    const counts: Record<string, number> = { all: songs.length };
    PRIMARY_MOODS.forEach(m => {
      counts[m] = songs.filter(s => isMoodMatch(s.mood, m)).length;
    });
    return counts;
  }, [songs]);

  if (globalLoading) return null;

  return (
    <div className="min-h-screen bg-[#F9F8F4] text-[#1A1814] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F9F8F4]/80 backdrop-blur-xl border-b border-[rgba(26,24,20,0.06)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#1A1814] flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">MoodyO Studio</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8C867A]">Curation Engine v2.0</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => router.push('/')}
            className="rounded-full font-bold text-xs hover:bg-black/5"
          >
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Exit to App
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* ── LEFT: FORM ──────────────────────────────── */}
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-white rounded-[40px] p-8 shadow-[0_24px_64px_rgba(26,24,20,0.04)] border border-[rgba(26,24,20,0.06)]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black tracking-tighter">
                  {editMode ? 'Edit Master' : 'Add New Track'}
                </h2>
                {editMode && (
                  <Button variant="ghost" onClick={resetForm} className="text-[#8C867A] hover:text-[#1A1814] font-bold text-xs">
                    Clear Editor
                  </Button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#8C867A] ml-1">Title</label>
                    <div className="relative">
                      <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C867A]" />
                      <Input
                        placeholder="Song Name"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="pl-12 h-14 rounded-2xl border-[rgba(26,24,20,0.1)] bg-[#F9F8F4]/50 focus:bg-white transition-all font-medium"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#8C867A] ml-1">Artist</label>
                    <div className="relative">
                      <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C867A]" />
                      <Input
                        placeholder="Artist or Collective"
                        value={artist}
                        onChange={(e) => setArtist(e.target.value)}
                        className="pl-12 h-14 rounded-2xl border-[rgba(26,24,20,0.1)] bg-[#F9F8F4]/50 focus:bg-white transition-all font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8C867A] ml-1">Audio Source</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C867A]" />
                    <Input
                      placeholder="URL or Path (/audio/filename.mp3)"
                      value={src}
                      onChange={(e) => setSrc(e.target.value)}
                      className="pl-12 h-14 rounded-2xl border-[rgba(26,24,20,0.1)] bg-[#F9F8F4]/50 focus:bg-white transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8C867A] ml-1">Cover Art URL</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C867A]" />
                    <Input
                      placeholder="Image URL or Path (/images/cover.jpg)"
                      value={cover}
                      onChange={(e) => setCover(e.target.value)}
                      className="pl-12 h-14 rounded-2xl border-[rgba(26,24,20,0.1)] bg-[#F9F8F4]/50 focus:bg-white transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8C867A] ml-1">Primary Mood</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PRIMARY_MOODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMood(m)}
                        className={cn(
                          "h-14 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 group",
                          mood === m 
                            ? "bg-[#1A1814] text-white border-[#1A1814] shadow-lg shadow-black/10" 
                            : "bg-[#F9F8F4] border-transparent hover:border-[rgba(26,24,20,0.1)] text-[#5C5850]"
                        )}
                      >
                        <span className="text-lg group-hover:scale-125 transition-transform duration-300">{MOOD_DEFS[m].emoji}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full h-16 rounded-2xl bg-[#1A1814] hover:bg-black text-white font-black text-lg transition-all shadow-xl hover:shadow-2xl active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader className="animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {editMode ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      {editMode ? 'Commit Changes' : 'Launch Track'}
                    </span>
                  )}
                </Button>
              </form>
            </section>
          </div>

          {/* ── RIGHT: PREVIEW ──────────────────────────── */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8C867A] ml-4">Live Preview</h3>
              
              <div className="relative aspect-square w-full rounded-[48px] overflow-hidden bg-white shadow-2xl border border-[rgba(26,24,20,0.06)] group p-8 flex flex-col items-center justify-center text-center">
                {/* Mood Aura Background */}
                <div 
                  className="absolute inset-0 opacity-20 transition-colors duration-1000"
                  style={{ background: `radial-gradient(circle at center, ${MOOD_COLORS[mood]}, transparent 70%)` }}
                />
                
                <div className="relative z-10 w-full flex flex-col items-center">
                  <div className="relative w-48 h-48 rounded-[32px] overflow-hidden mb-8 shadow-2xl bg-[#F0EDE8]">
                    {cover ? (
                      <Image src={cover} alt="Preview" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#8C867A]">
                        <ImageIcon className="w-12 h-12 opacity-20" />
                      </div>
                    )}
                  </div>
                  
                  <h4 className="text-3xl font-black text-[#1A1814] mb-2 px-6 line-clamp-1">
                    {title || 'Track Title'}
                  </h4>
                  <p className="text-lg font-bold text-[#5C5850] opacity-70 mb-6">
                    {artist || 'The Artist'}
                  </p>
                  
                  <div 
                    className="px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest text-white shadow-lg"
                    style={{ background: MOOD_COLORS[mood] }}
                  >
                    {mood} Vibes
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-4 flex gap-3 text-amber-800/80">
                <Sparkles className="w-5 h-5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  <strong>Pro Tip:</strong> Use high-resolution covers (1000x1000px) for the best editorial feel in the main app.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── DATABASE TABLE ────────────────────────────── */}
        <section className="mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-2">Master Archive</h2>
              <p className="text-[#8C867A] font-medium">Manage and monitor the entire mood ecosystem</p>
            </div>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C867A]" />
              <Input
                placeholder="Search archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-full border-[rgba(26,24,20,0.1)] bg-white shadow-sm"
              />
            </div>
          </div>

          {/* Mood Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 bg-white/50 p-2 rounded-[32px] border border-[rgba(26,24,20,0.06)] w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-3",
                activeTab === 'all' 
                  ? "bg-[#1A1814] text-white shadow-lg" 
                  : "text-[#5C5850] hover:bg-black/5"
              )}
            >
              All Tracks
              <span className={cn("px-2 py-0.5 rounded-full text-[9px]", activeTab === 'all' ? "bg-white/20" : "bg-black/5")}>
                {moodCounts.all}
              </span>
            </button>
            {PRIMARY_MOODS.map(m => (
              <button
                key={m}
                onClick={() => setActiveTab(m)}
                className={cn(
                  "px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-3",
                  activeTab === m 
                    ? "text-white shadow-lg" 
                    : "text-[#5C5850] hover:bg-black/5"
                )}
                style={activeTab === m ? { backgroundColor: MOOD_COLORS[m] } : {}}
              >
                {m}
                <span className={cn("px-2 py-0.5 rounded-full text-[9px]", activeTab === m ? "bg-black/20" : "bg-black/5")}>
                  {moodCounts[m]}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[40px] overflow-hidden shadow-[0_24px_64px_rgba(26,24,20,0.04)] border border-[rgba(26,24,20,0.06)]">
            <Table>
              <TableHeader className="bg-[#F9F8F4]/50">
                <TableRow className="border-b-[rgba(26,24,20,0.06)] hover:bg-transparent">
                  <TableHead className="w-[100px] pl-8 py-6 text-[10px] font-black uppercase tracking-widest text-[#8C867A]">Art</TableHead>
                  <TableHead className="py-6 text-[10px] font-black uppercase tracking-widest text-[#8C867A]">Identity</TableHead>
                  <TableHead className="py-6 text-[10px] font-black uppercase tracking-widest text-[#8C867A]">Aura</TableHead>
                  <TableHead className="py-6 text-right pr-8 text-[10px] font-black uppercase tracking-widest text-[#8C867A]">Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode='popLayout'>
                  {filteredSongs.map((song) => (
                    <motion.tr
                      key={song.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group border-b-[rgba(26,24,20,0.06)] last:border-0 hover:bg-[#F9F8F4]/30 transition-colors"
                    >
                      <TableCell className="pl-8 py-4">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-500">
                          <Image src={song.cover} alt="" fill className="object-cover" />
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="font-black text-[#1A1814]">{song.title}</div>
                        <div className="text-xs font-bold text-[#8C867A]">{song.artist}</div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9F8F4] border border-[rgba(26,24,20,0.06)]">
                          <span className="text-xs">{MOOD_DEFS[song.mood as keyof typeof MOOD_DEFS]?.emoji || '🎵'}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest">{song.mood}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-right pr-8">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEdit(song)}
                            className="rounded-full hover:bg-white shadow-sm hover:shadow-md transition-all"
                          >
                            <Pencil className="h-4 w-4 text-[#1A1814]" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full hover:bg-red-50 text-[#8C867A] hover:text-red-500 shadow-sm hover:shadow-md transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[32px] border-[rgba(26,24,20,0.1)] p-8">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-black tracking-tighter">Terminate Track?</AlertDialogTitle>
                                <AlertDialogDescription className="text-base font-medium text-[#5C5850]">
                                  Are you sure you want to remove <span className="text-[#1A1814] font-black">"{song.title}"</span>? This will purge it from all mood ecosystems immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-6 gap-3">
                                <AlertDialogCancel className="rounded-full font-bold border-[rgba(26,24,20,0.1)]">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(song.id!)}
                                  className="rounded-full font-black bg-red-500 hover:bg-red-600 text-white"
                                >
                                  Confirm Purge
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredSongs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-[#8C867A]">
                        <Search className="w-10 h-10 opacity-10" />
                        <p className="font-bold text-sm">No tracks match your query.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </div>
  );
}
