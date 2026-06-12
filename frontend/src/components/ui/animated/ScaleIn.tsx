'use client';

// Scale-up entrance animation using Framer Motion spring.
import { motion, type HTMLMotionProps } from 'framer-motion';

interface ScaleInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  from?: number;
}

export function ScaleIn({ children, delay = 0, from = 0.92, ...props }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: from }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default ScaleIn;
