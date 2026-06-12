'use client';

// =============================================================================
// Nucleus AI — Landing: ScrollProgress
// =============================================================================
// Thin gradient bar fixed to the top of the viewport that fills as the user
// scrolls down the page.
// =============================================================================

import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400"
    />
  );
}

export default ScrollProgress;
