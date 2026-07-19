'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
 * Visual styling is delegated to the `.premium-empty` CSS class in
 * globals.css ("PREMIUM EMPTY STATES" section) — 56px icon chip, 18px title,
 * 13px muted description, centered column, calm 220ms fade-in. The `tone`
 * prop tints the icon chip so color cues (e.g. amber for warnings) still
 * work without breaking the shared layout.
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

/**
 * Tone-specific overrides layered on top of the base `.empty-icon` chip.
 * `default` keeps the neutral chip from globals.css; the others tint the
 * background and icon color while preserving the shared premium layout.
 */
const toneIconChip: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  default: '',
  emerald: 'bg-emerald-500/10 border-emerald-500/20',
  amber: 'bg-amber-500/10 border-amber-500/20',
  cyan: 'bg-cyan-500/10 border-cyan-500/20',
};

const toneIconColor: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  default: '',
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
      className={cn('premium-empty', compact && 'min-h-[160px] py-8')}
    >
      <div className={cn('empty-icon', toneIconChip[tone])}>
        <Icon className={cn('h-6 w-6', toneIconColor[tone])} />
      </div>
      <div className="flex flex-col items-center space-y-2">
        <h3 className="empty-title">{title}</h3>
        <p className="empty-desc">{description}</p>
      </div>
      {(primaryLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {secondaryLabel && onSecondary && (
            <Button size="sm" variant="outline" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
          {primaryLabel && onPrimary && (
            <Button size="sm" onClick={onPrimary}>
              {primaryLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default EmptyState;
