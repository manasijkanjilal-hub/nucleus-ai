'use client';

// =============================================================================
// Nucleus AI — Landing: Pricing
// =============================================================================
// Four pricing tiers sourced from the shared PLANS config. Monthly/annual
// toggle (annual = ~20% off), highlighted "Most Popular" plan, animated price
// numbers, hover scale, and gradient CTAs.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

import { PLANS, PLAN_ORDER, type PlanId } from '@/lib/plans';
import { Reveal } from './Reveal';

const POPULAR: PlanId = 'PRO';
const ANNUAL_DISCOUNT = 0.2; // 20% off when billed annually

function priceLabel(
  price: number | null,
  billing: 'monthly' | 'annual'
): { amount: string; suffix: string } {
  if (price === null) return { amount: 'Custom', suffix: '' };
  if (price === 0) return { amount: '$0', suffix: '/mo' };
  const monthly =
    billing === 'annual' ? Math.round(price * (1 - ANNUAL_DISCOUNT)) : price;
  return { amount: `$${monthly}`, suffix: '/mo' };
}

export function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  return (
    <section id="pricing" className="relative py-24">
      <div className="absolute inset-0 -z-10 bg-mesh opacity-60" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-fuchsia-500">
            Pricing
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, <span className="text-gradient">transparent</span> pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {(['monthly', 'annual'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setBilling(opt)}
                className="relative rounded-full px-5 py-2 text-sm font-medium transition-colors"
              >
                {billing === opt && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 rounded-full bg-primary-gradient"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 ${
                    billing === opt ? 'text-white' : 'text-muted-foreground'
                  }`}
                >
                  {opt === 'monthly' ? 'Monthly' : 'Annual'}
                  {opt === 'annual' && (
                    <span
                      className={`ml-1.5 ${
                        billing === opt ? 'text-white/90' : 'text-emerald-500'
                      }`}
                    >
                      −20%
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-4">
          {PLAN_ORDER.map((id, idx) => {
            const plan = PLANS[id as PlanId];
            const popular = id === POPULAR;
            const { amount, suffix } = priceLabel(plan.price, billing);
            return (
              <Reveal key={id} delay={idx * 0.08} direction="up">
                <motion.div
                  whileHover={{ y: -8, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className={`relative flex h-full flex-col rounded-2xl border p-6 ${
                    popular
                      ? 'border-transparent gradient-border bg-card shadow-2xl glow-primary'
                      : 'border-border bg-card'
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary-gradient px-3 py-1 text-xs font-semibold text-white shadow-md">
                      <Sparkles className="h-3.5 w-3.5" />
                      Most Popular
                    </span>
                  )}

                  <h3 className="text-lg font-semibold">{plan.name}</h3>

                  <div className="mt-4 flex items-end gap-1">
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={`${id}-${billing}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="text-4xl font-extrabold tracking-tight"
                      >
                        {amount}
                      </motion.span>
                    </AnimatePresence>
                    {suffix && (
                      <span className="mb-1 text-sm text-muted-foreground">
                        {suffix}
                      </span>
                    )}
                  </div>
                  {billing === 'annual' && plan.price ? (
                    <p className="mt-1 text-xs text-emerald-500">
                      billed annually
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-transparent select-none">.</p>
                  )}

                  <Link
                    href={plan.price === null ? '/signup?plan=enterprise' : '/signup'}
                    className={`mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03] ${
                      popular
                        ? 'bg-primary-gradient text-white shadow-md'
                        : 'border border-border bg-background hover:bg-muted'
                    }`}
                  >
                    {plan.price === null ? 'Contact Sales' : 'Get Started'}
                  </Link>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Pricing;
