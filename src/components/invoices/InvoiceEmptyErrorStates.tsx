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
// VEYRO — Invoice Empty State + Error State (Premium)
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl border border-white/[0.06] bg-[#111111]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] mb-3">
          <FileText className="h-5 w-5 text-[#A1A1A1]" strokeWidth={1.5} />
        </div>
        <h3 className="text-sm font-semibold text-[#EDEDED] mb-1">
          No invoices match your filters
        </h3>
        <p className="text-xs text-[#A1A1A1] max-w-sm mb-4">
          Try adjusting your search query, status filters, or date range.
        </p>
        <div className="flex items-center gap-2 justify-center">
          <Button
            size="sm"
            onClick={onClearFilters}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Clear Filters
          </Button>
          <Button
            size="sm"
            onClick={onCreate}
            variant="outline"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Invoice
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-white/[0.06] bg-[#111111]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] mb-3.5">
        <FileText className="h-6 w-6 text-[#EDEDED]" strokeWidth={1.5} />
      </div>

      <h3 className="text-base font-semibold text-[#EDEDED] mb-1">
        Create your first invoice
      </h3>
      <p className="text-xs text-[#A1A1A1] max-w-md mb-5 leading-relaxed">
        Issue GST-compliant invoices with automatic CGST, SGST, and IGST calculation. Send invoices and track payment milestones.
      </p>

      <div className="flex flex-wrap gap-2.5 justify-center mb-6">
        <Button
          onClick={onCreate}
          size="sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create Invoice
        </Button>
        {onImport && (
          <Button
            onClick={onImport}
            size="sm"
            variant="outline"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import Invoices
          </Button>
        )}
        {onConnectZoho && (
          <Button
            onClick={onConnectZoho}
            size="sm"
            variant="ghost"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Connect Zoho
          </Button>
        )}
      </div>

      {/* Feature hints */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
        {[
          { title: 'GST-Compliant', desc: 'CGST/SGST/IGST auto-split' },
          { title: 'Multi-Channel Send', desc: 'Email, WhatsApp, SMS' },
          { title: 'VEYRO AI Insights', desc: 'Payment prediction & risk' },
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-xl border border-white/[0.06] bg-[#111111]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] mb-3">
        <LifeBuoy className="h-5 w-5 text-[#EDEDED]" strokeWidth={1.5} />
      </div>

      <h3 className="text-sm font-semibold text-[#EDEDED] mb-1">
        Something went wrong
      </h3>
      <p className="text-xs text-[#A1A1A1] max-w-sm mb-4 leading-relaxed">
        {friendlyMessage}
      </p>

      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          size="sm"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Try Again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const event = new CustomEvent('gstpilot:oracle:ask', {
              detail: { query: `I can't load my invoices. Error: ${friendlyMessage}` },
            });
            window.dispatchEvent(event);
          }}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Ask VEYRO AI
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
