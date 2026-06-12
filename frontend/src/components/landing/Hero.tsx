'use client';

// =============================================================================
// Nucleus AI — Landing: Hero
// =============================================================================
// Above-the-fold hero with an animated aurora/mesh gradient background, drifting
// blobs, a particle field, an animated gradient headline, dual CTAs, floating
// example cards, and trust badges.
// =============================================================================

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play, Check, Bot, Zap } from 'lucide-react';

import { Particles } from './Particles';

const PROVIDERS = ['OpenAI', 'Gemini', 'Claude'];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* Animated background layers */}
      <div className="absolute inset-0 -z-10 bg-aurora" />
      <div className="absolute inset-0 -z-10 bg-mesh opacity-70" />
      <div
        aria-hidden
        className="absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl animate-blob"
      />
      <div
        aria-hidden
        className="absolute -right-20 top-40 -z-10 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl animate-blob"
        style={{ animationDelay: '4s' }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl animate-blob"
        style={{ animationDelay: '8s' }}
      />
      <Particles count={30} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl text-center"
        >
          {/* Eyebrow badge */}
          <motion.div variants={itemVariants} className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-foreground/80 backdrop-blur">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI-powered marketing content, on brand every time
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl"
          >
            Transform Your Marketing
            <br />
            with <span className="text-gradient-animated">AI</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            Generate brand-perfect content in seconds. Powered by{' '}
            <span className="font-semibold text-foreground">OpenAI</span>,{' '}
            <span className="font-semibold text-foreground">Gemini</span>, and{' '}
            <span className="font-semibold text-foreground">Claude</span>.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-7 py-3.5 text-base font-semibold text-white animate-pulse-glow glow-primary transition-transform hover:scale-[1.04]"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-7 py-3.5 text-base font-semibold text-foreground backdrop-blur transition-colors hover:bg-muted"
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            variants={itemVariants}
            className="mt-8 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground sm:flex-row sm:gap-6"
          >
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              10 free generations
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              Cancel anytime
            </span>
          </motion.div>
        </motion.div>

        {/* Floating example cards */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="glass gradient-border relative rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-xs font-medium text-muted-foreground">
                Nucleus AI — Campaign Generator
              </span>
            </div>
            <div className="grid gap-4 pt-5 sm:grid-cols-3">
              {[
                { icon: Bot, label: 'Instagram Ad', tone: 'from-indigo-500 to-violet-500' },
                { icon: Zap, label: 'Email Subject', tone: 'from-cyan-500 to-blue-500' },
                { icon: Sparkles, label: 'Blog Intro', tone: 'from-violet-500 to-fuchsia-500' },
              ].map((c, i) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.label}
                    className="rounded-xl border border-white/10 bg-background/50 p-4"
                  >
                    <span
                      className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${c.tone} text-white`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold">{c.label}</p>
                    <div className="mt-2 space-y-1.5">
                      <span className="block h-2 w-full rounded bg-muted" />
                      <span className="block h-2 w-4/5 rounded bg-muted" />
                      <span className="block h-2 w-2/3 rounded bg-muted" />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Floating chips */}
          <motion.div
            className="absolute -left-6 -top-6 hidden rounded-xl border border-white/20 bg-background/80 px-4 py-2 text-sm font-semibold shadow-xl backdrop-blur sm:block animate-float"
          >
            ⚡ 8+ content types
          </motion.div>
          <motion.div
            className="absolute -right-6 bottom-8 hidden rounded-xl border border-white/20 bg-background/80 px-4 py-2 text-sm font-semibold shadow-xl backdrop-blur sm:block animate-float-slow"
          >
            🎯 100% on-brand
          </motion.div>
        </div>

        {/* Provider strip */}
        <div className="mt-14 flex flex-col items-center gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Powered by the world&apos;s best models
          </p>
          <div className="flex items-center gap-6">
            {PROVIDERS.map((p) => (
              <span
                key={p}
                className="text-lg font-bold text-muted-foreground/70"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
