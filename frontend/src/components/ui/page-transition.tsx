'use client';

// =============================================================================
// PageTransition — subtle fade/slide between routes using AnimatePresence.
// Keyed on the pathname so each navigation re-mounts and animates.
// Kept intentionally short (150ms) and subtle per the design system.
// =============================================================================

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { DURATION, EASE } from '@/lib/design-tokens';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: DURATION.fast, ease: EASE.inOut }}
        className="flex flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default PageTransition;
