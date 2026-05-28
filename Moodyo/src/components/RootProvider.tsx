'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AppProvider, AudioPlayer } from '@/context/AppContext';
import { FloatingPlayerWrapper } from '@/components/FloatingPlayer';
import { useAnonymousSignIn } from '@/hooks/use-anonymous-sign-in';
import { GlobalLoader } from './GlobalLoader';

function AppInitializer({ children }: { children: React.ReactNode }) {
  // This hook will ensure an anonymous user is signed in if no one is.
  useAnonymousSignIn();
  return <>{children}</>;
}


export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AppProvider>
        <AppInitializer>
          <GlobalLoader />
          {children}
          <AudioPlayer />
        </AppInitializer>
      </AppProvider>
    </FirebaseClientProvider>
  );
}
