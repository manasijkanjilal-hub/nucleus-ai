'use client';

// =============================================================================
// Nucleus AI — Landing: Testimonials
// =============================================================================
// Social-proof grid of testimonial cards with star ratings, gradient-bordered
// avatars, and scroll fade-in. A subtle auto-highlight cycles the "featured"
// card for a touch of motion.
// =============================================================================

import { useEffect, useState } from 'react';
import { Star, Quote } from 'lucide-react';

import { Reveal, RevealGroup, RevealItem } from './Reveal';

const TESTIMONIALS = [
  {
    quote:
      'Nucleus AI cut our content turnaround from days to minutes. Everything comes out perfectly on-brand.',
    name: 'Sarah Chen',
    role: 'Head of Marketing, BrightLabs',
    initials: 'SC',
    tone: 'from-indigo-500 to-violet-500',
  },
  {
    quote:
      'The Context Vault is a game changer. Our whole team now sounds consistent across every channel.',
    name: 'Marcus Reid',
    role: 'Growth Lead, Northwind',
    initials: 'MR',
    tone: 'from-cyan-500 to-blue-500',
  },
  {
    quote:
      'Switching between OpenAI, Gemini, and Claude in one place is brilliant. We always get the best output.',
    name: 'Priya Nair',
    role: 'Founder, Loop Studio',
    initials: 'PN',
    tone: 'from-fuchsia-500 to-pink-500',
  },
  {
    quote:
      'We replaced three tools with Nucleus AI. The analytics and exports alone pay for themselves.',
    name: 'David Okafor',
    role: 'CMO, Vantage',
    initials: 'DO',
    tone: 'from-emerald-500 to-teal-500',
  },
  {
    quote:
      'Onboarding took ten minutes. By lunch we had a full campaign generated and scheduled.',
    name: 'Elena Rossi',
    role: 'Brand Manager, Aria',
    initials: 'ER',
    tone: 'from-amber-500 to-orange-500',
  },
  {
    quote:
      'It just feels premium. The team actually enjoys creating content now — that never happened before.',
    name: 'Tom Becker',
    role: 'Marketing Ops, Kindred',
    initials: 'TB',
    tone: 'from-violet-500 to-indigo-500',
  },
];

export function Testimonials() {
  const [featured, setFeatured] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setFeatured((f) => (f + 1) % TESTIMONIALS.length),
      3000
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-violet-500">
            Loved by marketers
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Teams ship faster with{' '}
            <span className="text-gradient">Nucleus AI</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join the marketers creating better content in less time.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, idx) => (
            <RevealItem key={t.name}>
              <div
                className={`relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-all duration-500 ${
                  featured === idx
                    ? 'border-violet-500/50 shadow-[0_20px_50px_-15px_rgba(139,92,246,0.4)]'
                    : 'border-border'
                }`}
              >
                <Quote className="h-7 w-7 text-violet-500/30" />
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                  “{t.quote}”
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <span className="rounded-full bg-primary-gradient p-[2px]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-sm font-semibold">
                      {t.initials}
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

export default Testimonials;
