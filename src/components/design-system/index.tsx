'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity™ — Unified UI Primitives
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Every page in GSTPilot uses these primitives. This guarantees:
 *   • Same card padding / radius / shadow / title size everywhere
 *   • Same empty states (illustration + explanation + CTA)
 *   • Same loading states (skeleton shimmer)
 *   • Same error states (friendly message + Retry + View Details)
 *   • Same page headers (title + subtitle + breadcrumb + actions)
 *   • Same tables (header, row height, hover, pagination)
 *
 * NO page is allowed to roll its own card / empty / loading / error state.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { typography, cardSpec, statusColors, type StatusTone } from './tokens';

// ═══════════════════════════════════════════════════════════════════════════════
// PageHeader — every page starts with this. Title + subtitle + breadcrumb + actions
// ═══════════════════════════════════════════════════════════════════════════════

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-3"
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}>
                  {crumb.label}
                </span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3 opacity-50" />}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className={cn(cardSpec.iconChip, 'h-10 w-10')}>
              <Icon className="h-5 w-5 accent-text" />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <h1 className={typography.h1}>{title}</h1>
            {subtitle && <p className={typography.bodyMuted}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UnifiedCard — the ONE card component. Same padding, radius, shadow, title.
// ═══════════════════════════════════════════════════════════════════════════════

export interface UnifiedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  padding?: 'default' | 'compact' | 'none';
  hover?: boolean;
  index?: number;
  children: React.ReactNode;
}

export function UnifiedCard({
  title,
  subtitle,
  icon: Icon,
  actionLabel,
  onAction,
  padding = 'default',
  hover = true,
  index = 0,
  className,
  children,
  ...props
}: UnifiedCardProps) {
  const padClass = padding === 'default' ? cardSpec.padding : padding === 'compact' ? cardSpec.paddingCompact : '';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
      className="h-full"
      {...props}
    >
      <div className={cn(cardSpec.base, 'h-full flex flex-col', hover && 'hover-lift', className)}>
        {(title || actionLabel) && (
          <div className={cn(cardSpec.header, padding === 'compact' ? 'px-4 pt-4' : 'px-6 pt-6')}>
            <div className="flex items-center gap-2.5 min-w-0">
              {Icon && (
                <div className={cardSpec.iconChip}>
                  <Icon className="h-4 w-4 accent-text" />
                </div>
              )}
              <div className="min-w-0">
                {title && <h3 className={cardSpec.title}>{title}</h3>}
                {subtitle && <p className={cardSpec.subtitle}>{subtitle}</p>}
              </div>
            </div>
            {actionLabel && onAction && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAction}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                {actionLabel}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        )}
        <div className={cn('flex-1 min-h-0', padClass, title && 'pt-0')}>{children}</div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KpiCard — standardized KPI metric card with count-up + empty state CTA
// ═══════════════════════════════════════════════════════════════════════════════

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  subtitle: string;
  icon: LucideIcon;
  index?: number;
  tone?: StatusTone;
  ctaLabel?: string;
  onCta?: () => void;
}

export function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  index = 0,
  tone = 'neutral',
  ctaLabel,
  onCta,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
      className="h-full"
    >
      <div className={cn(cardSpec.base, cardSpec.padding, 'h-full transition-shadow hover-lift')}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className={typography.label}>{label}</p>
            <p className={typography.stat}>{value}</p>
            <p className={typography.caption}>{subtitle}</p>
            {ctaLabel && onCta && (
              <button
                type="button"
                onClick={onCta}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold accent-text hover:opacity-80 transition-opacity"
              >
                {ctaLabel}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className={cn(cardSpec.iconChip, 'h-10 w-10')}>
            <Icon className="h-4 w-4 accent-text" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UnifiedEmptyState — illustration + explanation + CTA. Never blank.
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
  tone?: StatusTone;
}

export function UnifiedEmptyState({
  icon: Icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  compact = false,
  tone = 'neutral',
}: EmptyStateProps) {
  const t = statusColors[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-12 px-4',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl mb-4',
          t.bg,
          t.border,
          'border',
          compact ? 'h-12 w-12' : 'h-16 w-16',
        )}
      >
        <Icon className={cn(compact ? 'h-5 w-5' : 'h-6 w-6', t.text)} />
      </div>
      <h4 className={cn(typography.h3, compact && 'text-sm')}>{title}</h4>
      <p
        className={cn(
          typography.bodyMuted,
          'mt-2 max-w-[320px]',
          compact && 'text-xs',
        )}
      >
        {description}
      </p>
      {(primaryLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
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

// ═══════════════════════════════════════════════════════════════════════════════
// UnifiedLoadingState — skeleton shimmer. Never a blank page.
// ═══════════════════════════════════════════════════════════════════════════════

export function UnifiedLoadingState({
  variant = 'cards',
  count = 3,
}: {
  variant?: 'cards' | 'list' | 'full';
  count?: number;
}) {
  if (variant === 'full') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn(cardSpec.base, cardSpec.padding)}>
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={cn(cardSpec.base, cardSpec.padding)}>
              <Skeleton className="h-4 w-40 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-3 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn(cardSpec.base, cardSpec.padding)}>
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(cardSpec.base, cardSpec.padding)}>
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UnifiedErrorState — friendly message + Retry + View Details. Never raw error.
// ═══════════════════════════════════════════════════════════════════════════════

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  details?: string;
}

export function UnifiedErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  onDismiss,
  details,
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(cardSpec.base, 'p-8 flex flex-col items-center text-center max-w-md mx-auto')}
    >
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <h3 className={typography.h3}>{title}</h3>
      <p className={cn(typography.bodyMuted, 'mt-2 max-w-sm')}>{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="accent-gradient text-white hover:opacity-90 gap-1.5 h-8"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        {details && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDetails((v) => !v)}
            className="border-border gap-1.5 h-8"
          >
            View Details
          </Button>
        )}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="text-muted-foreground h-8"
          >
            Dismiss
          </Button>
        )}
      </div>
      {showDetails && details && (
        <pre className="mt-4 w-full text-left text-[10px] font-mono text-muted-foreground bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 overflow-x-auto">
          {details}
        </pre>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// StatusBadge — one badge system. tone-based, no random colors.
// ═══════════════════════════════════════════════════════════════════════════════

export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const t = statusColors[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        t.bg,
        t.border,
        t.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
      {children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DataTable — one table system. Same header, row height, hover, search.
// ═══════════════════════════════════════════════════════════════════════════════

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyCtaLabel?: string;
  onEmptyCta?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  maxHeight?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyTitle = 'No records found',
  emptyDescription = 'Records will appear here once they are created.',
  emptyIcon = Inbox,
  emptyCtaLabel,
  onEmptyCta,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  rowKey,
  onRowClick,
  maxHeight = '480px',
}: DataTableProps<T>) {
  return (
    <div className={cn(cardSpec.base, 'overflow-hidden')}>
      {onSearchChange && (
        <div className="border-b border-white/[0.06] p-4">
          <input
            type="text"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search…'}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-400/40 transition-all"
          />
        </div>
      )}
      <ScrollArea className="w-full" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-white/[0.03] backdrop-blur-xl">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-white/[0.08]"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 border-b border-white/[0.04]">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <UnifiedEmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    primaryLabel={emptyCtaLabel}
                    onPrimary={onEmptyCta}
                    compact
                  />
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors border-b border-white/[0.04] last:border-0',
                    onRowClick && 'cursor-pointer',
                    'hover:bg-white/[0.04]',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-sm text-foreground', col.className)}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PageContainer — standard page wrapper with consistent spacing + max width
// ═══════════════════════════════════════════════════════════════════════════════

export function PageContainer({
  children,
  className,
  maxWidth = 'max-w-7xl',
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  return (
    <div className={cn('relative mx-auto w-full', maxWidth, 'px-4 md:px-6 py-8 md:py-10', className)}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SectionHeading — for separating dashboard sections
// ═══════════════════════════════════════════════════════════════════════════════

export function SectionHeading({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className={cardSpec.iconChip}>
            <Icon className="h-4 w-4 accent-text" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className={typography.h3}>{title}</h2>
          {subtitle && <p className={typography.caption}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Animation variants (exported for reuse)
// ═══════════════════════════════════════════════════════════════════════════════

export const motionVariants: Record<string, Variants> = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1 },
  },
  modalEnter: {
    hidden: { opacity: 0, scale: 0.96, y: 8 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: 6 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Barrels
// ═══════════════════════════════════════════════════════════════════════════════

export { typography, cardSpec, statusColors } from './tokens';
export type { StatusTone } from './tokens';
