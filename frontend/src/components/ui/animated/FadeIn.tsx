'use client';

// Fade-in wrapper using Framer Motion. Optionally staggers children.
import { motion, type HTMLMotionProps } from 'framer-motion';

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  duration?: number;
  /** When true, children animate in sequence (use FadeInItem for each child). */
  stagger?: boolean;
  staggerDelay?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  stagger = false,
  staggerDelay = 0.08,
  ...props
}: FadeInProps) {
  if (stagger) {
    return (
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: staggerDelay, delayChildren: delay } },
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Child element for a staggered FadeIn container. */
export function FadeInItem({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default FadeIn;
