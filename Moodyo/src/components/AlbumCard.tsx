'use client';

import { motion } from 'framer-motion';
import { Play, Heart } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import type { Song } from '@/firebase/firestore';

interface AlbumCardProps {
    song: Song;
    isLiked?: boolean;
    onPlay: () => void;
    onLike?: (e: React.MouseEvent) => void;
}

export function AlbumCard({ song, isLiked = false, onPlay, onLike }: AlbumCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <motion.div
            className="album-card group relative cursor-pointer"
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={onPlay}
        >
            <div className="relative overflow-hidden rounded-xl">
                {/* Cover Art */}
                <div className="aspect-square relative album-card-image">
                    <Image
                        src={song.cover || '/placeholder-album.png'}
                        alt={song.title}
                        fill
                        className="object-cover"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src !== '/placeholder-album.png') {
                                target.src = '/placeholder-album.png';
                            }
                        }}
                    />
                    <div className="absolute inset-0 shadow-inner-lg" />
                </div>

                {/* Play Button Overlay */}
                <motion.button
                    className="play-button-overlay"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay();
                    }}
                    aria-label="Play"
                >
                    <Play size={20} fill="white" className="text-white ml-0.5" />
                </motion.button>
            </div>

            {/* Song Info */}
            <div className="mt-4 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate text-white">{song.title}</h3>
                    <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                </div>

                {/* Like Button */}
                {onLike && (
                    <motion.button
                        className={`flex-shrink-0 transition-colors ${isLiked ? 'text-[var(--mood-primary)]' : 'text-gray-400 hover:text-white'}`}
                        whileTap={{ scale: 0.8 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onLike(e);
                        }}
                        aria-label={isLiked ? 'Unlike' : 'Like'}
                    >
                        <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
}
