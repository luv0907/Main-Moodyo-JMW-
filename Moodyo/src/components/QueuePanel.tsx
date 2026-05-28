'use client';

import Image from 'next/image';
import { ListMusic, Music } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface QueuePanelProps {
    open: boolean;
    onClose: () => void;
}

export function QueuePanel({ open, onClose }: QueuePanelProps) {
    const { playlist, nowPlayingId, setNowPlayingId } = useAppContext();

    const handleSelect = (songId: string) => {
        setNowPlayingId(songId);
        onClose();
    };

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="right" className="sheet-content w-80 p-0 flex flex-col">
                <SheetHeader className="px-4 pt-6 pb-4 border-b border-white/10">
                    <SheetTitle className="flex items-center gap-2 text-lg font-bold">
                        <ListMusic size={20} />
                        Up Next
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <div className="queue-list px-2 py-3">
                        {playlist.length === 0 ? (
                            <p className="text-center text-muted-foreground text-sm py-8">
                                Your queue is empty.
                            </p>
                        ) : (
                            playlist.map((song, idx) => {
                                const isPlaying = song.id === nowPlayingId;
                                return (
                                    <button
                                        key={song.id ?? idx}
                                        className={cn('queue-item', { 'queue-item--active': isPlaying })}
                                        onClick={() => song.id && handleSelect(song.id)}
                                    >
                                        <div className="queue-item__cover">
                                            {song.cover ? (
                                                <Image
                                                    src={song.cover}
                                                    alt={song.title}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized={song.cover.startsWith('data:')}
                                                />
                                            ) : (
                                                <div className="queue-item__icon">
                                                    <Music size={16} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="queue-item__info">
                                            <span className="queue-item__title">{song.title}</span>
                                            <span className="queue-item__artist">{song.artist}</span>
                                        </div>
                                        {isPlaying && (
                                            <div className="queue-item__playing">
                                                <span /><span /><span />
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
