'use client';

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';

/**
 * A hook that ensures a user is signed in anonymously if no user is currently authenticated.
 * This is non-blocking and runs once on component mount.
 */
export function useAnonymousSignIn() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const hasAttemptedSignIn = useRef(false);

  useEffect(() => {
    // We only want this to run once.
    if (hasAttemptedSignIn.current) return;

    // Check if the initial auth state has been determined and there is no user.
    if (!isUserLoading && !user) {
      hasAttemptedSignIn.current = true;
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);
}
