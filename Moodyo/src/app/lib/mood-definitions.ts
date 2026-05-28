export type MoodDefinition = {
  title: string;
  subtitle: string;
  emoji: string;
  /** CSS var data-mood key */
  themeKey: string;
};

export const MOOD_DEFS: { [key: string]: MoodDefinition } = {
  happy: {
    title: 'Happy',
    subtitle: 'Warm and bright — music that feels like sunshine',
    emoji: '☀️',
    themeKey: 'happy',
  },
  sad: {
    title: 'Sad',
    subtitle: 'Reflective and deep — sit with your feelings',
    emoji: '🌧️',
    themeKey: 'sad',
  },
  joyfull: {
    title: 'Joyfull',
    subtitle: 'Vibrant and alive — pure energetic bliss',
    emoji: '✨',
    themeKey: 'joyfull',
  },
  depressed: {
    title: 'Depressed',
    subtitle: 'Heavy, muted, and atmospheric — for the lowest lows',
    emoji: '🌑',
    themeKey: 'depressed',
  },
};

export const PRIMARY_MOODS = [
  'happy',
  'sad',
  'joyfull',
  'depressed'
];

export function getMoodDef(key: string | undefined): MoodDefinition {
  const normalized = key?.toLowerCase().trim();
  
  // Handle aliases
  let finalKey = normalized;
  if (normalized === 'depression') finalKey = 'depressed';
  if (normalized === 'joyful') finalKey = 'joyfull';

  if (!finalKey || !MOOD_DEFS[finalKey]) {
    // Default fallback
    return {
      title: 'Neutral',
      subtitle: 'A balanced state of mind',
      emoji: '🎧',
      themeKey: 'default'
    };
  }
  return MOOD_DEFS[finalKey];
}

/**
 * Checks if a song's mood matches a target mood key, handling aliases.
 */
export function isMoodMatch(songMood: string | undefined, targetKey: string): boolean {
  if (!songMood) return false;
  const s = songMood.toLowerCase().trim();
  const t = targetKey.toLowerCase().trim();
  
  if (s === t) return true;
  
  // Aliases
  if (t === 'depressed' && s === 'depression') return true;
  if (t === 'joyfull' && s === 'joyful') return true;
  if (t === 'joyful' && s === 'joyfull') return true; // reverse case
  if (t === 'depression' && s === 'depressed') return true; // reverse case
  
  return false;
}
