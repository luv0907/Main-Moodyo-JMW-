'use client';

import { useEffect, useRef } from 'react';

// Static pre-calculated icon positions — NO Math.random() at render time
// Prevents Next.js hydration mismatch
const HERO_ICONS = [
  { char: '♪', top: '8%',  left: '6%',  size: 22, opacity: 0.07, depth: 1, rotation: -15, floatDuration: 8,  floatDelay: 0 },
  { char: '♫', top: '15%', left: '88%', size: 18, opacity: 0.06, depth: 2, rotation: 12,  floatDuration: 11, floatDelay: 1.5 },
  { char: '♬', top: '30%', left: '4%',  size: 26, opacity: 0.05, depth: 1, rotation: -8,  floatDuration: 9,  floatDelay: 0.8 },
  { char: '◎', top: '22%', left: '72%', size: 20, opacity: 0.06, depth: 3, rotation: 5,   floatDuration: 13, floatDelay: 2.0 },
  { char: '▷', top: '55%', left: '3%',  size: 16, opacity: 0.05, depth: 2, rotation: 0,   floatDuration: 10, floatDelay: 0.3 },
  { char: '✦', top: '68%', left: '92%', size: 14, opacity: 0.08, depth: 3, rotation: 20,  floatDuration: 7,  floatDelay: 1.0 },
  { char: '〜', top: '42%', left: '80%', size: 24, opacity: 0.05, depth: 1, rotation: -5,  floatDuration: 12, floatDelay: 3.2 },
  { char: '✦', top: '78%', left: '15%', size: 12, opacity: 0.09, depth: 3, rotation: 45,  floatDuration: 6,  floatDelay: 0.5 },
  { char: '♪', top: '85%', left: '60%', size: 18, opacity: 0.05, depth: 2, rotation: -20, floatDuration: 14, floatDelay: 2.5 },
  { char: '❝', top: '12%', left: '45%', size: 20, opacity: 0.04, depth: 1, rotation: 0,   floatDuration: 10, floatDelay: 1.8 },
  { char: '⟳', top: '60%', left: '55%', size: 16, opacity: 0.05, depth: 2, rotation: 30,  floatDuration: 9,  floatDelay: 0.7 },
  { char: '♫', top: '40%', left: '25%', size: 14, opacity: 0.06, depth: 3, rotation: -12, floatDuration: 11, floatDelay: 2.0 },
  { char: '◎', top: '72%', left: '82%', size: 22, opacity: 0.05, depth: 1, rotation: 8,   floatDuration: 8,  floatDelay: 4.0 },
  { char: '〜', top: '90%', left: '38%', size: 18, opacity: 0.06, depth: 2, rotation: -25, floatDuration: 12, floatDelay: 1.2 },
] as const;

interface FloatingIconsLayerProps {
  variant?: 'hero' | 'home-section';
}

export function FloatingIconsLayer({ variant = 'hero' }: FloatingIconsLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP mouse parallax — desktop only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('ontouchstart' in window) return; // Skip on touch devices

    const handleMouseMove = async (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { gsap } = await import('gsap');
      const xPercent = (e.clientX / window.innerWidth - 0.5) * 2;
      const yPercent = (e.clientY / window.innerHeight - 0.5) * 2;

      gsap.to('.float-icon-depth-1', {
        x: xPercent * -8,
        y: yPercent * -5,
        duration: 1.2,
        ease: 'power2.out',
      });
      gsap.to('.float-icon-depth-2', {
        x: xPercent * -16,
        y: yPercent * -10,
        duration: 1.0,
        ease: 'power2.out',
      });
      gsap.to('.float-icon-depth-3', {
        x: xPercent * -28,
        y: yPercent * -18,
        duration: 0.8,
        ease: 'power2.out',
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {HERO_ICONS.map((icon, i) => (
        <span
          key={i}
          className={`float-icon float-icon-depth-${icon.depth}`}
          style={{
            position: 'absolute',
            top: icon.top,
            left: icon.left,
            fontSize: icon.size,
            opacity: icon.opacity,
            transform: `rotate(${icon.rotation}deg)`,
            animationDuration: `${icon.floatDuration}s`,
            animationDelay: `${icon.floatDelay}s`,
            color: `rgba(var(--mood-primary-rgb, 255, 255, 255), ${icon.opacity})`,
            transition: 'color 1200ms ease',
            willChange: 'transform',
          }}
        >
          {icon.char}
        </span>
      ))}
    </div>
  );
}
