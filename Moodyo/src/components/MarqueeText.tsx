'use client';

import { useRef, useEffect, useState } from 'react';

interface MarqueeTextProps {
    text: string;
    className?: string;
}

export function MarqueeText({ text, className = '' }: MarqueeTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldScroll, setShouldScroll] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const textEl = textRef.current;
        if (container && textEl) {
            setShouldScroll(textEl.scrollWidth > container.clientWidth);
        }
    }, [text]);

    return (
        <div ref={containerRef} className={`marquee-wrapper ${className}`}>
            <span
                ref={textRef}
                className={shouldScroll ? 'marquee-content' : ''}
                title={text}
            >
                {text}
                {shouldScroll && <>&nbsp;&nbsp;&nbsp;&nbsp;{text}</>}
            </span>
        </div>
    );
}
