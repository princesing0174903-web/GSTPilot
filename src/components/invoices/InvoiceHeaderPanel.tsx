'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoiceHeaderPanel
//
// The RIGHT card of the rebuilt Invoice Builder. All invoice-meta fields in
// one place, no scrolling:
//   • Invoice Number (mono, editable)
//   • Invoice Date (date picker)
//   • Due Date (date picker, with quick-pick chips +7/+15/+30)
//   • Invoice Status (Draft/Sent/Paid/Overdue/Cancelled)
//   • GST Type (Intra-state CGST+SGST / Inter-state IGST — auto-derived)
//   • Payment Status (Unpaid/Partial/Paid)
//   • Invoice Currency (INR default + USD/EUR/GBP/AED)
//   • Invoice Template (Classic/Modern/Minimal/Bold)
//
// All inputs LARGE (h-12 = 48px). Each has Label + Placeholder + Helper text
// + keyboard nav + visible focus states.
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import {
  Hash,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  SectionCard,
  FieldLabel,
  PremiumInput,
  HelperText,
  PREMIUM_SELECT_TRIGGER_CLASSNAMES,
  PREMIUM_SELECT_CONTENT_CLASSNAMES,
} from './builder/ui';
import {
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  CURRENCIES,
  INVOICE_TEMPLATES,
  STATE_CODE_TO_NAME,
} from './builder/constants';
import type { InvoiceBuilderOrganization } from './builder/types';

export interface InvoiceHeaderPanelProps {
  invoiceNumber: string;
  onInvoiceNumberChange: (v: string) => void;

  invoiceDate: string;
  onInvoiceDateChange: (v: string) => void;

  dueDate: string;
  onDueDateChange: (v: string) => void;
  onDueDatePreset: (days: number) => void;
  paymentTermsDays: string;

  invoiceStatus: string;
  onInvoiceStatusChange: (v: string) => void;

  paymentStatus: string;
  onPaymentStatusChange: (v: string) => void;

  currency: string;
  onCurrencyChange: (v: string) => void;

  template: string;
  onTemplateChange: (v: string) => void;

  // Inter-state context (drives the GST Type badge + Oracle hint)
  interState: boolean;
  sellerGstin: string;
  buyerGstin: string;
  organization?: InvoiceBuilderOrganization | null;

  // Edit mode badge (shown when editing an existing invoice)
  isEdit: boolean;
  editInvoiceNumber?: string;
}

export function InvoiceHeaderPanel({
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  dueDate,
  onDueDateChange,
  onDueDatePreset,
  paymentTermsDays,
  invoiceStatus,
  onInvoiceStatusChange,
  paymentStatus,
  onPaymentStatusChange,
  currency,
  onCurrencyChange,
  template,
  onTemplateChange,
  interState,
  sellerGstin,
  buyerGstin,
  organization,
  isEdit,
  editInvoiceNumber,
}: InvoiceHeaderPanelProps) {
  const sellerStateCode = sellerGstin.slice(0, 2);
  const buyerStateCode = buyerGstin.slice(0, 2);
  const sellerStateName = sellerStateCode ? STATE_CODE_TO_NAME[sellerStateCode] ?? '—' : '—';
  const buyerStateName = buyerStateCode ? STATE_CODE_TO_NAME[buyerStateCode] ?? '—' : '—';

  return (
    <SectionCard
      icon={<Hash className="h-5 w-5" />}
      title="Invoice Details"
      description="Number, dates, status, GST type, currency and template."
      right={
        isEdit && editInvoiceNumber ? (
          <span className="gst-status gst-status-neutral">
            Editing · {editInvoiceNumber}
          </span>
        ) : null
      }
    >
      {/* ── Invoice Number + Dates ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="inv-number" required>
            Invoice Number
          </FieldLabel>
          <PremiumInput
            id="inv-number"
            value={invoiceNumber}
            onChange={(e) => onInvoiceNumberChange(e.target.value)}
            placeholder="INV-2025-0001"
            className="font-mono tracking-wide"
          />
          <HelperText>Unique reference shown on the invoice & GSTR reports.</HelperText>
        </div>
        <div>
          <FieldLabel htmlFor="inv-date">Invoice Date</FieldLabel>
          <PremiumInput
            id="inv-date"
            type="date"
            value={invoiceDate}
            onChange={(e) => onInvoiceDateChange(e.target.value)}
          />
          <HelperText>Drives the GSTR filing period (yyyy-mm).</HelperText>
        </div>
        <div>
          <FieldLabel htmlFor="inv-due" hint="auto from terms">
            Due Date
          </FieldLabel>
          <PremiumInput
            id="inv-due"
            type="date"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-1.5">
            {[7, 15, 30, 60].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDueDatePreset(d)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors',
                  paymentTermsDays === String(d)
                    ? 'border-[#2563EB]/60 bg-[#2563EB]/15 text-[#60A5FA]'
                    : 'border-[#2A2E36] bg-[#0F1115] text-muted-foreground hover:text-foreground',
                )}
              >
                +{d}d
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="inv-status">Invoice Status</FieldLabel>
          <Select value={invoiceStatus} onValueChange={onInvoiceStatusChange}>
            <SelectTrigger id="inv-status" className={cn(PREMIUM_SELECT_TRIGGER_CLASSNAMES, 'w-full')}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
              {INVOICE_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelperText>
            {invoiceStatus === 'draft'
              ? 'Saved as draft — not visible to the buyer.'
              : invoiceStatus === 'sent'
                ? 'Visible to the buyer — payment awaited.'
                : invoiceStatus === 'paid'
                  ? 'Marked fully paid.'
                  : invoiceStatus === 'overdue'
                    ? 'Past due date — collection in progress.'
                    : 'Cancelled — void in books.'}
          </HelperText>
        </div>
      </div>

      {/* ── GST Type + Payment Status ─────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel hint="auto from GSTINs">GST Type</FieldLabel>
          <div
            className={cn(
              'flex h-12 w-full items-center justify-between gap-2 rounded-lg border px-3.5 text-[15px] transition-colors',
              interState
                ? 'border-[#F59E0B]/40 bg-[#F59E0B]/[0.06] text-[#FBBF24]'
                : 'border-[#3B82F6]/40 bg-[#3B82F6]/[0.06] text-[#60A5FA]',
            )}
          >
            <span className="flex items-center gap-2">
              {interState ? (
                <ArrowLeftRight className="h-4 w-4" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              <span className="font-semibold">
                {interState ? 'Inter-state · IGST' : 'Intra-state · CGST + SGST'}
              </span>
            </span>
            <span className="text-[11px] uppercase tracking-wider opacity-80">
              {interState ? 'IGST' : 'CGST/SGST'}
            </span>
          </div>
          <HelperText>
            Seller <span className="text-foreground">{sellerStateName}</span>
            {' '}&harr;{' '}
            Buyer <span className="text-foreground">{buyerStateName}</span>.
          </HelperText>
        </div>
        <div>
          <FieldLabel htmlFor="inv-pay-status">Payment Status</FieldLabel>
          <Select value={paymentStatus} onValueChange={onPaymentStatusChange}>
            <SelectTrigger id="inv-pay-status" className={cn(PREMIUM_SELECT_TRIGGER_CLASSNAMES, 'w-full')}>
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelperText>Shown as a pill on the invoice & in collections.</HelperText>
        </div>
      </div>

      {/* ── Currency + Template ──────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="inv-currency">Invoice Currency</FieldLabel>
          <Select value={currency} onValueChange={onCurrencyChange}>
            <SelectTrigger id="inv-currency" className={cn(PREMIUM_SELECT_TRIGGER_CLASSNAMES, 'w-full')}>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                  <span className="font-mono mr-2">{c.symbol}</span>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelperText>GST is always calculated in INR for compliance.</HelperText>
        </div>
        <div>
          <FieldLabel htmlFor="inv-template">Invoice Template</FieldLabel>
          <Select value={template} onValueChange={onTemplateChange}>
            <SelectTrigger id="inv-template" className={cn(PREMIUM_SELECT_TRIGGER_CLASSNAMES, 'w-full')}>
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
              {INVOICE_TEMPLATES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelperText>Preview pane reflects this template live.</HelperText>
        </div>
      </div>

      {/* ── Oracle AI hint ───────────────────────────────────────────────── */}
      <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/[0.06] p-3.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#FBBF24]" />
        <div className="flex-1 text-[13px] leading-relaxed text-[#FBBF24]/90">
          <span className="font-semibold text-[#FBBF24]">Oracle AI ·</span>{' '}
          {interState ? (
            <>
              <AlertCircle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
              Seller state ({sellerStateCode || '—'}) &ne; Buyer state ({buyerStateCode || '—'}).
              <strong> IGST</strong> @ the slab rate applies on every line.
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
              Seller state ({sellerStateCode || '—'}) = Buyer state ({buyerStateCode || '—'}).
              <strong> CGST + SGST</strong> (split 50/50) applies on every line.
            </>
          )}
          {!buyerGstin ? ' Add a buyer GSTIN to enable inter-state detection.' : ''}
        </div>
      </div>
    </SectionCard>
  );
}
