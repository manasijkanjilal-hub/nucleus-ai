'use client';

// =============================================================================
// Nucleus AI — Landing: Reveal
// =============================================================================
// Scroll-triggered reveal wrapper. Fades + slides children into view the first
// time they enter the viewport. Supports directional entrance and stagger delay.
// =============================================================================

import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

const OFFSET = 40;

function offsetFor(direction: Direction): { x: number; y: number } {
  switch (direction) {
    case 'up':
      return { x: 0, y: OFFSET };
    case 'down':
      return { x: 0, y: -OFFSET };
    case 'left':
      return { x: OFFSET, y: 0 };
    case 'right':
      return { x: -OFFSET, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

export interface RevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
  /** Re-trigger every time it enters view (default: once). */
  repeat?: boolean;
  amount?: number;
}

export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  className,
  repeat = false,
  amount = 0.2,
}: RevealProps) {
  const { x, y } = offsetFor(direction);

  const variants: Variants = {
    hidden: { opacity: 0, x, y },
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: !repeat, amount }}
    >
      {children}
    </motion.div>
  );
}

// Container + item for staggered groups -------------------------------------

export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  amount?: number;
}) {
  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  direction = 'up',
}: {
  children: ReactNode;
  className?: string;
  direction?: Direction;
}) {
  const { x, y } = offsetFor(direction);
  const item: Variants = {
    hidden: { opacity: 0, x, y },
    show: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
    },
  };
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

export default Reveal;
