'use client';

// =============================================================================
// Nucleus AI — Landing: LiveDemo
// =============================================================================
// Mock generation interface. Users pick a content type and hit "Generate" to
// watch an animated typewriter render an on-brand sample. Purely client-side,
// no API calls — designed to showcase the product feel.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Loader2, Megaphone, Mail, FileText } from 'lucide-react';

import { Reveal } from './Reveal';

type DemoKey = 'ad' | 'email' | 'post';

const SAMPLES: Record<
  DemoKey,
  { label: string; icon: typeof Megaphone; prompt: string; output: string }
> = {
  ad: {
    label: 'Instagram Ad',
    icon: Megaphone,
    prompt: 'Write an Instagram ad for our new eco-friendly water bottle.',
    output:
      "💧 Meet the bottle that loves the planet as much as you do.\n\nMade from 100% recycled materials, our new EcoFlow bottle keeps drinks cold for 24h — and keeps 12 plastic bottles out of the ocean.\n\n🌿 Sustainable. Sleek. Yours.\n\n👉 Tap to shop the drop. #DrinkBetter #EcoFlow",
  },
  email: {
    label: 'Email Subject',
    icon: Mail,
    prompt: 'Generate 3 catchy email subject lines for a summer sale.',
    output:
      '1. ☀️ Your summer just got 40% cooler\n2. The sale you\u2019ve been waiting for is finally here\n3. Hot deals, cool prices — 48 hours only 🔥',
  },
  post: {
    label: 'Blog Intro',
    icon: FileText,
    prompt: 'Write a blog intro about AI in marketing.',
    output:
      "Marketing has always been about telling the right story to the right person at the right time. But what if you could do that — at scale, in seconds?\n\nThat\u2019s the promise of AI-powered marketing. In this post, we\u2019ll explore how modern teams are using generative AI to create on-brand content faster than ever.",
  },
};

const TYPE_SPEED = 14; // ms per character

export function LiveDemo() {
  const [active, setActive] = useState<DemoKey>('ad');
  const [generating, setGenerating] = useState(false);
  const [typed, setTyped] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const runTypewriter = useCallback((key: DemoKey) => {
    clearTimer();
    setGenerating(true);
    setTyped('');
    const full = SAMPLES[key].output;
    // brief "thinking" delay before typing
    timer.current = setTimeout(() => {
      let i = 0;
      const tick = () => {
        i += 1;
        setTyped(full.slice(0, i));
        if (i < full.length) {
          timer.current = setTimeout(tick, TYPE_SPEED);
        } else {
          setGenerating(false);
        }
      };
      tick();
    }, 600);
  }, []);

  // Auto-run once when the section first mounts.
  useEffect(() => {
    runTypewriter('ad');
    return clearTimer;
  }, [runTypewriter]);

  const selectType = (key: DemoKey) => {
    setActive(key);
    runTypewriter(key);
  };

  return (
    <section id="demo" className="relative py-24">
      <div className="absolute inset-0 -z-10 bg-mesh opacity-60" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-cyan-500">
            Live Demo
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            See it <span className="text-gradient">generate</span> in real time
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Pick a content type and watch Nucleus AI craft it instantly.
          </p>
        </Reveal>

        <Reveal direction="up" delay={0.1} className="mx-auto mt-12 max-w-3xl">
          <div className="glass gradient-border overflow-hidden rounded-2xl shadow-2xl">
            {/* Type switcher */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 p-4">
              {(Object.keys(SAMPLES) as DemoKey[]).map((key) => {
                const Icon = SAMPLES[key].icon;
                const isActive = key === active;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectType(key)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary-gradient text-white shadow-md'
                        : 'bg-background/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {SAMPLES[key].label}
                  </button>
                );
              })}
            </div>

            {/* Prompt */}
            <div className="border-b border-white/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prompt
              </p>
              <p className="mt-1 text-sm font-medium">{SAMPLES[active].prompt}</p>
            </div>

            {/* Output (typewriter) */}
            <div className="relative bg-zinc-950 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Generated content
                </span>
                {generating && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-violet-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating…
                  </span>
                )}
              </div>
              <pre className="mt-3 min-h-[180px] whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-emerald-300">
                {typed}
                {generating && (
                  <span className="ml-0.5 inline-block h-4 w-2 -translate-y-0.5 animate-pulse bg-emerald-300 align-middle" />
                )}
              </pre>
            </div>

            {/* Action */}
            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
              <p className="text-xs text-muted-foreground">
                This is a sample. Real output is tailored to your brand.
              </p>
              <motion.button
                type="button"
                onClick={() => selectType(active)}
                disabled={generating}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-gradient px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-60"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Generate
              </motion.button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default LiveDemo;
