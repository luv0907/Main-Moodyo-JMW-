'use client';

import { collection, addDoc, updateDoc, deleteDoc, doc, type Firestore, query, onSnapshot, where, getDocs, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from './error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from './errors';

export interface Song {
    id?: string;
    title: string;
    artist: string;
    src: string;
    cover: string;
    mood: string;
    emotions: string[];
    popularity?: number;
    createdAt?: any;
}

export interface UserProfile {
    id?: string;
    name: string;
    email: string;
    createdAt: any;
    likedSongs: string[];
    playlists: { id: string; name: string; songIds: string[] }[];
    recentPlays: string[];
}


export interface UserSongPreference {
    id?: string;
    userId: string;
    songId: string;
    liked: boolean;
}

export function addSong(firestore: Firestore, song: Omit<Song, 'id'>) {
    const songsCollection = collection(firestore, 'songs');
    
    return addDoc(songsCollection, song)
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: songsCollection.path,
                operation: 'create',
                requestResourceData: song,
            } satisfies SecurityRuleContext);

            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
}

export function updateSong(firestore: Firestore, songId: string, song: Partial<Omit<Song, 'id'>>) {
    const songDoc = doc(firestore, 'songs', songId);

    return updateDoc(songDoc, song)
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: songDoc.path,
                operation: 'update',
                requestResourceData: song,
            } satisfies SecurityRuleContext);

            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
}

export function deleteSong(firestore: Firestore, songId: string) {
    const songDoc = doc(firestore, 'songs', songId);

    return deleteDoc(songDoc)
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: songDoc.path,
                operation: 'delete',
            } satisfies SecurityRuleContext);

            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
}

export function getSongs(
    firestore: Firestore,
    callback: (songs: Song[]) => void,
    onError: (error: Error) => void
) {
    const songsCollection = collection(firestore, 'songs');
    const q = query(songsCollection);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const songs: Song[] = [];
        querySnapshot.forEach((doc) => {
            songs.push({ id: doc.id, ...doc.data() } as Song);
        });
        callback(songs);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: songsCollection.path,
            operation: 'list',
        } satisfies SecurityRuleContext);
        
        errorEmitter.emit('permission-error', permissionError);
        onError(permissionError);
    });

    return unsubscribe;
}

export async function setUserSongPreference(firestore: Firestore, userId: string, songId: string, liked: boolean) {
    if (!userId || !songId) return;

    const userDocRef = doc(firestore, 'users', userId);
    
    try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            let likedSongs = userData.likedSongs || [];
            if (liked) {
                if (!likedSongs.includes(songId)) {
                    likedSongs.push(songId);
                }
            } else {
                likedSongs = likedSongs.filter(id => id !== songId);
            }
            updateDoc(userDocRef, { likedSongs }).catch((serverError) => {
                 errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: { likedSongs },
                }));
            });
        }
    } catch (error) {
        // This could be a permission error on getDoc
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        }));
    }
}

export function getUserSongPreferences(
    firestore: Firestore,
    userId: string,
    callback: (preferences: UserSongPreference[]) => void,
    onError: (error: Error) => void
) {
    const preferenceCollection = collection(firestore, `users/${userId}/song_preferences`);
    const q = query(preferenceCollection);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const preferences: UserSongPreference[] = [];
        querySnapshot.forEach((doc) => {
            preferences.push({ id: doc.id, ...doc.data() } as UserSongPreference);
        });
        callback(preferences);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: preferenceCollection.path,
            operation: 'list',
        } satisfies SecurityRuleContext);
        
        errorEmitter.emit('permission-error', permissionError);
        onError(permissionError);
    });

    return unsubscribe;
}

export async function searchSongs(firestore: Firestore, searchTerm: string): Promise<Song[]> {
    const term = searchTerm.trim();
    if (!term) return [];
    
    const songsCollection = collection(firestore, 'songs');
    
    // Firestore doesn't support native case-insensitive search.
    // This approach queries for different capitalizations. It's not exhaustive but works for many cases.
    const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1);

    const titleQuery = query(songsCollection, where('title', '>=', term), where('title', '<=', term + '\uf8ff'));
    const artistQuery = query(songsCollection, where('artist', '>=', term), where('artist', '<=', term + '\uf8ff'));
    
    const capitalizedTitleQuery = query(songsCollection, where('title', '>=', capitalizedTerm), where('title', '<=', capitalizedTerm + '\uf8ff'));
    const capitalizedArtistQuery = query(songsCollection, where('artist', '>=', capitalizedTerm), where('artist', '<=', capitalizedTerm + '\uf8ff'));

    try {
        const [
            titleSnapshot, 
            artistSnapshot, 
            capTitleSnapshot, 
            capArtistSnapshot
        ] = await Promise.all([
            getDocs(titleQuery),
            getDocs(artistQuery),
            getDocs(capitalizedTitleQuery),
            getDocs(capitalizedArtistQuery)
        ]);

        const results: Map<string, Song> = new Map();
        
        const processSnapshot = (snapshot: any) => {
            snapshot.forEach((doc: any) => {
                if (!results.has(doc.id)) {
                    results.set(doc.id, { id: doc.id, ...doc.data() } as Song);
                }
            });
        };

        processSnapshot(titleSnapshot);
        processSnapshot(artistSnapshot);
        processSnapshot(capTitleSnapshot);
        processSnapshot(capArtistSnapshot);
        
        // Final client-side filter for more accuracy, since Firestore prefix queries can be broad.
        const finalResults = Array.from(results.values()).filter(song => 
            song.title.toLowerCase().includes(term.toLowerCase()) ||
            song.artist.toLowerCase().includes(term.toLowerCase())
        );

        return finalResults;

    } catch (error) {
        console.error("Error searching songs: ", error);
        if (error instanceof Error && (error as any).code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: songsCollection.path,
                operation: 'list'
            }));
        }
        return [];
    }
}
