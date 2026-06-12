'use client';

// =============================================================================
// Nucleus AI — Landing: Footer
// =============================================================================
// Site footer with logo, link columns, social icons, legal links, and a
// gradient top border.
// =============================================================================

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import {
  IconBrandX,
  IconBrandLinkedin,
  IconBrandGithub,
} from '@tabler/icons-react';

const LINK_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Demo', href: '#demo' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'How it Works', href: '#how-it-works' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Sign up', href: '/signup' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
];

const SOCIALS = [
  { icon: IconBrandX, href: '#', label: 'X' },
  { icon: IconBrandLinkedin, href: '#', label: 'LinkedIn' },
  { icon: IconBrandGithub, href: '#', label: 'GitHub' },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-background">
      {/* Gradient top border */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight">Nucleus AI</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Brand-perfect marketing content in seconds — powered by OpenAI,
              Gemini, and Claude.
            </p>
            <div className="mt-6 flex gap-3">
              {SOCIALS.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-violet-500/50 hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {LINK_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Nucleus AI. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
