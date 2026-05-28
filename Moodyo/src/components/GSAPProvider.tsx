'use client';

import { useEffect } from 'react';

export function GSAPProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register GSAP ScrollTrigger plugin once at app root
    const registerGSAP = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
    };
    registerGSAP();
  }, []);

  return <>{children}</>;
}
