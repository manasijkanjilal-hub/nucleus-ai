// =============================================================================
// Nucleus AI — Design Tokens
// =============================================================================
// Single source of truth for the premium design system. These constants mirror
// the CSS custom properties / utility classes defined in `globals.css` so that
// TypeScript code (animations via framer-motion, inline styles, chart palettes)
// stays visually consistent with the Tailwind/CSS layer.
//
// Design decisions:
//   • Brand identity is an indigo → violet → cyan spectrum. Indigo (#6366f1) is
//     the primary action color; violet (#8b5cf6) adds depth; cyan (#06b6d4) is
//     the accent for highlights and data viz.
//   • Motion is subtle and physics-based. We standardize on a single easing
//     curve (`EASE_OUT_EXPO`) and three durations (fast / base / slow) so the
//     whole app feels cohesive. All motion respects `prefers-reduced-motion`
//     via the CSS guards in globals.css.
//   • Spacing & radii follow an 4px base scale to match Tailwind defaults.
// =============================================================================

/** Core brand palette (hex). Use for charts, gradients, and inline styles. */
export const COLORS = {
  primary: '#6366f1', // indigo-500 — primary actions
  primaryDark: '#4f46e5', // indigo-600
  violet: '#8b5cf6', // violet-500 — depth / secondary
  cyan: '#06b6d4', // cyan-500 — accent / highlights
  blue: '#3b82f6', // blue-500
  success: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  // Neutral ramp (used sparingly; prefer the CSS `--muted` tokens in components)
  ink: '#18181b', // zinc-900
  slate: '#64748b', // slate-500
} as const;

/** Gradient definitions — mirror the `--*-gradient` CSS variables. */
export const GRADIENTS = {
  primary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  accent: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  spectrum: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)',
} as const;

/** Chart palette (ordered) for recharts / data viz. */
export const CHART_PALETTE = [
  COLORS.primary,
  COLORS.cyan,
  COLORS.violet,
  COLORS.success,
  COLORS.warning,
  COLORS.blue,
] as const;

/** Spacing scale (px) — 4px base, matches Tailwind. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

/** Border radii (px) — matches the `--radius` ramp. */
export const RADII = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  '2xl': 18,
  full: 9999,
} as const;

/** Box shadows — soft, brand-tinted elevation. */
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
  md: '0 4px 16px -4px rgba(99,102,241,0.18)',
  lg: '0 12px 32px -8px rgba(99,102,241,0.25)',
  glow: '0 10px 40px -10px rgba(139,92,246,0.55)',
} as const;

/** Animation durations (seconds) for framer-motion. */
export const DURATION = {
  fast: 0.15,
  base: 0.3,
  slow: 0.5,
} as const;

/** Standard easing curves for framer-motion `transition.ease`. */
export const EASE = {
  /** Smooth, slightly snappy deceleration — the house easing. */
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
} as const;

/** Reusable framer-motion variants for staggered list/grid entrances. */
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE.outExpo },
  },
};

/** Standard hover-lift used on interactive cards. */
export const hoverLift = {
  y: -4,
  transition: { duration: DURATION.fast, ease: EASE.outExpo },
};

/**
 * Status → token map for badges (campaign / document / generic states).
 * Includes dark-mode variants so badges remain legible in both themes.
 */
export const STATUS_TOKENS: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: 'Draft',
    className:
      'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  ACTIVE: {
    label: 'Active',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  PAUSED: {
    label: 'Paused',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  },
  COMPLETED: {
    label: 'Completed',
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  },
  ARCHIVED: {
    label: 'Archived',
    className:
      'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
  },
} as const;

const designTokens = {
  COLORS,
  GRADIENTS,
  CHART_PALETTE,
  SPACING,
  RADII,
  SHADOWS,
  DURATION,
  EASE,
  staggerContainer,
  staggerItem,
  hoverLift,
  STATUS_TOKENS,
};

export default designTokens;
