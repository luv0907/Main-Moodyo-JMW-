
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// Basic throttle function
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
    let inThrottle: boolean;
    let lastFunc: ReturnType<typeof setTimeout>;
    let lastRan: number;
    return function(this: any, ...args: any[]) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    } as T;
}


interface VirtualizerOptions {
  count: number;
  getScrollElement: () => HTMLElement | null;
  estimateSize: (index: number) => number;
  overscan?: number;
}

export function useVirtualizer({
  count,
  getScrollElement,
  estimateSize,
  overscan = 5,
}: VirtualizerOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const scrollElementRef = useRef<HTMLElement | null>(null);

  const handleScroll = useCallback(
    throttle((event: Event) => {
      const target = event.target as HTMLElement;
      setScrollTop(target.scrollTop);
    }, 16), // ~60fps
    []
  );

  useEffect(() => {
    const scrollElement = getScrollElement();
    scrollElementRef.current = scrollElement;
    if (!scrollElement) return;

    const measureContainer = () => {
      setContainerHeight(scrollElement.clientHeight);
    };

    measureContainer();
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', measureContainer);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', measureContainer);
    };
  }, [getScrollElement, handleScroll]);

  const { virtualItems, totalHeight, startIndex, endIndex } = useMemo(() => {
    const items: {
      key: number;
      index: number;
      start: number;
      end: number;
      size: number;
    }[] = [];
    
    let totalHeight = 0;
    for (let i = 0; i < count; i++) {
        totalHeight += estimateSize(i);
    }
    
    let startIndex = 0;
    let currentHeight = 0;

    // Find the start index
    while (currentHeight < scrollTop && startIndex < count) {
        currentHeight += estimateSize(startIndex);
        startIndex++;
    }
    startIndex = Math.max(0, startIndex - overscan);
    
    let endIndex = startIndex;
    currentHeight = 0;
     // Recalculate offset for the actual start index
    let virtualItemsOffset = 0;
    for (let i = 0; i < startIndex; i++) {
        virtualItemsOffset += estimateSize(i);
    }


    while (currentHeight < containerHeight && endIndex < count) {
      const itemSize = estimateSize(endIndex);
      items.push({
        key: endIndex,
        index: endIndex,
        start: virtualItemsOffset,
        end: virtualItemsOffset + itemSize,
        size: itemSize,
      });
      virtualItemsOffset += itemSize;
      currentHeight += itemSize;
      endIndex++;
    }

    endIndex = Math.min(count - 1, endIndex + overscan);

    for (let i = items.length > 0 ? items[items.length-1].index + 1 : startIndex; i <= endIndex && i < count; i++) {
         const itemSize = estimateSize(i);
         if(items.find(item => item.index === i)) continue;
         items.push({
            key: i,
            index: i,
            start: virtualItemsOffset,
            end: virtualItemsOffset + itemSize,
            size: itemSize,
        });
        virtualItemsOffset += itemSize;
    }


    return { virtualItems: items, totalHeight, startIndex, endIndex };
  }, [count, estimateSize, scrollTop, containerHeight, overscan]);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
  };
}
