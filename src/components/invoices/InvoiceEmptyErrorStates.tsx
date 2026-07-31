'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Plus,
  Upload,
  RefreshCw,
  LifeBuoy,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Invoice Empty State + Error State (Premium)
//
// Beautiful states for when there are no invoices, or when something went
// wrong loading them. Never exposes raw backend errors to the user.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Empty State ──────────────────────────────────────────────────────────────

interface InvoiceEmptyStateProps {
  onCreate: () => void;
  onImport?: () => void;
  onConnectZoho?: () => void;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

export function InvoiceEmptyState({
  onCreate,
  onImport,
  onConnectZoho,
  hasFilters = false,
  onClearFilters,
}: InvoiceEmptyStateProps) {
  if (hasFilters) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center py-16 px-6 text-center"
      >
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full" />
          <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 ring-1 ring-emerald-400/20 flex items-center justify-center">
            <FileText className="h-9 w-9 text-emerald-300" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No invoices match your filters
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          We couldn&apos;t find any invoices matching the current filters. Try
          adjusting your search or clearing all filters to see everything.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            onClick={onClearFilters}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear All Filters
          </Button>
          <Button
            onClick={onCreate}
            variant="outline"
            className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full" />
        <motion.div
          initial={{ scale: 0.9, rotate: -5 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 ring-1 ring-emerald-400/25 flex items-center justify-center shadow-2xl shadow-emerald-500/20"
        >
          <FileText className="h-11 w-11 text-emerald-300" strokeWidth={1.5} />
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-emerald-500 ring-4 ring-black flex items-center justify-center"
          >
            <Plus className="h-4 w-4 text-emerald-950" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </div>

      <h3 className="text-2xl font-bold tracking-tight text-foreground mb-3">
        Create your first invoice
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        Start billing your customers in seconds. Build a GST-compliant invoice
        with auto-calculated CGST/SGST/IGST, send it via email or WhatsApp, and
        track payments — all in one place.
      </p>

      <div className="flex flex-wrap gap-3 justify-center mb-10">
        <Button
          onClick={onCreate}
          size="lg"
          className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/25 font-semibold"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
        {onImport && (
          <Button
            onClick={onImport}
            size="lg"
            variant="outline"
            className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-foreground"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Invoices
          </Button>
        )}
        {onConnectZoho && (
          <Button
            onClick={onConnectZoho}
            size="lg"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Connect Zoho Books
          </Button>
        )}
      </div>

      {/* Feature hints */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
        {[
          { title: 'GST-Compliant', desc: 'CGST/SGST/IGST auto-split' },
          { title: 'Multi-Channel Send', desc: 'Email, WhatsApp, SMS' },
          { title: 'Oracle AI Insights', desc: 'Payment prediction & risk' },
        ].map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
            className="glass-surface rounded-xl p-4 border border-white/[0.06] text-left"
          >
            <div className="text-xs font-semibold text-foreground mb-1">
              {f.title}
            </div>
            <div className="text-[11px] text-muted-foreground">{f.desc}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

interface InvoiceErrorStateProps {
  message?: string;
  onRetry: () => void;
  onGoBack?: () => void;
}

export function InvoiceErrorState({
  message,
  onRetry,
  onGoBack,
}: InvoiceErrorStateProps) {
  // Sanitize — never expose raw backend errors. Show only a friendly reason.
  const friendlyMessage =
    message && message.length < 120 && !message.includes('HTTP')
      ? message
      : 'We hit an unexpected snag while loading your invoices. This is usually temporary.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full" />
        <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-1 ring-amber-400/20 flex items-center justify-center">
          <LifeBuoy className="h-9 w-9 text-amber-300" />
        </div>
      </div>

      <h3 className="text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        {friendlyMessage}{' '}
        <span className="text-amber-300/80">
          You can retry, or ask Oracle AI to help diagnose the issue.
        </span>
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={onRetry}
          className="bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/20"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button
          variant="outline"
          className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-foreground"
          onClick={() => {
            // Ask Oracle AI — opens the global Oracle drawer.
            const event = new CustomEvent('gstpilot:oracle:ask', {
              detail: { query: `I can't load my invoices. Error: ${friendlyMessage}` },
            });
            window.dispatchEvent(event);
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Ask Oracle AI
        </Button>
        {onGoBack && (
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={onGoBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-6">
        If this keeps happening, please contact support. We never expose your
        data or backend details.
      </p>
    </motion.div>
  );
}
