'use client';

// =============================================================================
// Nucleus AI — Landing: Stats
// =============================================================================
// Headline metrics with count-up animation (reuses the shared CountUp). Sits on
// a gradient band for visual punch.
// =============================================================================

import { CountUp } from '@/components/ui/animated';
import { RevealGroup, RevealItem } from './Reveal';

const STATS = [
  { value: 10000, suffix: '+', label: 'Generations Created' },
  { value: 50, suffix: '+', label: 'Happy Marketers' },
  { value: 3, suffix: '', label: 'AI Providers' },
  { value: 8, suffix: '+', label: 'Content Types' },
];

export function Stats() {
  return (
    <section className="relative overflow-hidden py-20">
      <div className="absolute inset-0 -z-10 bg-aurora opacity-80" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealGroup className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((stat) => (
            <RevealItem key={stat.label} className="text-center">
              <div className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                <span className="text-gradient">
                  <CountUp
                    value={stat.value}
                    suffix={stat.suffix}
                    duration={2}
                  />
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

export default Stats;
