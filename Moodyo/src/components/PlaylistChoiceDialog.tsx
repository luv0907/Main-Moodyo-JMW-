'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOOD_DEFS } from '@/app/lib/mood-definitions';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PlaylistChoiceDialogProps {
    isOpen: boolean;
    detectedMood: 'sad' | 'depressed';
    onSelect: (selectedPlaylist: string, dontAskAgain: boolean) => void;
    onClose: () => void;
    firstSongCover?: string;
}

// Fallback colors since MOOD_DEFS doesn't have them
const MOOD_STYLES: Record<string, { bg: string, accent: string }> = {
    happy: { bg: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', accent: '#FFD700' },
    sad: { bg: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)', accent: '#4A90E2' },
    joyfull: { bg: 'linear-gradient(135deg, #FF6B6B 0%, #EE5253 100%)', accent: '#FF6B6B' },
    depressed: { bg: 'linear-gradient(135deg, #2C3E50 0%, #000000 100%)', accent: '#95A5A6' },
};

export const PlaylistChoiceDialog: React.FC<PlaylistChoiceDialogProps> = ({
    isOpen,
    detectedMood,
    onSelect,
    onClose,
}) => {
    const [dontAskAgain, setDontAskAgain] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);

    if (!isOpen) return null;

    // Normalize mood key (e.g. depression -> depressed)
    const normalizedMood = detectedMood === 'depression' as any ? 'depressed' : detectedMood;

    // Define playlist options based on detected mood
    const options = normalizedMood === 'sad'
        ? [
            { key: 'sad', ...MOOD_DEFS.sad, ...MOOD_STYLES.sad },
            { key: 'joyfull', ...MOOD_DEFS.joyfull, ...MOOD_STYLES.joyfull }
        ]
        : [
            { key: 'depressed', ...MOOD_DEFS.depressed, ...MOOD_STYLES.depressed },
            { key: 'happy', ...MOOD_DEFS.happy, ...MOOD_STYLES.happy }
        ];

    const handleSelect = (playlistKey: string) => {
        setSelectedPlaylist(playlistKey);
        setTimeout(() => {
            onSelect(playlistKey, dontAskAgain);
        }, 300);
    };

    const currentMoodInfo = MOOD_DEFS[normalizedMood] || MOOD_DEFS.sad;
    const currentStyles = MOOD_STYLES[normalizedMood] || MOOD_STYLES.sad;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-8"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
        >
            {/* Background gradient */}
            <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div
                    className="absolute inset-0 transition-colors duration-1000"
                    style={{ background: currentStyles.bg }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />
            </div>

            {/* Dialog Content */}
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="relative z-10 w-full max-w-3xl"
            >
                {/* Close button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute -top-12 right-0 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
                >
                    <X size={24} />
                </Button>

                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                        className="text-7xl mb-4"
                    >
                        {currentMoodInfo.emoji}
                    </motion.div>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2 text-white">
                        Feeling <span style={{ color: currentStyles.accent }}>{currentMoodInfo.title}</span>?
                    </h2>
                    <p className="text-white/60 text-lg font-medium">
                        Choose your vibe — we'll remember your choice for this session
                    </p>
                </div>

                {/* Playlist Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {options.map((option, index) => (
                        <motion.div
                            key={option.key}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + index * 0.1 }}
                            onClick={() => handleSelect(option.key)}
                            className={cn(
                                "relative cursor-pointer group p-6 rounded-3xl border transition-all duration-300",
                                selectedPlaylist === option.key 
                                    ? "bg-white/10 border-white/40 scale-105" 
                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                            )}
                        >
                            <div className="relative aspect-square rounded-2xl overflow-hidden mb-6 shadow-2xl">
                                {/* Gradient overlay */}
                                <div
                                    className="absolute inset-0 opacity-60 group-hover:opacity-40 transition-opacity duration-300"
                                    style={{ background: option.bg }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-9xl opacity-30 group-hover:scale-110 transition-transform duration-500">
                                    {option.emoji}
                                </div>
                                <AnimatePresence>
                                    {selectedPlaylist === option.key && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0 }}
                                            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg"
                                        >
                                            <Check size={28} className="text-black" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="text-center">
                                <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-1 text-white flex items-center justify-center gap-2">
                                    <span>{option.emoji}</span>
                                    <span>{option.title}</span>
                                </h3>
                                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                                    {option.subtitle}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Don't ask again checkbox */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
                >
                    <label
                        htmlFor="dont-ask-again"
                        className="flex items-center gap-3 cursor-pointer select-none"
                    >
                        <input
                            type="checkbox"
                            id="dont-ask-again"
                            checked={dontAskAgain}
                            onChange={(e) => setDontAskAgain(e.target.checked)}
                            className="w-5 h-5 rounded border-white/30 bg-black/20 text-white accent-white"
                        />
                        <span className="text-white/80 font-bold text-sm uppercase tracking-widest">
                            Save preference for this session
                        </span>
                    </label>
                </motion.div>
            </motion.div>
        </motion.div>
    );
};
