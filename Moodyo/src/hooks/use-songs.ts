
'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { getSongs, type Song } from '@/firebase/firestore';

export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const firestore = useFirestore();
  const { user } = useUser(); // Get the user object

  useEffect(() => {
    // Wait for both firestore and an authenticated user
    if (!firestore || !user) {
      // If there's no user yet, we are in a loading state until anonymous auth completes.
      // We don't set loading to false here, to prevent a flicker of "no songs".
      return;
    }

    setLoading(true);
    const unsubscribe = getSongs(
      firestore,
      (newSongs) => {
        setSongs(newSongs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, user]); // Add user to the dependency array

  return { songs, loading, error };
}

    