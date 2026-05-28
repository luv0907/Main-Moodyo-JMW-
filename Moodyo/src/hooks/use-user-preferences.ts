
'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { UserProfile, UserSongPreference } from '@/firebase/firestore';

// A simplified hook to get just the liked song IDs
export function useUserPreferences(userId?: string) {
  const [likedSongIds, setLikedSongIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore || !userId) {
      setLikedSongIds([]);
      return;
    }

    setLoading(true);
    const userDocRef = doc(firestore, 'users', userId);

    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as UserProfile;
          setLikedSongIds(userData.likedSongs || []);
        } else {
          // User document might not exist yet
          setLikedSongIds([]);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
        console.error("Error fetching user preferences:", err);
      }
    );

    return () => unsubscribe();
  }, [firestore, userId]);
  
  // To maintain compatibility with original hook shape if needed elsewhere
  const preferences: UserSongPreference[] = likedSongIds.map(songId => ({
      songId,
      liked: true,
      userId: userId!,
  }));

  return { preferences, likedSongIds, loading, error };
}
