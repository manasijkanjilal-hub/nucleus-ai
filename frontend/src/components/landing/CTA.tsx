'use client';

// =============================================================================
// Nucleus AI — Landing: CTA
// =============================================================================
// Bold final call-to-action on a gradient/mesh band with drifting blobs.
// =============================================================================

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Reveal } from './Reveal';
import { Particles } from './Particles';

export function CTA() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-primary-gradient px-8 py-16 text-center shadow-2xl sm:px-16">
            {/* decorative layers */}
            <div className="absolute inset-0 bg-aurora opacity-40 mix-blend-overlay" />
            <div
              aria-hidden
              className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/20 blur-3xl animate-blob"
            />
            <div
              aria-hidden
              className="absolute -bottom-12 -right-8 h-56 w-56 rounded-full bg-white/15 blur-3xl animate-blob"
              style={{ animationDelay: '5s' }}
            />
            <Particles count={18} />

            <div className="relative">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Ready to transform your marketing?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
                Join marketers creating brand-perfect content in seconds.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-indigo-600 shadow-lg transition-transform hover:scale-[1.04]"
                >
                  Start Free Trial
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/80">
                No credit card required • 10 free generations
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default CTA;
