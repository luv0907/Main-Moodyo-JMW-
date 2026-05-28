import { useState, useEffect, useCallback } from 'react';

export type MoodPreference = {
    preferredPlaylist: 'sad' | 'joyful' | 'depression' | 'happy';
    dontAskAgain: boolean;
};

const STORAGE_KEY = 'moodyo_session_preferences';

export const useSessionPreferences = () => {
    const [preferences, setPreferences] = useState<Record<string, MoodPreference>>({});

    // Load from sessionStorage on mount
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                setPreferences(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load session preferences:', error);
        }
    }, []);

    // Save to sessionStorage whenever preferences change
    useEffect(() => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        } catch (error) {
            console.error('Failed to save session preferences:', error);
        }
    }, [preferences]);

    const savePreference = useCallback((mood: 'sad' | 'depression', preference: MoodPreference) => {
        setPreferences(prev => ({
            ...prev,
            [mood]: preference
        }));
    }, []);

    const getPreference = useCallback((mood: 'sad' | 'depression'): MoodPreference | null => {
        return preferences[mood] || null;
    }, [preferences]);

    const clearPreferences = useCallback(() => {
        setPreferences({});
        sessionStorage.removeItem(STORAGE_KEY);
    }, []);

    return {
        savePreference,
        getPreference,
        clearPreferences,
        preferences
    };
};
