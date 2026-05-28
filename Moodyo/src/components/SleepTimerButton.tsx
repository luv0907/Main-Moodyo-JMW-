'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppContext, usePlaybackState } from '@/context/AppContext';
import { cn } from '@/lib/utils';

const TIMER_OPTIONS = [
    { label: 'Off', minutes: 0 },
    { label: '5 min', minutes: 5 },
    { label: '10 min', minutes: 10 },
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '60 min', minutes: 60 },
];

export function SleepTimerButton() {
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioRef = useAppContext((s) => s.audioRef);

    const clearTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setRemainingSeconds(0);
    }, []);

    const startTimer = useCallback((minutes: number) => {
        clearTimer();
        if (minutes === 0) return;
        const totalSeconds = minutes * 60;
        setRemainingSeconds(totalSeconds);

        intervalRef.current = setInterval(() => {
            setRemainingSeconds((prev) => {
                if (prev <= 1) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    // Pause audio
                    const audio = audioRef.current;
                    if (audio) {
                        audio.pause();
                        usePlaybackState.setState({ isPlaying: false });
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearTimer, audioRef]);

    // Cleanup on unmount
    useEffect(() => () => clearTimer(), [clearTimer]);

    const isActive = remainingSeconds > 0;

    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className={cn('player-control-button sleep-timer-btn', { 'control-active': isActive })}
                    title={isActive ? `Sleep in ${formatCountdown(remainingSeconds)}` : 'Sleep Timer'}
                >
                    <Timer size={18} />
                    {isActive && (
                        <span className="sleep-timer-badge">{formatCountdown(remainingSeconds)}</span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" className="sleep-timer-menu">
                <DropdownMenuLabel>Sleep Timer</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TIMER_OPTIONS.map(({ label, minutes }) => (
                    <DropdownMenuItem
                        key={label}
                        onClick={() => startTimer(minutes)}
                        className={cn({ 'text-primary font-semibold': isActive && minutes === 0 })}
                    >
                        {label}
                        {isActive && minutes === 0 && ' (cancel)'}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
