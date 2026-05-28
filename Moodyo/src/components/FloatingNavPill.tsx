'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Search, Library, Camera, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/AppContext';
import { useUser } from '@/firebase';

interface FloatingNavPillProps {
  onScanClick: () => void;
}

export function FloatingNavPill({ onScanClick }: FloatingNavPillProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pillRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  // GSAP scroll shrink behavior
  useEffect(() => {
    if (!pillRef.current) return;
    let ctx: { revert: () => void } | undefined;

    const setup = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        ScrollTrigger.create({
          start: 'top -80',
          onUpdate: (self) => {
            const scrolled = self.scroll() > 80;
            gsap.to(pillRef.current, {
              scale: scrolled ? 0.93 : 1.0,
              opacity: scrolled ? 0.82 : 1.0,
              duration: 0.4,
              ease: 'power2.out',
            });
          },
        });
      });
    };

    setup();
    return () => ctx?.revert();
  }, []);

  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/' },
    { id: 'search', icon: Search, label: 'Search', path: '/search' },
    { id: 'library', icon: Library, label: 'Library', path: '/library' },
    { id: 'command-center', icon: Cpu, label: 'Command', path: '/command-center' },
  ];

  return (
    <div
      ref={pillRef}
      className="floating-nav-pill fixed z-50 left-1/2 -translate-x-1/2"
      style={{
        bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        willChange: 'transform, opacity',
      }}
    >
      <div
        className="glass-strong rounded-pill flex items-center gap-1 px-3 py-2.5 md:px-4 md:py-3"
        style={{
          boxShadow: 'var(--shadow-heavy)',
          maxWidth: 'calc(100vw - 2rem)',
        }}
      >
        {/* Nav links */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              aria-label={item.label}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-pill transition-all duration-300 focus-mood',
                active
                  ? 'bg-[#1A1814] text-white font-semibold'
                  : 'text-[#5C5850] hover:text-[#1A1814] hover:bg-black/5'
              )}
            >
              <Icon
                className={cn(
                  'transition-transform duration-300',
                  active ? 'w-[18px] h-[18px]' : 'w-5 h-5'
                )}
              />
              <span
                className={cn(
                  'text-label-caps hidden sm:inline transition-all',
                  active ? 'text-white' : 'text-[#5C5850]'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Divider */}
        <div className="w-px h-8 bg-black/10 mx-1" />

        {/* Scan Mood CTA */}
        <button
          onClick={onScanClick}
          aria-label="Scan your mood"
          className="relative flex items-center gap-2 px-3 py-2.5 rounded-pill transition-all duration-300 focus-mood"
          style={{
            background: 'var(--mood-gradient)',
            color: '#fff',
            transition: 'background 800ms ease, transform 300ms ease, box-shadow 300ms ease',
            boxShadow: '0 0 24px var(--mood-glow)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
        >
          {/* Rotating ring indicator */}
          <span
            className="absolute inset-0 rounded-pill border border-black/10"
            style={{
              animation: 'rotate-ring 4s linear infinite',
              background: 'transparent',
              pointerEvents: 'none',
            }}
          />
          <Camera className="w-4 h-4" />
          <span className="text-label-caps hidden sm:inline font-bold">Scan</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-black/10 mx-1" />

        {/* User Avatar */}
        <button
          onClick={() => router.push(user ? '/admin' : '/login')}
          aria-label={user ? 'User profile' : 'Sign in'}
          className="w-9 h-9 rounded-full overflow-hidden border border-black/10 hover:border-black/30 transition-colors focus-mood flex-none"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="User"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-xs font-bold text-black"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
