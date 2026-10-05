'use client';

/**
 * UI Pro Max™ — Premium primitive library
 * ---------------------------------------------------------------------------
 * Extracted from github.com/nextlevelbuilder/ui-ux-pro-max-skill design
 * intelligence. Pure enhancement layer — uses CSS utilities defined in
 * globals.css ("UI PRO MAX™ ENHANCEMENT LAYER").
 *
 * These components are ADDITIVE. They do not replace shadcn/ui or any
 * existing component. They are available for opt-in use across the app
 * and impose zero behaviour change on existing code.
 * ---------------------------------------------------------------------------
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   ProButton — white CTA with scale-press micro-interaction
   ════════════════════════════════════════════════════════════════════════ */

type ProButtonVariant = 'primary' | 'glass' | 'ghost' | 'accent';
type ProButtonSize = 'sm' | 'md' | 'lg';

const proButtonVariants: Record<ProButtonVariant, string> = {
  // White-on-black CTA (theme spec) with press-scale + premium easing
  primary:
    'bg-white text-black hover:bg-white/90 press-scale glow-accent-btn rounded-full font-semibold',
  // Glass secondary
  glass:
    'glass-surface text-white hover:bg-white/10 press-scale rounded-full font-semibold',
  // Ghost (text only)
  ghost:
    'text-white/70 hover:text-white hover:bg-white/5 rounded-lg font-medium transition-colors',
  // Blue accent (theme spec #3B82F6)
  accent:
    'bg-[#3B82F6] text-white hover:bg-[#2563EB] press-scale glow-accent-btn rounded-full font-semibold',
};

const proButtonSizes: Record<ProButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-7 py-3.5 text-base gap-2',
};

export interface ProButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ProButtonVariant;
  size?: ProButtonSize;
}

export const ProButton = React.forwardRef<HTMLButtonElement, ProButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        proButtonVariants[variant],
        proButtonSizes[size],
        className,
      )}
      {...props}
    />
  ),
);
ProButton.displayName = 'ProButton';

/* ════════════════════════════════════════════════════════════════════════
   ProCard — glass surface with hover-lift + premium border
   ════════════════════════════════════════════════════════════════════════ */

export interface ProCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  strong?: boolean;
}

export const ProCard = React.forwardRef<HTMLDivElement, ProCardProps>(
  ({ className, hover = true, strong = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        strong ? 'glass-surface-strong' : 'glass-surface',
        'radius-premium shadow-premium',
        hover && 'hover-lift',
        className,
      )}
      {...props}
    />
  ),
);
ProCard.displayName = 'ProCard';

/* ════════════════════════════════════════════════════════════════════════
   ProSkeleton — shimmer skeleton loader
   ════════════════════════════════════════════════════════════════════════ */

export interface ProSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function ProSkeleton({ className, lines = 1, ...props }: ProSkeletonProps) {
  if (lines > 1) {
    return (
      <div className="space-y-2" {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-3"
            style={{ width: i === lines - 1 ? '70%' : '100%' }}
          />
        ))}
      </div>
    );
  }
  return <div className={cn('skeleton-shimmer h-3 w-full', className)} {...props} />;
}

/* ════════════════════════════════════════════════════════════════════════
   ProSpinner — premium loading spinner
   ════════════════════════════════════════════════════════════════════════ */

export function ProSpinner({ className, size }: { className?: string; size?: number }) {
  return (
    <span
      className={cn('spinner-premium inline-block', className)}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Loading"
      role="status"
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ProStatusDot — pulsing status indicator
   ════════════════════════════════════════════════════════════════════════ */

type ProStatus = 'live' | 'warn' | 'error';

const proStatusMap: Record<ProStatus, string> = {
  live: 'status-dot-live',
  warn: 'status-dot-warn',
  error: 'status-dot-error',
};

export function ProStatusDot({
  status = 'live',
  className,
}: {
  status?: ProStatus;
  className?: string;
}) {
  return (
    <span
      className={cn('status-dot', proStatusMap[status], className)}
      role="presentation"
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ProBadge — premium pill
   ════════════════════════════════════════════════════════════════════════ */

export function ProBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('badge-premium', className)}>{children}</span>;
}

/* ════════════════════════════════════════════════════════════════════════
   ProTable — premium dark table primitive
   (Wraps a native <table> with .table-premium styling)
   ════════════════════════════════════════════════════════════════════════ */

export function ProTable({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('table-premium', className)} {...props} />;
}

/* ════════════════════════════════════════════════════════════════════════
   ProDivider — gradient hairline divider
   ════════════════════════════════════════════════════════════════════════ */

export function ProDivider({ className }: { className?: string }) {
  return <hr className={cn('divider-premium my-6', className)} />;
}

/* ════════════════════════════════════════════════════════════════════════
   ProStat — financial stat block with tabular nums
   ════════════════════════════════════════════════════════════════════════ */

export function ProStat({
  label,
  value,
  delta,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  tone?: 'neutral' | 'bull' | 'bear';
  className?: string;
}) {
  const toneClass =
    tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-white';
  return (
    <div className={cn('rounded-2xl glass-surface p-4', className)}>
      <div className="text-[11px] uppercase tracking-wider text-white/45">{label}</div>
      <div className={cn('mt-1.5 text-2xl font-semibold tabular-nums', toneClass)}>{value}</div>
      {delta && <div className="mt-1 text-xs text-white/50">{delta}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Spring modal transition (Framer Motion config — Cinema: damping 20, stiffness 90)
   Exported as variants for opt-in use.
   ════════════════════════════════════════════════════════════════════════ */

export const springModalTransition = {
  type: 'spring' as const,
  damping: 20,
  stiffness: 90,
};

export const modalEnterVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 6 },
};

export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// Re-export AnimatedNumber from the dedicated module
export { AnimatedNumber } from './AnimatedNumber';

// Re-export PremiumEmptyState from the dedicated module
export { PremiumEmptyState } from './premium-empty-state';
export type { PremiumEmptyStateProps } from './premium-empty-state';

// Re-export premium form primitives (FormField / FormSection / FormActions)
export * from './form-field';

// Re-export DataTable + TableToolbar from the dedicated module
export { DataTable, TableToolbar } from './data-table';
export type { Column, DataTableProps } from './data-table';
