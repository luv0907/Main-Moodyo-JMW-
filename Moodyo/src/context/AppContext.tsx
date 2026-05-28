'use client';

import React, { ReactNode, useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { Song } from '@/firebase/firestore';

// --- State for low-frequency updates (UI, layout) ---
interface AppState {
    activePage: string;
    setActivePage: (page: string) => void;
    playlist: Song[];
    setPlaylist: (playlist: Song[]) => void;
    audioRef: React.RefObject<HTMLAudioElement>;
    volume: number;
    setVolume: (volume: number) => void;
    nowPlayingId: string | null;
    setNowPlayingId: (songId: string | null) => void; // Moved from PlaybackState
    currentTrack: Song | null;

    // New global loading state
    loadingFlags: Record<string, boolean>;
    setLoadingFlag: (key: string, value: boolean) => void;
    globalLoading: boolean;
}

export const useAppContext = create<AppState>((set, get) => ({
    activePage: 'home',
    setActivePage: (page) => set({ activePage: page }),
    playlist: [],
    setPlaylist: (playlist) => set({ playlist }),
    audioRef: React.createRef<HTMLAudioElement>(),
    volume: 0.75,
    setVolume: (volume) => {
        set({ volume });
        const audio = get().audioRef.current;
        if (audio) {
            audio.volume = volume;
        }
    },
    nowPlayingId: null,
    currentTrack: null,
    setNowPlayingId: (songId) => {
        const { playlist, audioRef } = get();
        const track = playlist.find(t => t.id === songId) || null;

        set({ nowPlayingId: songId, currentTrack: track });
        usePlaybackState.getState().setTrack(track); // Inform playback state

        const audio = audioRef.current;
        if (audio) {
            if (track) {
                if (audio.src !== track.src) {
                    audio.src = track.src;
                    audio.load();
                }
                audio.play().catch(e => console.error("Audio play error:", e));
                usePlaybackState.setState({ isPlaying: true });
            } else {
                audio.pause();
                usePlaybackState.setState({ isPlaying: false });
                audio.src = '';
            }
        }
    },

    // Global loading implementation
    loadingFlags: {},
    globalLoading: false,
    setLoadingFlag: (key: string, value: boolean) => {
        const newFlags = { ...get().loadingFlags, [key]: value };
        const anyLoading = Object.values(newFlags).some(flag => flag === true);
        set({ loadingFlags: newFlags, globalLoading: anyLoading });
    },
}));


// --- State for high-frequency updates (playback control) ---
type RepeatMode = 'off' | 'one' | 'all';

interface PlaybackState {
    isPlaying: boolean;
    progress: { currentTime: number; duration: number };
    currentTrack: Song | null; // Keep a reference here for playback logic
    repeatMode: RepeatMode;
    isShuffled: boolean;
    shuffleOrder: number[]; // pre-computed shuffle index array

    // Actions
    setTrack: (track: Song | null) => void;
    setProgress: (progress: { currentTime: number; duration: number }) => void;
    handlePlayPause: () => void;
    handleNext: () => void;
    handlePrev: () => void;
    handleSeek: (time: number) => void;
    toggleShuffle: () => void;
    cycleRepeat: () => void;
}

// Helper: Fisher-Yates shuffle
function buildShuffleOrder(length: number, currentIndex: number): number[] {
    const order = Array.from({ length }, (_, i) => i).filter(i => i !== currentIndex);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return [currentIndex, ...order]; // current track always first
}

export const usePlaybackState = create<PlaybackState>((set, get) => ({
    isPlaying: false,
    progress: { currentTime: 0, duration: 0 },
    currentTrack: null,
    repeatMode: 'off',
    isShuffled: false,
    shuffleOrder: [],

    setTrack: (track) => set({ currentTrack: track }),
    setProgress: (progress) => set({ progress }),

    handlePlayPause: () => {
        const { currentTrack } = get();
        if (currentTrack) {
            const audio = useAppContext.getState().audioRef.current;
            if (!audio) return;

            const { isPlaying } = get();
            if (!isPlaying) {
                audio.play().catch(e => console.error("Audio play error:", e));
            } else {
                audio.pause();
            }
            set({ isPlaying: !isPlaying });
        }
    },
    handleNext: () => {
        const { playlist, nowPlayingId, setNowPlayingId } = useAppContext.getState();
        if (!nowPlayingId || playlist.length === 0) return;
        const { repeatMode, isShuffled, shuffleOrder } = get();
        const currentIndex = playlist.findIndex(t => t.id === nowPlayingId);
        if (currentIndex === -1) return;

        if (repeatMode === 'one') {
            // restart same track
            const audio = useAppContext.getState().audioRef.current;
            if (audio) { audio.currentTime = 0; audio.play().catch(() => { }); }
            return;
        }

        let nextIndex: number;
        if (isShuffled && shuffleOrder.length > 0) {
            const posInShuffle = shuffleOrder.indexOf(currentIndex);
            const nextPos = (posInShuffle + 1) % shuffleOrder.length;
            nextIndex = shuffleOrder[nextPos];
        } else {
            nextIndex = (currentIndex + 1) % playlist.length;
        }

        if (nextIndex === 0 && repeatMode === 'off' && !isShuffled) return; // stop at end
        setNowPlayingId(playlist[nextIndex].id!);
    },
    handlePrev: () => {
        const { playlist, nowPlayingId, setNowPlayingId } = useAppContext.getState();
        if (!nowPlayingId || playlist.length === 0) return;
        const { isShuffled, shuffleOrder } = get();
        const currentIndex = playlist.findIndex(t => t.id === nowPlayingId);
        if (currentIndex === -1) return;

        let prevIndex: number;
        if (isShuffled && shuffleOrder.length > 0) {
            const posInShuffle = shuffleOrder.indexOf(currentIndex);
            const prevPos = (posInShuffle - 1 + shuffleOrder.length) % shuffleOrder.length;
            prevIndex = shuffleOrder[prevPos];
        } else {
            prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        }
        setNowPlayingId(playlist[prevIndex].id!);
    },
    handleSeek: (time: number) => {
        const { audioRef } = useAppContext.getState();
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    },
    toggleShuffle: () => {
        const { isShuffled } = get();
        if (!isShuffled) {
            const { playlist, nowPlayingId } = useAppContext.getState();
            const currentIndex = playlist.findIndex(t => t.id === nowPlayingId);
            const order = buildShuffleOrder(playlist.length, currentIndex === -1 ? 0 : currentIndex);
            set({ isShuffled: true, shuffleOrder: order });
        } else {
            set({ isShuffled: false, shuffleOrder: [] });
        }
    },
    cycleRepeat: () => {
        const { repeatMode } = get();
        const next: RepeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
        set({ repeatMode: next });
    },
}));

export const AudioPlayer = () => {
    const audioRef = useAppContext((state) => state.audioRef);
    const { setProgress, handleNext } = usePlaybackState.getState();
    const setIsPlaying = (playing: boolean) => usePlaybackState.setState({ isPlaying: playing });

    return (
        <audio
            ref={audioRef}
            onEnded={handleNext}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={() => {
                const audio = audioRef.current;
                if (audio) setProgress({ currentTime: audio.currentTime, duration: audio.duration || 0 });
            }}
            onLoadedData={() => {
                const audio = audioRef.current;
                if (audio) setProgress({ currentTime: audio.currentTime, duration: audio.duration || 0 });
            }}
            crossOrigin="anonymous"
        />
    )
}


// --- Provider Component ---
export function AppProvider({ children }: { children: ReactNode }) {
    const audioRef = useAppContext.getState().audioRef;

    // This effect runs once to set up the initial volume
    useEffect(() => {
        const { volume } = useAppContext.getState();
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [audioRef]);

    return <>{children}</>;
}
