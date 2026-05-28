'use client';

import { useEffect } from 'react';
import type { MoodDefinition } from '@/app/lib/mood-definitions';
import type { Song } from '@/firebase/firestore';

type ThemeProviderProps = {
    activePage: string;
    customMoods: Record<string, MoodDefinition>;
    tracks: Record<string, Song[]>;
    nowPlayingId: string | null;
    allMoods: Record<string, MoodDefinition>;
    currentTrack: Song | null;
};

export function ThemeProvider({ activePage, customMoods, tracks, nowPlayingId, allMoods, currentTrack }: ThemeProviderProps) {

  useEffect(() => {
    const moodDef = allMoods[activePage as keyof typeof allMoods];

    // Reset classes and styles on body
    document.body.className = 'dark';
    document.body.style.background = '';
    document.documentElement.style.setProperty('--page-accent', 'hsl(var(--primary))');
    
    // Reset background image on all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => {
      const pageEl = p as HTMLElement;
      pageEl.style.setProperty('--bg-image', 'none');
    });

    if (activePage === 'home') {
        document.body.classList.add('home-active');
    } else if (moodDef) {
        document.body.style.background = moodDef.bg;
        document.documentElement.style.setProperty('--page-accent', moodDef.accent);
        
        const activePageElement = document.getElementById(activePage);
        const trackForBg = currentTrack && tracks[activePage]?.some(t => t.id === currentTrack.id)
            ? currentTrack 
            : tracks[activePage]?.[0];

        if (activePageElement && trackForBg) {
            activePageElement.style.setProperty('--bg-image', `url(${trackForBg.cover})`);
        }

        let classes = `${activePage}-active `;
        classes += moodDef.themeClass || 'custom-theme-active ';
        classes += 'theme-active ';
        
        document.body.className = document.body.className + ' ' + classes.trim();
    }
  }, [activePage, customMoods, tracks, nowPlayingId, allMoods, currentTrack]);

  return null; // This component does not render anything
}
