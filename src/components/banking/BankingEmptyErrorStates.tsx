'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Landmark, RefreshCw, Upload, Sparkles, AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Empty + Error States
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#111111] p-6 sm:p-8 text-center"
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <Landmark className="h-5 w-5 text-[#EDEDED]" strokeWidth={1.5} />
        </div>
        <h3 className="mb-1 text-sm font-semibold text-[#EDEDED]">No bank accounts connected</h3>
        <p className="mb-4 max-w-sm text-xs text-[#A1A1A1]">
          Connect a bank account to track cash flow, reconcile invoice payments, and unlock real-time financial vitals.
        </p>
        {onConnect && (
          <Button onClick={onConnect} size="sm" className="gap-1.5">
            <Landmark className="h-3.5 w-3.5" />
            Connect Bank Account
          </Button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#111111] p-6 sm:p-8"
    >
      <div className="relative flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <Landmark className="h-6 w-6 text-[#EDEDED]" strokeWidth={1.5} />
        </div>

        <h2 className="mb-1 text-lg font-semibold tracking-tight text-[#EDEDED]">
          VEYRO Banking
        </h2>
        <p className="mb-6 max-w-md text-xs text-[#A1A1A1] leading-relaxed">
          Integrated banking and automated invoice reconciliation. Link your business accounts or use sandbox mode to simulate cash flows.
        </p>

        <div className="mb-6 grid gap-2.5 sm:grid-cols-3 w-full max-w-xl">
          {[
            { icon: Landmark, title: 'Connect Accounts', desc: 'HDFC, ICICI, Axis, SBI' },
            { icon: RefreshCw, title: 'Auto-Reconcile', desc: 'Invoice to bank matching' },
            { icon: Sparkles, title: 'Cash Flow Insights', desc: 'Forecast vitals & risk' },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-left"
            >
              <feature.icon className="mb-1.5 h-4 w-4 text-[#EDEDED]" strokeWidth={1.5} />
              <p className="text-xs font-semibold text-[#EDEDED]">{feature.title}</p>
              <p className="text-[11px] text-[#A1A1A1] mt-0.5">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {onConnect && (
            <Button
              onClick={onConnect}
              size="sm"
              className="gap-1.5"
            >
              <Landmark className="h-3.5 w-3.5" />
              Connect Bank
            </Button>
          )}
          {onImport && (
            <Button
              onClick={onImport}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Statement
            </Button>
          )}
          {onAskOracle && (
            <Button
              onClick={onAskOracle}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-[#EDEDED]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask VEYRO AI
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-xl border border-red-500/20 bg-[#111111] p-6 sm:p-8"
    >
      <div className="relative flex flex-col items-center text-center">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-5 w-5 text-red-400" />
        </div>

        <h2 className="mb-1 text-base font-semibold tracking-tight text-[#EDEDED]">
          Something went wrong
        </h2>
        <p className="mb-4 max-w-md text-xs text-[#A1A1A1] leading-relaxed">
          {safeMessage}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          )}
          {onAskOracle && (
            <Button
              onClick={onAskOracle}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask VEYRO AI
            </Button>
          )}
          {onBack && (
            <Button onClick={onBack} variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-[#A1A1A1]" />
          <span className="text-[11px] text-[#666666]">
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#111111] p-6 sm:p-8 text-center"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08]">
        <RefreshCw className="h-5 w-5 text-[#A1A1A1]" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-[#EDEDED]">No matching transactions</h3>
      <p className="mb-4 max-w-sm text-xs text-[#A1A1A1]">
        No transactions match your current filters. Try adjusting the date range, category, or search query.
      </p>
      <Button
        onClick={onClearFilters}
        size="sm"
        variant="outline"
        className="gap-1.5"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Clear Filters
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
