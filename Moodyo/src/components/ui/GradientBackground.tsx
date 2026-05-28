'use client';

import { useEffect, useRef } from 'react';

interface GradientBackgroundProps {
  mood?: string;
}

export function GradientBackground({ mood = 'default' }: GradientBackgroundProps) {
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Update data-mood attribute — drives CSS variable cascade
    document.documentElement.setAttribute('data-mood', mood);

    // GSAP mood flash — 600ms chromatic pulse on mood change
    if (mood !== 'default') {
      const triggerFlash = async () => {
        if (!flashRef.current) return;
        const { gsap } = await import('gsap');
        gsap.timeline()
          .to(flashRef.current, {
            opacity: 0.12,
            scale: 3,
            duration: 0.3,
            ease: 'power2.out',
          })
          .to(flashRef.current, {
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
          });
      };
      triggerFlash();
    }
  }, [mood]);

  return (
    <>
      {/* Solid Cream Background Layer */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0, backgroundColor: 'var(--void)', transition: 'background-color 500ms ease' }}
        aria-hidden="true"
      />

      {/* Mood flash overlay — for GSAP transition pulse */}
      <div
        ref={flashRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 200,
          borderRadius: '50%',
          transform: 'scale(0)',
          opacity: 0,
          background: `radial-gradient(circle, var(--mood-primary) 0%, transparent 70%)`,
          transition: 'background 800ms ease',
        }}
      />
    </>
  );
}
