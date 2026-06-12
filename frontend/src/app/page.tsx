// =============================================================================
// Nucleus AI — Marketing Landing Page (root route)
// =============================================================================
// Immersive, conversion-focused landing page. Above-the-fold sections (navbar +
// hero) load eagerly; below-the-fold sections are code-split via next/dynamic so
// the initial payload stays light. The authenticated app continues to live at
// /dashboard, /campaigns, etc.
// =============================================================================

import dynamic from 'next/dynamic';

import { Navbar } from '@/components/landing/Navbar';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { Hero } from '@/components/landing/Hero';

// Below-the-fold sections — code-split (still server-rendered for SEO).
const Features = dynamic(() =>
  import('@/components/landing/Features').then((m) => m.Features)
);
const LiveDemo = dynamic(() =>
  import('@/components/landing/LiveDemo').then((m) => m.LiveDemo)
);
const HowItWorks = dynamic(() =>
  import('@/components/landing/HowItWorks').then((m) => m.HowItWorks)
);
const Stats = dynamic(() =>
  import('@/components/landing/Stats').then((m) => m.Stats)
);
const Pricing = dynamic(() =>
  import('@/components/landing/Pricing').then((m) => m.Pricing)
);
const Testimonials = dynamic(() =>
  import('@/components/landing/Testimonials').then((m) => m.Testimonials)
);
const CTA = dynamic(() => import('@/components/landing/CTA').then((m) => m.CTA));
const Footer = dynamic(() =>
  import('@/components/landing/Footer').then((m) => m.Footer)
);

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <ScrollProgress />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <LiveDemo />
        <HowItWorks />
        <Stats />
        <Pricing />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
