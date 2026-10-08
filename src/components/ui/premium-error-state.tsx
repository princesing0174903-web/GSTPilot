'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Premium Error State
// ═══════════════════════════════════════════════════════════════════════════════
//
// A large, premium error card with:
//   • Red-tinted illustration (AlertTriangle in a styled circle)
//   • "Something went wrong" title (or custom)
//   • Friendly sanitized description (NEVER exposes the raw error/stack/JSON)
//   • Primary CTA ("Try again")
//   • Optional secondary CTA (e.g. "Contact support", "Go to dashboard")
//   • Optional Oracle suggestion (asks Oracle for help diagnosing)
//   • Optional error code (short, sanitized — never a stack trace)
//
// Inspired by Stripe / Linear / Vercel error states.
//
// Usage:
//   <PremiumErrorState
//     title="Couldn't load invoices"
//     description="We couldn't reach the invoice service. Your data is safe — please try again."
//     onRetry={() => refetch()}
//     errorCode="INV-503"
//   />
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LifeBuoy, Sparkles } from 'lucide-react';

export interface PremiumErrorAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary';
}

export interface PremiumErrorStateProps {
  /** Optional illustration override. Defaults to AlertTriangle. */
  icon?: ReactNode;
  /** Title. Defaults to "Something went wrong". */
  title?: string;
  /** Friendly, sanitized description. NEVER pass raw error.message here. */
  description?: string;
  /** Primary CTA. Defaults to "Try again" — must be provided if no `onRetry`. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Optional secondary CTA (e.g. "Go to dashboard", "Contact support"). */
  secondaryAction?: PremiumErrorAction;
  /** Optional Oracle suggestion — shown in a blue-tinted box below the CTAs. */
  oracleSuggestion?: string;
  /** Optional short, sanitized error code (e.g. "INV-503"). NEVER a stack trace. */
  errorCode?: string;
  /** Optional "Contact support" link URL. If provided, renders a tertiary link. */
  supportHref?: string;
  className?: string;
}

/**
 * Sanitize a raw error message so we NEVER leak Firebase / Firestore / Prisma /
 * fetch internals to the UI. Mirrors the policy in ViewErrorBoundary and
 * useInvoicesApi. Use this when converting a caught Error into a description.
 */
export function sanitizeErrorForDisplay(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.';
  const msg =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : String(err);
  if (!msg) return 'Something went wrong. Please try again.';
  // If the message mentions internal SDK names, fall back to a safe generic.
  if (/firebase|firestore|prisma|admin\.auth|adminDb|ECONNREFUSED|stack|at\s\/|node:internal/i.test(msg)) {
    return 'We couldn\'t reach the service. Please check your connection and try again.';
  }
  // Strip anything that looks like a JSON fragment or a path.
  const cleaned = msg
    .replace(/\{[^}]*\}/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\/[^\s]+\.(ts|js|tsx|jsx)/g, '')
    .trim();
  // Truncate very long messages.
  if (cleaned.length > 160) return `${cleaned.slice(0, 160)}…`;
  return cleaned || 'Something went wrong. Please try again.';
}

export function PremiumErrorState({
  icon,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Your data is safe — please try again.',
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
  oracleSuggestion,
  errorCode,
  supportHref,
  className = '',
}: PremiumErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="alert"
      aria-live="assertive"
    >
      {/* ── Red-tinted illustration ── */}
      <div className="relative mb-6">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle at center, rgba(239,68,68,0.10) 0%, rgba(239,68,68,0.04) 40%, transparent 70%)',
          }}
        />
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.10] to-red-500/[0.02] shadow-lg">
          <div className="text-red-400">
            {icon ?? <AlertTriangle className="h-8 w-8" />}
          </div>
        </div>
      </div>

      {/* ── Title + Description ── */}
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {/* ── Error code (sanitized, short) ── */}
      {errorCode && (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/60">
          Error · {errorCode}
        </p>
      )}

      {/* ── Actions ── */}
      {(onRetry || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          {onRetry && (
            <button
              onClick={onRetry}
              className="gst-btn gst-btn-primary gst-btn-lg"
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="gst-btn gst-btn-secondary gst-btn-lg"
              type="button"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {/* ── Oracle Suggestion ── */}
      {oracleSuggestion && (
        <div className="mt-8 flex max-w-lg items-start gap-3 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/[0.06] p-4 text-left">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/15">
            <Sparkles className="h-4 w-4 text-[#60A5FA]" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">
              Oracle Suggestion
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {oracleSuggestion}
            </p>
          </div>
        </div>
      )}

      {/* ── Contact support link ── */}
      {supportHref && (
        <a
          href={supportHref}
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          Contact support
        </a>
      )}
    </div>
  );
}

export default PremiumErrorState;
