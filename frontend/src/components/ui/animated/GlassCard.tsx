'use client';

// Glassmorphism card with optional hover-lift and gradient border.
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  /** Adds an animated lift + shadow on hover. */
  hover?: boolean;
  /** Adds a subtle gradient border. */
  gradient?: boolean;
}

export function GlassCard({
  children,
  className,
  hover = true,
  gradient = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={cn(
        'glass rounded-xl shadow-sm',
        gradient && 'gradient-border',
        hover && 'transition-shadow hover:shadow-[0_12px_32px_-8px_rgba(99,102,241,0.25)]',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default GlassCard;
