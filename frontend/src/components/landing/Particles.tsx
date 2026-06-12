'use client';

// =============================================================================
// Nucleus AI — Landing: Particles
// =============================================================================
// Lightweight, CSS-driven floating particle field. Generates a deterministic
// set of dots that slowly drift upward for subtle depth. No canvas / no JS
// animation loop — keeps it cheap and 60fps-friendly.
// =============================================================================

import { useMemo } from 'react';

interface Particle {
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
}

export function Particles({ count = 28 }: { count?: number }) {
  const particles = useMemo<Particle[]>(() => {
    // Seeded pseudo-random so SSR + client match (avoids hydration mismatch).
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 100,
      size: 2 + rand() * 4,
      delay: rand() * 8,
      duration: 8 + rand() * 10,
      drift: (rand() - 0.5) * 60,
      opacity: 0.2 + rand() * 0.4,
    }));
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-indigo-400 to-cyan-300"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            // CSS custom props consumed by the nucleus-particle-drift keyframe.
            ['--p-drift' as string]: `${p.drift}px`,
            ['--p-opacity' as string]: p.opacity,
            animation: `nucleus-particle-drift ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default Particles;
