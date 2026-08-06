'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

/**
 * ProfessionalEmptyState — premium onboarding empty state.
 *
 * Renders a centered icon inside a circular gradient badge (accent-tinted),
 * a headline, supporting copy, and up to two CTAs. Built for the GSTPilot
 * dark theme: never uses indigo/blue.
 *
 * Animation uses a slow ease-out curve for a confident, premium entrance.
 */

export type EmptyStateAccent =
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'violet'
  | 'amber'
  | 'rose';

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
  emerald: {
    badge: 'from-emerald-500/20 to-emerald-500/5',
    icon: 'text-emerald-300',
    ring: 'ring-emerald-400/20',
    button: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20',
    glow: 'bg-emerald-500/10',
    text: 'text-emerald-300 hover:text-emerald-200',
  },
  teal: {
    badge: 'from-teal-500/20 to-teal-500/5',
    icon: 'text-teal-300',
    ring: 'ring-teal-400/20',
    button: 'bg-teal-500 hover:bg-teal-400 text-teal-950 shadow-lg shadow-teal-500/20',
    glow: 'bg-teal-500/10',
    text: 'text-teal-300 hover:text-teal-200',
  },
  cyan: {
    badge: 'from-cyan-500/20 to-cyan-500/5',
    icon: 'text-cyan-300',
    ring: 'ring-cyan-400/20',
    button: 'bg-cyan-500 hover:bg-cyan-400 text-cyan-950 shadow-lg shadow-cyan-500/20',
    glow: 'bg-cyan-500/10',
    text: 'text-cyan-300 hover:text-cyan-200',
  },
  violet: {
    badge: 'from-emerald-500/20 to-emerald-500/5',
    icon: 'text-emerald-300',
    ring: 'ring-emerald-400/20',
    button: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20',
    glow: 'bg-emerald-500/10',
    text: 'text-emerald-300 hover:text-emerald-200',
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
    button: 'bg-rose-500 hover:bg-rose-400 text-rose-950 shadow-lg shadow-rose-500/20',
    glow: 'bg-rose-500/10',
    text: 'text-rose-300 hover:text-rose-200',
  },
};

export function ProfessionalEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  accent = 'emerald',
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
