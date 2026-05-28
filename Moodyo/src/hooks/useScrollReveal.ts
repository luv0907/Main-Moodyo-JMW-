import { useEffect, useRef, RefObject } from 'react';

interface ScrollRevealConfig {
  selector?: string;
  fromVars?: gsap.TweenVars;
  stagger?: number;
  start?: string;
}

export function useScrollReveal(
  ref: RefObject<HTMLElement | null>,
  config: ScrollRevealConfig = {}
) {
  const {
    selector = '*',
    fromVars = { opacity: 0, y: 48, duration: 0.65, ease: 'power3.out' },
    stagger = 0.07,
    start = 'top 85%',
  } = config;

  useEffect(() => {
    if (!ref.current) return;

    let ctx: { revert: () => void } | undefined;

    const setup = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        const targets = selector === 'self'
          ? [ref.current!]
          : Array.from(ref.current!.querySelectorAll(selector));

        if (targets.length === 0) return;

        gsap.set(targets, { opacity: 0 });

        ScrollTrigger.create({
          trigger: ref.current!,
          start,
          once: true,
          onEnter: () => {
            gsap.fromTo(
              targets,
              { opacity: 0, ...fromVars },
              {
                opacity: 1,
                y: 0,
                x: 0,
                scale: 1,
                filter: 'blur(0px)',
                stagger,
                duration: fromVars.duration as number ?? 0.65,
                ease: fromVars.ease as string ?? 'power3.out',
              }
            );
          },
        });
      }, ref);
    };

    setup();

    return () => {
      ctx?.revert();
    };
  }, []);
}
