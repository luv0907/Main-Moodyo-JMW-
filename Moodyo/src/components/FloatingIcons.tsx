'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Music, Mic, Headphones, PlayCircle, Radio } from 'lucide-react';

export function FloatingIcons() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        
        const icons = gsap.utils.toArray(containerRef.current.children);
        
        icons.forEach((icon: any) => {
            gsap.to(icon, {
                y: `random(-100, 100)`,
                x: `random(-50, 50)`,
                rotation: `random(-45, 45)`,
                duration: `random(10, 20)`,
                ease: "sine.inOut",
                repeat: -1,
                yoyo: true
            });
        });
    }, []);

    return (
        <div 
            ref={containerRef} 
            className="fixed inset-0 pointer-events-none overflow-hidden z-[1] opacity-30 mix-blend-overlay"
        >
            <Music className="absolute top-[20%] left-[10%] text-white w-12 h-12" />
            <Headphones className="absolute top-[60%] left-[15%] text-white w-16 h-16" />
            <Mic className="absolute top-[30%] right-[20%] text-white w-14 h-14" />
            <PlayCircle className="absolute top-[70%] right-[10%] text-white w-20 h-20" />
            <Radio className="absolute top-[40%] left-[50%] text-white w-10 h-10" />
            <Music className="absolute top-[80%] left-[40%] text-white w-14 h-14" />
            <Headphones className="absolute top-[10%] right-[40%] text-white w-10 h-10" />
        </div>
    );
}
