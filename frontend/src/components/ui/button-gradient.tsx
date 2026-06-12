'use client';

// =============================================================================
// Nucleus AI — Gradient Button
// =============================================================================
// Premium gradient button with hover scale, click ripple, and loading state.
// Variants: primary (indigo→purple), accent (cyan→blue), success, danger.
// =============================================================================

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const gradientButtonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg text-sm font-medium whitespace-nowrap text-white shadow-sm outline-none transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400 disabled:pointer-events-none disabled:opacity-60 hover:scale-[1.02] active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        primary:
          'bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_100%)] hover:shadow-[0_8px_24px_-6px_rgba(139,92,246,0.6)]',
        accent:
          'bg-[linear-gradient(135deg,#06b6d4_0%,#3b82f6_100%)] hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.6)]',
        success:
          'bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] hover:shadow-[0_8px_24px_-6px_rgba(16,185,129,0.6)]',
        danger:
          'bg-[linear-gradient(135deg,#ef4444_0%,#dc2626_100%)] hover:shadow-[0_8px_24px_-6px_rgba(239,68,68,0.6)]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-5',
        lg: 'h-12 px-7 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
);

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
  loading?: boolean;
  /** Adds a pulsing glow ring to draw attention. */
  pulse?: boolean;
}

export const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  function GradientButton(
    { className, variant, size, loading, pulse, children, onClick, disabled, ...props },
    ref
  ) {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const id = Date.now();
      setRipples((prev) => [
        ...prev,
        { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size },
      ]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(gradientButtonVariants({ variant, size, className }), pulse && 'animate-pulse-glow')}
        {...props}
      >
        {ripples.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute animate-[nucleus-scale-in_0.6s_ease-out] rounded-full bg-white/30"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          />
        ))}
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

export default GradientButton;
