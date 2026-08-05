'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoicePreview
//
// Collapsible Live Preview pane. Wraps the existing InvoiceA4Preview (no API
// changes — pure presentation). Default state: collapsed (the form is the
// primary surface). Toggle the eye button to expand a real-time, Zoho-style
// printable invoice preview.
//
// The preview is built from live form state — it updates immediately on every
// keystroke (the parent passes a memoized `livePreviewInvoice`).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceA4Preview } from '@/components/invoices/InvoiceA4Preview';
import type { ApiInvoice, ApiClient } from './builder/types';

export interface InvoicePreviewOrganization {
  name: string;
  gstin: string;
  address?: string;
}

export interface InvoicePreviewProps {
  invoice: ApiInvoice & {
    items?: Array<Record<string, unknown>>;
    hsnCode?: string | null;
    reverseCharge?: boolean | null;
    notesFinance?: string | null;
    paymentLink?: string | null;
    paymentMode?: string | null;
    paymentDate?: string | null;
  };
  client: ApiClient | null;
  organization: InvoicePreviewOrganization | null;
}

export function InvoicePreview({ invoice, client, organization }: InvoicePreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="gst-card gst-animate-in relative">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="invoice-preview-body"
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#60A5FA] ring-1 ring-[#2563EB]/25">
            {open ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="gst-section-title text-foreground">Live Preview</h3>
            <p className="gst-description mt-1">
              {open
                ? 'Real-time printable A4 preview — updates as you type.'
                : 'Click to expand a real-time, Zoho-style printable preview.'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="gst-status gst-status-info">
            <Sparkles className="h-3 w-3" />
            A4 · 1:1
          </span>
          <ChevronDown
            className={cn(
              'h-5 w-5 text-muted-foreground transition-transform',
              open ? 'rotate-180' : 'rotate-0',
            )}
          />
        </div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="invoice-preview-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-5 border-t border-[#2A2E36] pt-5">
              <div className="origin-top mx-auto max-w-[760px] [&>div>div:first-child]:hidden">
                <InvoiceA4Preview invoice={invoice} client={client} organization={organization} />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
