'use client';

// Slide-in wrapper using Framer Motion spring animation.
import { motion, type HTMLMotionProps } from 'framer-motion';

type Direction = 'up' | 'down' | 'left' | 'right';

interface SlideInProps extends HTMLMotionProps<'div'> {
  direction?: Direction;
  delay?: number;
  distance?: number;
}

const offsets: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  down: { x: 0, y: -24 },
  left: { x: 24, y: 0 },
  right: { x: -24, y: 0 },
};

export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  distance,
  ...props
}: SlideInProps) {
  const base = offsets[direction];
  const from = distance
    ? { x: base.x === 0 ? 0 : Math.sign(base.x) * distance, y: base.y === 0 ? 0 : Math.sign(base.y) * distance }
    : base;

  return (
    <motion.div
      initial={{ opacity: 0, ...from }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default SlideIn;
