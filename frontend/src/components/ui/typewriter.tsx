'use client';

// =============================================================================
// Typewriter — progressively reveals text with a blinking caret.
// Respects `prefers-reduced-motion` (renders full text instantly).
// Used in the AI Content Generator to make results feel "live".
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface TypewriterProps {
  text: string;
  /** Characters revealed per tick. Higher = faster. Default 3. */
  speed?: number;
  /** Tick interval in ms. Default 16 (~60fps). */
  interval?: number;
  className?: string;
  /** Called once the full text has been revealed. */
  onDone?: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Typewriter({
  text,
  speed = 3,
  interval = 16,
  className,
  onDone,
}: TypewriterProps) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    // Reset whenever the source text changes.
    doneRef.current = false;

    if (prefersReducedMotion() || !text) {
      setCount(text.length);
      onDone?.();
      doneRef.current = true;
      return;
    }

    setCount(0);
    const timer = setInterval(() => {
      setCount((c) => {
        const next = Math.min(text.length, c + speed);
        if (next >= text.length && !doneRef.current) {
          doneRef.current = true;
          clearInterval(timer);
          onDone?.();
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, interval]);

  const done = count >= text.length;

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {text.slice(0, count)}
      {!done && (
        <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-primary align-middle" />
      )}
    </span>
  );
}

export default Typewriter;
