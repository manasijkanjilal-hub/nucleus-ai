'use client';

// =============================================================================
// EmptyState — premium empty-state block with a gradient icon halo.
// Used across Campaigns, Context Vault, Notifications, and Generations.
// =============================================================================

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE, DURATION } from '@/lib/design-tokens';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional action node (e.g. a button) rendered below the description. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE.outExpo }}
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      {/* Gradient halo around the icon */}
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary-gradient opacity-20 blur-2xl" />
        <motion.div
          initial={{ scale: 0.85 }}
          animate={{ scale: 1 }}
          transition={{ duration: DURATION.slow, ease: EASE.outExpo }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-gradient text-white shadow-[0_10px_30px_-8px_rgba(139,92,246,0.5)]"
        >
          <Icon className="h-8 w-8" />
        </motion.div>
      </div>

      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export default EmptyState;
