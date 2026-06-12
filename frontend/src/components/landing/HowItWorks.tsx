'use client';

// =============================================================================
// Nucleus AI — Landing: HowItWorks
// =============================================================================
// Three-step process with numbered cards, an animated connecting line, and
// scroll-triggered slide-in animations.
// =============================================================================

import { motion } from 'framer-motion';
import { Upload, MousePointerClick, Wand2 } from 'lucide-react';

import { Reveal } from './Reveal';

const STEPS = [
  {
    icon: Upload,
    title: 'Upload brand documents',
    description:
      'Drop your brand guidelines, tone docs, and product info into the Context Vault.',
    tone: 'from-indigo-500 to-violet-500',
  },
  {
    icon: MousePointerClick,
    title: 'Select content type',
    description:
      'Choose from 8+ formats — ads, emails, posts, blogs — and your AI provider.',
    tone: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Wand2,
    title: 'AI generates content',
    description:
      'Get polished, on-brand content in seconds. Edit, export, and ship instantly.',
    tone: 'from-violet-500 to-fuchsia-500',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
            How it works
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From brand to content in{' '}
            <span className="text-gradient">three steps</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No prompt engineering. No off-brand misfires. Just results.
          </p>
        </Reveal>

        <div className="relative mt-16">
          {/* Animated connecting line (desktop) */}
          <motion.div
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
            className="absolute left-0 right-0 top-9 hidden h-0.5 origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 md:block"
          />

          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <Reveal
                  key={step.title}
                  direction={idx === 0 ? 'right' : idx === 2 ? 'left' : 'up'}
                  delay={idx * 0.15}
                  className="relative text-center"
                >
                  <div className="relative z-10 flex justify-center">
                    <span
                      className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br ${step.tone} text-white shadow-xl`}
                    >
                      <Icon className="h-8 w-8" />
                      <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-foreground text-xs font-bold text-background">
                        {idx + 1}
                      </span>
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
