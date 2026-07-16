'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Home — Professional Empty State
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Every empty state on the Home page uses this component. Per the stabilization
 * directive (STEP 12): Illustration + Explanation + Primary Button + optional
 * Secondary Button. Never blank, never misleading.
 *
 * Used by:
 *   - KPI cards (Revenue / Cash / Compliance) when no underlying data exists
 *   - AI Recommendations when Oracle has no business data yet
 *   - Ask Oracle when Oracle is not activated
 *   - Timeline / Team / Tasks when collections are empty
 */

export interface EmptyStateProps {
  /** Lucide icon used as the illustration */
  icon: LucideIcon;
  /** Short headline, e.g. "No financial data connected" */
  title: string;
  /** One-line explanation, e.g. "Connect GSTN and Banking to calculate live revenue." */
  description: string;
  /** Primary CTA label */
  primaryLabel?: string;
  /** Primary CTA handler */
  onPrimary?: () => void;
  /** Secondary CTA label */
  secondaryLabel?: string;
  /** Secondary CTA handler */
  onSecondary?: () => void;
  /** Compact variant for in-card usage (smaller icon, less padding) */
  compact?: boolean;
  /** Tone of the icon chip */
  tone?: 'default' | 'emerald' | 'amber' | 'cyan';
}

const toneClasses: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  default: 'accent-gradient-soft',
  emerald: 'bg-emerald-500/10 border border-emerald-500/20',
  amber: 'bg-amber-500/10 border border-amber-500/20',
  cyan: 'bg-cyan-500/10 border border-cyan-500/20',
};

const toneIcon: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  default: 'accent-text',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  cyan: 'text-cyan-400',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  compact = false,
  tone = 'default',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' as const }}
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-6 px-4' : 'py-10 px-4'
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-2xl ${toneClasses[tone]} ${
          compact ? 'h-10 w-10' : 'h-14 w-14'
        } mb-3`}
      >
        <Icon className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} ${toneIcon[tone]}`} />
      </div>
      <h4
        className={`font-semibold text-foreground tracking-tight ${
          compact ? 'text-sm' : 'text-base'
        }`}
      >
        {title}
      </h4>
      <p
        className={`text-muted-foreground mt-1.5 leading-relaxed max-w-[280px] ${
          compact ? 'text-[11px]' : 'text-xs'
        }`}
      >
        {description}
      </p>
      {(primaryLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {primaryLabel && onPrimary && (
            <Button
              size="sm"
              onClick={onPrimary}
              className="accent-gradient text-white hover:opacity-90 gap-1.5 h-8"
            >
              {primaryLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSecondary}
              className="border-border gap-1.5 h-8"
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default EmptyState;
