
'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { SkipBack, SkipForward, Play, Pause, Heart, Volume1, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MoodDefinition } from '@/app/lib/mood-definitions';
import { useAppContext, usePlaybackState } from '@/context/AppContext';
import { Slider } from './ui/slider';
import type { Song } from '@/firebase/firestore';

type MoodHeroProps = {
    definition: MoodDefinition;
    tracks: Song[];
    mood: string;
    handleLike: (e: React.MouseEvent, songId: string) => void;
    isLiked: (songId: string) => boolean;
    openPlayer: (songId: string, mood: string) => void;
};

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function MoodHero({
    definition,
    tracks,
    mood,
    handleLike,
    isLiked,
    openPlayer
}: MoodHeroProps) {
    const { setVolume, volume, currentTrack } = useAppContext(); // Get currentTrack from low-frequency state
    const {
        isPlaying,
        progress,
        handlePlayPause,
        handleNext,
        handlePrev,
        handleSeek
    } = usePlaybackState();

    const [isVolumeOpen, setIsVolumeOpen] = React.useState(false);

    // Determine if the currently playing track belongs to the current mood's playlist
    const isPlayingThisMood = currentTrack && tracks && tracks.some(t => t.id === currentTrack.id);

    // The track to display: if a track from this mood is playing, show it. Otherwise, show the first track of the mood.
    const displayTrack = isPlayingThisMood ? currentTrack : tracks?.[0];

    const heroVariants = {
        hidden: { opacity: 0, x: -50 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } }
    };

    const onProgressBarChange = (value: number[]) => {
        if (!progress.duration) return;
        handleSeek(value[0]);
    };

    const handleHeroPlayPause = () => {
        if (isPlayingThisMood) {
            handlePlayPause();
        } else if (displayTrack) {
            openPlayer(displayTrack.id!, mood);
        }
    };

    return (
        <motion.div className="mood-hero" variants={heroVariants}>
            <div>
                <h2>{definition.title}</h2>
                <p>{definition.subtitle}</p>
            </div>
            {displayTrack ? (
                <div
                    className={cn("now-playing-card", { "is-playing": isPlaying && isPlayingThisMood })}
                >
                    <div className="card__content">
                        <div className="card__badge">NOW PLAYING</div>
                        <div className="card__image">
                            <Image src={displayTrack.cover} alt={displayTrack.title} layout="fill" objectFit="cover" unoptimized={displayTrack.cover.startsWith('data:')} />
                        </div>
                        <div className="card__text">
                            <h3 className="card__title">{displayTrack.title}</h3>
                            <p className="card__description">{displayTrack.artist}</p>
                        </div>
                        <div className="card__footer">
                            <Slider
                                value={[progress.currentTime]}
                                max={progress.duration || 100}
                                onValueChange={onProgressBarChange}
                            />
                            <div className="time-display">
                                <span>{formatTime(progress.currentTime)}</span>
                                <span>{formatTime(progress.duration)}</span>
                            </div>
                            <div className="player-controls">
                                <div className="main-controls">
                                    <button onClick={handlePrev} className="control-btn"><SkipBack size={20} /></button>
                                    <button onClick={handleHeroPlayPause} className="play-main-btn">
                                        {(isPlaying && isPlayingThisMood) ? <Pause size={24} /> : <Play size={24} />}
                                    </button>
                                    <button onClick={handleNext} className="control-btn"><SkipForward size={20} /></button>
                                </div>
                                <div className="secondary-controls">
                                    <button onClick={(e) => handleLike(e, displayTrack.id!)} className={cn('like-btn control-btn', { 'liked': isLiked(displayTrack.id!) })}>
                                        <Heart size={20} />
                                    </button>
                                    <div className="volume-control">
                                        <button onClick={() => setIsVolumeOpen(!isVolumeOpen)} className="volume-btn control-btn">
                                            {volume > 0.5 ? <Volume2 size={20} /> : <Volume1 size={20} />}
                                        </button>
                                        {isVolumeOpen && (
                                            <Slider
                                                defaultValue={[volume]}
                                                max={1}
                                                step={0.01}
                                                onValueChange={(value) => setVolume(value[0])}
                                                className="volume-slider"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : <div />}
        </motion.div>
    );
}
