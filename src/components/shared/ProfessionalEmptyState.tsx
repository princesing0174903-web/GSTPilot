'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

/**
 * ProfessionalEmptyState — premium onboarding empty state.
 *
 * Renders a centered icon inside a circular gradient badge (accent-tinted),
 * a headline, supporting copy, and up to two CTAs. Built for the VEYRO
 * enterprise dark theme: blue (#2563EB) accent, pure black surfaces.
 *
 * Animation uses a slow ease-out curve for a confident, premium entrance.
 */

export type EmptyStateAccent =
  | 'blue'
  | 'amber'
  | 'rose'
  | 'neutral';

interface ProfessionalEmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}

interface ProfessionalEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ProfessionalEmptyStateAction;
  secondaryAction?: ProfessionalEmptyStateAction;
  accent?: EmptyStateAccent;
  /**
   * Compact variant — smaller padding & icon, useful when the empty state
   * lives inside a card body rather than a full page.
   */
  compact?: boolean;
  className?: string;
}

const ACCENT_MAP: Record<
  EmptyStateAccent,
  {
    /** gradient stops for the icon badge background */
    badge: string;
    /** icon color */
    icon: string;
    /** ring / border tint around the badge */
    ring: string;
    /** primary CTA button background (hover + base) */
    button: string;
    /** soft glow behind the badge */
    glow: string;
    /** secondary text accent (used for the secondary link) */
    text: string;
  }
> = {
  blue: {
    badge: 'from-blue-500/20 to-blue-500/5',
    icon: 'text-blue-300',
    ring: 'ring-blue-400/20',
    button: 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20',
    glow: 'bg-blue-500/10',
    text: 'text-blue-300 hover:text-blue-200',
  },
  amber: {
    badge: 'from-amber-500/20 to-amber-500/5',
    icon: 'text-amber-300',
    ring: 'ring-amber-400/20',
    button: 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/20',
    glow: 'bg-amber-500/10',
    text: 'text-amber-300 hover:text-amber-200',
  },
  rose: {
    badge: 'from-rose-500/20 to-rose-500/5',
    icon: 'text-rose-300',
    ring: 'ring-rose-400/20',
    button: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/20',
    glow: 'bg-rose-500/10',
    text: 'text-rose-300 hover:text-rose-200',
  },
  neutral: {
    badge: 'from-zinc-500/20 to-zinc-500/5',
    icon: 'text-zinc-300',
    ring: 'ring-zinc-400/20',
    button: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground shadow-lg',
    glow: 'bg-zinc-500/10',
    text: 'text-zinc-300 hover:text-zinc-200',
  },
};

export function ProfessionalEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  accent = 'blue',
  compact = false,
  className = '',
}: ProfessionalEmptyStateProps) {
  const palette = ACCENT_MAP[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-10 px-4' : 'py-16 px-6'
      } ${className}`}
    >
      {/* ─── Icon badge with soft gradient + glow ─── */}
      <div className="relative mb-5">
        {/* glow */}
        <div
          aria-hidden
          className={`absolute inset-0 -z-10 rounded-full blur-2xl ${palette.glow} ${
            compact ? 'scale-100' : 'scale-125'
          }`}
        />
        <div
          className={`relative flex items-center justify-center rounded-full bg-gradient-to-br ${palette.badge} ring-1 ${palette.ring} ${
            compact ? 'h-12 w-12' : 'h-16 w-16'
          }`}
        >
          <Icon className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} ${palette.icon}`} strokeWidth={1.75} />
        </div>
      </div>

      {/* ─── Copy ─── */}
      <h3
        className={`font-semibold tracking-tight text-white ${
          compact ? 'text-sm' : 'text-base sm:text-lg'
        }`}
      >
        {title}
      </h3>
      <p
        className={`mt-2 max-w-sm text-zinc-400 ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        {description}
      </p>

      {/* ─── CTAs ─── */}
      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
          className="mt-6 flex flex-col items-center gap-3 sm:flex-row"
        >
          {action && (
            <Button
              size={compact ? 'sm' : 'default'}
              onClick={action.onClick}
              className={`${palette.button} transition-all hover:scale-[1.02] active:scale-[0.98] gap-1.5`}
            >
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={`text-xs font-medium underline-offset-4 transition-colors hover:underline ${palette.text} ${
                compact ? 'text-[11px]' : ''
              }`}
            >
              {secondaryAction.label}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default ProfessionalEmptyState;
