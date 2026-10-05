'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Landmark, RefreshCw, Upload, Sparkles, AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Empty + Error States
//
// Professional states that never look like an admin template. Beautiful
// illustrations, clear CTAs, and sanitized error messages (never exposes raw
// backend errors to the user).
// ═══════════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  onConnect?: () => void;
  onImport?: () => void;
  onAskOracle?: () => void;
  variant?: 'full' | 'compact';
}

export function BankingEmptyState({ onConnect, onImport, onAskOracle, variant = 'full' }: EmptyStateProps) {
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-surface flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-12 text-center"
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
          <Landmark className="h-7 w-7 text-blue-400" />
        </div>
        <h3 className="mb-1.5 text-base font-semibold text-foreground">No bank accounts connected</h3>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">
          Connect your first bank account to start tracking transactions, reconciling payments, and
          unlocking Oracle AI insights.
        </p>
        {onConnect && (
          <Button onClick={onConnect} className="gap-2 bg-blue-500 hover:bg-blue-400 text-zinc-950">
            <Landmark className="h-4 w-4" />
            Connect Bank Account
          </Button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-surface relative overflow-hidden rounded-2xl border border-white/[0.06] p-12"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/[0.06] blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20"
        >
          <Landmark className="h-10 w-10 text-blue-400" />
        </motion.div>

        <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
          Welcome to GSTPilot Banking™
        </h2>
        <p className="mb-8 max-w-lg text-sm text-muted-foreground leading-relaxed">
          The complete banking & reconciliation platform. Connect your bank accounts, auto-reconcile
          invoices, predict cash flow, and detect fraud — all in one place. Built for billion-dollar
          operations.
        </p>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Landmark, title: 'Connect Accounts', desc: 'HDFC, ICICI, Axis & more' },
            { icon: RefreshCw, title: 'Auto-Reconcile', desc: 'Invoice → Payment → Bank' },
            { icon: Sparkles, title: 'Oracle AI Insights', desc: 'Predict cash flow & fraud' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left"
            >
              <feature.icon className="mb-2 h-5 w-5 text-blue-400" />
              <p className="mb-0.5 text-sm font-semibold text-foreground">{feature.title}</p>
              <p className="text-xs text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {onConnect && (
            <Button
              onClick={onConnect}
              className="gap-2 bg-blue-500 hover:bg-blue-400 text-zinc-950 shadow-lg shadow-blue-500/20"
            >
              <Landmark className="h-4 w-4" />
              Connect Your First Bank
            </Button>
          )}
          {onImport && (
            <Button
              onClick={onImport}
              variant="outline"
              className="gap-2 border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04]"
            >
              <Upload className="h-4 w-4" />
              Import Statement
            </Button>
          )}
          {onAskOracle && (
            <Button
              onClick={onAskOracle}
              variant="ghost"
              className="gap-2 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <Sparkles className="h-4 w-4" />
              Ask Oracle AI
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  onAskOracle?: () => void;
  onBack?: () => void;
}

export function BankingErrorState({ message, onRetry, onAskOracle, onBack }: ErrorStateProps) {
  // Sanitize — never expose raw backend error messages that might leak internals.
  const safeMessage = sanitizeErrorMessage(message);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-surface relative overflow-hidden rounded-2xl border border-red-500/20 p-8"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/[0.08] blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20"
        >
          <AlertCircle className="h-8 w-8 text-red-400" />
        </motion.div>

        <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mb-6 max-w-md text-sm text-muted-foreground leading-relaxed">
          {safeMessage}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              className="gap-2 bg-blue-500 hover:bg-blue-400 text-zinc-950"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          {onAskOracle && (
            <Button
              onClick={onAskOracle}
              variant="outline"
              className="gap-2 border-amber-400/25 text-amber-300 hover:bg-amber-400/10"
            >
              <Sparkles className="h-4 w-4" />
              Ask Oracle AI
            </Button>
          )}
          {onBack && (
            <Button onClick={onBack} variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] text-muted-foreground">
            Error details are sanitized for security. Contact support if the issue persists.
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Filtered Empty State (when filters return no results) ────────────────────

export function BankingFilteredEmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-surface flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-12 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
        <RefreshCw className="h-6 w-6 text-cyan-400" />
      </div>
      <h3 className="mb-1.5 text-base font-semibold text-foreground">No matching transactions</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        No transactions match your current filters. Try adjusting the date range, category, or search query.
      </p>
      <Button
        onClick={onClearFilters}
        variant="outline"
        className="gap-2 border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04]"
      >
        <RefreshCw className="h-4 w-4" />
        Clear All Filters
      </Button>
    </motion.div>
  );
}

// ─── Sanitizer ────────────────────────────────────────────────────────────────

function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An unexpected error occurred while loading banking data.';

  // Strip out anything that looks like a stack trace, file path, or SQL query.
  const cleaned = message
    .replace(/at\s+.*\s+\(.*:\d+:\d+\)/g, '')
    .replace(/\/[^\s]+\.(ts|js|tsx):?\d*:?\d*/g, '')
    .replace(/PrismaClient[A-Za-z]*Error:?/g, 'Database error:')
    .replace(/UNKNOWN_CODE_\d+/g, 'unknown error')
    .trim();

  // If the message is too technical, return a generic friendly message.
  if (cleaned.length < 10 || cleaned.match(/^(Error:|TypeError:|ReferenceError:)/)) {
    return 'We couldn’t load your banking data. This is usually a temporary issue — please try again.';
  }

  return cleaned;
}
