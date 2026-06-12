'use client';

// Confetti celebration helpers built on canvas-confetti.
// Usage:
//   import { fireConfetti } from '@/components/ui/animated/Confetti';
//   fireConfetti();              // default burst
//   fireConfetti('fireworks');   // sustained fireworks
import { useCallback } from 'react';

type Variant = 'burst' | 'fireworks' | 'cannon';

const BRAND_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#3b82f6', '#a855f7'];

/** Fire a confetti animation. Safe to call on the client only. */
export async function fireConfetti(variant: Variant = 'burst'): Promise<void> {
  if (typeof window === 'undefined') return;
  const confetti = (await import('canvas-confetti')).default;

  if (variant === 'burst') {
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.6 },
      colors: BRAND_COLORS,
      scalar: 1.1,
    });
    return;
  }

  if (variant === 'cannon') {
    confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 }, colors: BRAND_COLORS });
    confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 }, colors: BRAND_COLORS });
    return;
  }

  // fireworks — repeated bursts over ~2s
  const end = Date.now() + 2000;
  const frame = () => {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: BRAND_COLORS,
    });
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: BRAND_COLORS,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** Hook variant returning a memoized fire callback. */
export function useConfetti() {
  return useCallback((variant: Variant = 'burst') => {
    void fireConfetti(variant);
  }, []);
}

export default fireConfetti;
