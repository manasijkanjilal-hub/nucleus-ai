'use client';

// =============================================================================
// Nucleus AI — Landing: Features
// =============================================================================
// Three-column grid of feature cards that fade/stagger into view on scroll and
// lift + glow on hover.
// =============================================================================

import { motion } from 'framer-motion';
import {
  Bot,
  FolderLock,
  Zap,
  BarChart3,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';

import { Reveal } from './Reveal';

const FEATURES = [
  {
    icon: Bot,
    title: 'Multi-AI Provider Support',
    description:
      'Switch seamlessly between OpenAI, Gemini, and Claude. Always get the best model for the job.',
    tone: 'from-indigo-500 to-violet-500',
  },
  {
    icon: FolderLock,
    title: 'Context Vault',
    description:
      'Upload brand documents once. Every generation stays perfectly on-brand, automatically.',
    tone: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Zap,
    title: '8+ Content Types',
    description:
      'Ads, social posts, emails, blogs, and more — generated in seconds, ready to ship.',
    tone: 'from-amber-500 to-orange-500',
  },
  {
    icon: BarChart3,
    title: 'Usage Analytics',
    description:
      'Track generations, cost by provider, and content trends with rich, exportable analytics.',
    tone: 'from-emerald-500 to-teal-500',
  },
  {
    icon: DollarSign,
    title: 'Flexible Pricing',
    description:
      'Start free, scale as you grow. Transparent plans for solo marketers to enterprises.',
    tone: 'from-fuchsia-500 to-pink-500',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    description:
      'Role-based access, audit logs, and configurable feature flags built for teams.',
    tone: 'from-violet-500 to-indigo-500',
  },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-violet-500">
            Features
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to create{' '}
            <span className="text-gradient">winning content</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete AI content platform — from brand knowledge to published
            campaigns.
          </p>
        </Reveal>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                whileHover={{ y: -6 }}
                className="group relative rounded-2xl border border-border bg-card p-6 transition-shadow duration-300 hover:shadow-[0_20px_50px_-15px_rgba(99,102,241,0.35)]"
              >
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.tone} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                {/* glow accent */}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

export default Features;
