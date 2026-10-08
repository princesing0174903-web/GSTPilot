'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — InvoiceA4Preview
//
// A pixel-crafted, GST-compliant A4 invoice preview that looks like a real
// invoice from a billion-dollar enterprise. Shown inside a Sheet/Dialog when
// the user clicks an invoice row in the Invoice Workspace.
//
// Design system:
//   • Pure-black canvas outside the paper; the A4 paper itself is white with
//     zinc-900 ink and a soft shadow-2xl.
//   • A4 dimensions: 794 × 1123 px (96 dpi). On mobile it scales naturally
//     via w-full max-w-[794px].
//   • Emerald-500 primary actions, outline secondary actions.
//   • Framer Motion entrance (fade + slide-up).
//   • Status watermark ("PAID" / "OVERDUE" / "CANCELLED") rotated -15° in
//     the center of the sheet when the invoice is in one of those states.
//   • Inter-state vs intra-state GST handling: when invoice.igst > 0 the
//     table shows an IGST column instead of CGST + SGST.
//   • Items: prefers invoice.items[] (real line items). For legacy invoices
//     without line items, synthesizes a single aggregated row from the
//     top-level totals.
//
// Spec compliance: Task 3-a (A4 Invoice Preview).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import {
  Printer,
  Download,
  Share2,
  Mail,
  CheckCircle2,
  Building2,
  MapPin,
  Receipt,
  Hash,
  CalendarDays,
  Landmark,
  QrCode,
  Link as LinkIcon,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/gst-utils';
import type { ApiInvoice } from '@/hooks/useInvoicesApi';
import type { ApiClient } from '@/hooks/useClientsApi';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Shape of an InvoiceItem row when the API includes `items` (see FIX 9 in
 *  the worklog — GET /api/invoices now includes items[]). Kept loose so legacy
 *  invoices (no items) still type-check. */
interface InvoiceA4Item {
  id?: string;
  lineNumber?: number;
  description?: string | null;
  hsnCode?: string | null;
  quantity?: number;
  unit?: string | null;
  unitPrice?: number;
  taxableValue?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  totalAmount?: number;
}

/** Optional organization branding override. When not provided, the component
 *  falls back to "VEYRO™" + the invoice's sellerGstin. */
interface InvoiceA4Organization {
  name: string;
  gstin: string;
  address?: string;
}

interface InvoiceA4PreviewProps {
  invoice: ApiInvoice & {
    items?: InvoiceA4Item[];
    hsnCode?: string | null;
    reverseCharge?: boolean | null;
    notesFinance?: string | null;
    paymentLink?: string | null;
    paymentMode?: string | null;
    paymentDate?: string | null;
  };
  client?: ApiClient | null;
  organization?: InvoiceA4Organization | null;
  onPrint?: () => void;
  onShare?: () => void;
  onDownloadPdf?: () => void;
  onSendEmail?: () => void;
  onMarkPaid?: () => void;
  loadingAction?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NUMBER = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/** Derive a human-readable place of supply from the buyer GSTIN's state code
 *  (first 2 digits). Falls back to client.state if available. */
const STATE_CODE_TO_NAME: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const placeOfSupply = (gstn: string | null | undefined, state?: string | null): string => {
  if (gstn && /^\d{2}/.test(gstn)) {
    const code = gstn.slice(0, 2);
    return `${STATE_CODE_TO_NAME[code] ?? 'State ' + code} (${code})`;
  }
  return state ?? '—';
};

/** Compute payment terms from invoice date + due date (e.g. "Net 30"). */
const computePaymentTerms = (invoiceDate: string | null, dueDate: string | null): string => {
  if (!invoiceDate || !dueDate) return 'Net 30';
  const a = new Date(invoiceDate).getTime();
  const b = new Date(dueDate).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 'Net 30';
  const days = Math.round((b - a) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Due on Receipt';
  if (days === 7) return 'Net 7';
  if (days === 14) return 'Net 14';
  if (days === 15) return 'Net 15';
  if (days === 30) return 'Net 30';
  if (days === 45) return 'Net 45';
  if (days === 60) return 'Net 60';
  if (days === 90) return 'Net 90';
  return `Net ${days}`;
};

// ─── Status watermark ────────────────────────────────────────────────────────

type WatermarkTone = 'paid' | 'overdue' | 'cancelled';

interface WatermarkSpec {
  label: string;
  tone: WatermarkTone;
}

const WATERMARK_TONES: Record<WatermarkTone, { ring: string; text: string; bg: string }> = {
  paid: {
    ring: 'border-blue-600',
    text: 'text-emerald-700',
    bg: 'bg-blue-50/80',
  },
  overdue: {
    ring: 'border-red-600',
    text: 'text-red-700',
    bg: 'bg-red-50/80',
  },
  cancelled: {
    ring: 'border-zinc-500',
    text: 'text-zinc-500',
    bg: 'bg-zinc-100/80',
  },
};

function computeWatermark(invoice: InvoiceA4PreviewProps['invoice']): WatermarkSpec | null {
  const status = (invoice.status ?? '').toLowerCase();
  const paymentStatus = (invoice.paymentStatus ?? '').toLowerCase();
  if (status === 'paid') return { label: 'PAID', tone: 'paid' };
  if (status === 'cancelled') return { label: 'CANCELLED', tone: 'cancelled' };
  if (status === 'overdue' || paymentStatus === 'overdue') return { label: 'OVERDUE', tone: 'overdue' };
  return null;
}

// ─── UPI QR code (REAL, scannable) ───────────────────────────────────────────
// Generates a genuine QR code from the UPI payment link using the `qrcode`
// library. The QR is scannable by GPay / PhonePe / Paytm / BHIM. When no
// payment link is available, renders a clear "no QR" placeholder instead of a
// fake one (never mislead the customer into scanning a non-functional code).

function UpiQrCode({ value, size = 96 }: { value: string | null | undefined; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  // Only generate when a real value exists — the null case is handled in render.
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value || !dataUrl) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-center"
        style={{ width: size, height: size }}
      >
        <QrCode className="h-6 w-6 text-zinc-300" />
        <span className="mt-1 px-1 text-[9px] leading-tight text-zinc-400">No payment link</span>
      </div>
    );
  }
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="UPI QR code — scan to pay"
      className="rounded-lg border border-zinc-200 bg-white"
    />
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function InvoiceA4Preview({
  invoice,
  client = null,
  organization = null,
  onPrint,
  onShare,
  onDownloadPdf,
  onSendEmail,
  onMarkPaid,
  loadingAction = false,
}: InvoiceA4PreviewProps) {
  // ── Derived data ──────────────────────────────────────────────────────────

  const isInterState = NUMBER(invoice.igst) > 0;

  const org: InvoiceA4Organization = useMemo(
    () =>
      organization ?? {
        name: 'VEYRO™',
        gstin: invoice.sellerGstin || '—',
        address: 'Bengaluru · Karnataka · India',
      },
    [organization, invoice.sellerGstin],
  );

  // Items: use real line items when available, else synthesize one aggregated row.
  const rows = useMemo(() => {
    const realItems = invoice.items;
    if (Array.isArray(realItems) && realItems.length > 0) {
      return realItems
        .slice()
        .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0))
        .map((it, idx) => ({
          lineNumber: idx + 1,
          description: it.description ?? 'Line item',
          hsnCode: it.hsnCode ?? invoice.hsnCode ?? '—',
          quantity: NUMBER(it.quantity),
          unit: it.unit ?? 'NOS',
          unitPrice: NUMBER(it.unitPrice),
          taxableValue: NUMBER(it.taxableValue),
          // FIX (B5): gstRate is the GST slab (CGST+SGST or IGST) — must NOT
          // include cessRate (would double-count CESS in the displayed rate).
          gstRate: NUMBER(it.cgstRate) + NUMBER(it.sgstRate) + NUMBER(it.igstRate),
          cgst: NUMBER(it.cgst),
          sgst: NUMBER(it.sgst),
          igst: NUMBER(it.igst),
          cess: NUMBER(it.cess),
          totalAmount: NUMBER(it.totalAmount),
        }));
    }
    // Legacy fallback — one aggregated row.
    const taxable = NUMBER(invoice.taxableValue);
    const gstRatePct = taxable > 0
      ? Math.round(
          ((NUMBER(invoice.cgst) + NUMBER(invoice.sgst) + NUMBER(invoice.igst) + NUMBER(invoice.cess)) /
            taxable) *
            100,
        )
      : 0;
    return [
      {
        lineNumber: 1,
        description: 'Aggregated Invoice Total',
        hsnCode: invoice.hsnCode ?? '—',
        quantity: 1,
        unit: 'LOT',
        unitPrice: taxable,
        taxableValue: taxable,
        gstRate: gstRatePct,
        cgst: NUMBER(invoice.cgst),
        sgst: NUMBER(invoice.sgst),
        igst: NUMBER(invoice.igst),
        cess: NUMBER(invoice.cess),
        totalAmount: NUMBER(invoice.totalAmount),
      },
    ];
  }, [invoice]);

  // Round-off line: totalAmount − (taxableValue + cgst + sgst + igst + cess).
  const roundOff = useMemo(() => {
    const computed =
      NUMBER(invoice.taxableValue) +
      NUMBER(invoice.cgst) +
      NUMBER(invoice.sgst) +
      NUMBER(invoice.igst) +
      NUMBER(invoice.cess);
    return NUMBER(invoice.totalAmount) - computed;
  }, [invoice]);

  const totals = useMemo(
    () => ({
      subtotal: NUMBER(invoice.taxableValue),
      cgst: NUMBER(invoice.cgst),
      sgst: NUMBER(invoice.sgst),
      igst: NUMBER(invoice.igst),
      cess: NUMBER(invoice.cess),
      roundOff,
      total: NUMBER(invoice.totalAmount),
      paid: NUMBER(invoice.paidAmount),
      balance: NUMBER(invoice.balanceAmount),
    }),
    [invoice, roundOff],
  );

  const watermark = computeWatermark(invoice);

  const billTo = {
    name: invoice.buyerName ?? client?.tradeName ?? 'Valued Customer',
    gstin: invoice.buyerGstin ?? client?.gstin ?? null,
    address: client?.state ? `${client.state}${client.stateCode ? ` (${client.stateCode})` : ''}` : null,
    email: client?.contactEmail ?? null,
    phone: client?.contactPhone ?? null,
  };

  const invoiceTypeLabel = invoice.invoiceType || 'B2B';
  const paymentTerms = computePaymentTerms(invoice.invoiceDate, invoice.dueDate);
  const pos = placeOfSupply(invoice.buyerGstin, client?.state ?? undefined);
  const reverseChargeLabel = invoice.reverseCharge ? 'Yes' : 'No';

  // Terms & Conditions: use the dedicated `terms` field (not notes). Parse
  // newline/numbered-bullet separated clauses. Fall back to sensible defaults
  // only when no terms were entered.
  const terms: string[] = useMemo(() => {
    const raw = (invoice.terms ?? '').trim();
    if (raw) {
      const parts = raw
        .split(/\r?\n|\s*\d+[.)]\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) return parts;
      return [raw];
    }
    return [
      'Payment is due within the agreed credit period mentioned above.',
      'Interest @ 18% p.a. will be charged on overdue invoices.',
      'All disputes are subject to the jurisdiction of courts at the seller\'s location.',
      'Goods once sold will not be taken back; exchange subject to seller\'s approval.',
      'This invoice is computer-generated and is valid without a physical signature.',
    ];
  }, [invoice.terms]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-full flex-col bg-black">
      {/* ── Sticky action toolbar ────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1024px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <div className="mr-auto flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-black text-white shadow-lg shadow-blue-500/30">
              G
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">Invoice Preview</p>
              <p className="text-[11px] text-zinc-400">{invoice.invoiceNumber}</p>
            </div>
          </div>

          {onSendEmail && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSendEmail}
              disabled={loadingAction}
              className="border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] hover:text-white"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </Button>
          )}
          {onShare && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShare}
              disabled={loadingAction}
              className="border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] hover:text-white"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}
          {onMarkPaid && (
            <Button
              type="button"
              size="sm"
              onClick={onMarkPaid}
              disabled={loadingAction}
              loading={loadingAction}
              className="bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Mark Paid</span>
            </Button>
          )}
          {onDownloadPdf && (
            <Button
              type="button"
              size="sm"
              onClick={onDownloadPdf}
              disabled={loadingAction}
              className="bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          )}
          {onPrint && (
            <Button
              type="button"
              size="sm"
              onClick={onPrint}
              disabled={loadingAction}
              className="bg-white text-zinc-900 shadow-lg hover:bg-zinc-200"
            >
              <Printer className="h-4 w-4" />
              <span>Print</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── A4 paper ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 justify-center px-4 py-8 sm:px-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[794px] min-w-full"
        >
          <div
            className={cn(
              'relative mx-auto w-full overflow-hidden rounded-sm bg-white text-zinc-900 shadow-2xl ring-1 ring-black/5',
              'min-h-[1123px]',
            )}
          >
            {/* ── Watermark (status stamp) ───────────────────────────────── */}
            {watermark && (
              <div
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute left-1/2 top-[42%] z-20 -translate-x-1/2 -translate-y-1/2 -rotate-[15deg]',
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center rounded-xl border-4 px-8 py-3 backdrop-blur-[2px]',
                    WATERMARK_TONES[watermark.tone].ring,
                    WATERMARK_TONES[watermark.tone].text,
                    WATERMARK_TONES[watermark.tone].bg,
                  )}
                >
                  <span className="text-5xl font-black tracking-[0.18em] sm:text-6xl">
                    {watermark.label}
                  </span>
                </div>
              </div>
            )}

            {/* ── A4 content ─────────────────────────────────────────────── */}
            <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-10 lg:p-12">
              {/* ── 1. Header ──────────────────────────────────────────── */}
              <header className="flex flex-col gap-6 border-b-2 border-blue-600/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
                {/* Branding (left) */}
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-2xl font-black text-white shadow-lg shadow-blue-500/30">
                    G
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-xl font-black tracking-tight text-zinc-900 sm:text-2xl">
                      {org.name}
                    </h1>
                    {org.address && (
                      <p className="max-w-xs text-xs leading-relaxed text-zinc-500">
                        {org.address}
                      </p>
                    )}
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                      GSTIN&nbsp;·&nbsp;{org.gstin}
                    </p>
                  </div>
                </div>

                {/* Title (right) */}
                <div className="sm:text-right">
                  <h2 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
                    TAX INVOICE
                  </h2>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex items-baseline justify-between gap-3 sm:justify-end">
                      <span className="text-zinc-500">Invoice No.</span>
                      <span className="font-bold text-zinc-900">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 sm:justify-end">
                      <span className="text-zinc-500">Invoice Date</span>
                      <span className="font-semibold text-zinc-900">
                        {formatDate(invoice.invoiceDate)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 sm:justify-end">
                      <span className="text-zinc-500">Due Date</span>
                      <span className="font-semibold text-zinc-900">
                        {formatDate(invoice.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </header>

              {/* ── 2 & 3. Bill To + Invoice Details ───────────────────── */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Bill To */}
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Bill To
                    </h3>
                  </div>
                  <p className="text-base font-bold text-zinc-900">{billTo.name}</p>
                  {billTo.gstin && (
                    <p className="mt-0.5 text-xs font-medium text-zinc-700">
                      GSTIN&nbsp;·&nbsp;{billTo.gstin}
                    </p>
                  )}
                  {billTo.address && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-zinc-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{billTo.address}</span>
                    </p>
                  )}
                  {(billTo.email || billTo.phone) && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {billTo.email ?? ''}
                      {billTo.email && billTo.phone ? '  ·  ' : ''}
                      {billTo.phone ?? ''}
                    </p>
                  )}
                </div>

                {/* Invoice details */}
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5 text-blue-600" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Invoice Details
                    </h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <DetailRow icon={<MapPin className="h-3 w-3" />} label="Place of Supply" value={pos} />
                    <DetailRow icon={<Hash className="h-3 w-3" />} label="Invoice Type" value={invoiceTypeLabel} />
                    <DetailRow
                      icon={<ShieldCheck className="h-3 w-3" />}
                      label="Reverse Charge"
                      value={reverseChargeLabel}
                    />
                    <DetailRow
                      icon={<CalendarDays className="h-3 w-3" />}
                      label="Payment Terms"
                      value={paymentTerms}
                    />
                  </dl>
                </div>
              </section>

              {/* ── 4. Items table ─────────────────────────────────────── */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700">
                    Invoice Items
                  </h3>
                </div>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-100 text-zinc-700">
                        <Th className="w-8 text-center">#</Th>
                        <Th>Description</Th>
                        <Th className="text-center">HSN</Th>
                        <Th className="text-right">Qty</Th>
                        <Th className="text-center">Unit</Th>
                        <Th className="text-right">Rate</Th>
                        <Th className="text-right">Taxable</Th>
                        <Th className="text-center">GST%</Th>
                        {isInterState ? (
                          <Th className="text-right">IGST</Th>
                        ) : (
                          <>
                            <Th className="text-right">CGST</Th>
                            <Th className="text-right">SGST</Th>
                          </>
                        )}
                        <Th className="text-right">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={`row-${r.lineNumber}`}
                          className="border-t border-zinc-200 align-top transition-colors hover:bg-zinc-50"
                        >
                          <Td className="text-center text-zinc-500">{r.lineNumber}</Td>
                          <Td className="font-medium text-zinc-900">{r.description}</Td>
                          <Td className="text-center text-zinc-600">{r.hsnCode}</Td>
                          <Td className="text-right tabular-nums text-zinc-700">{r.quantity}</Td>
                          <Td className="text-center text-zinc-600">{r.unit}</Td>
                          <Td className="text-right tabular-nums text-zinc-700">
                            {formatCurrency(r.unitPrice)}
                          </Td>
                          <Td className="text-right tabular-nums text-zinc-900">
                            {formatCurrency(r.taxableValue)}
                          </Td>
                          <Td className="text-center tabular-nums text-zinc-700">{r.gstRate}%</Td>
                          {isInterState ? (
                            <Td className="text-right tabular-nums text-zinc-700">
                              {formatCurrency(r.igst)}
                            </Td>
                          ) : (
                            <>
                              <Td className="text-right tabular-nums text-zinc-700">
                                {formatCurrency(r.cgst)}
                              </Td>
                              <Td className="text-right tabular-nums text-zinc-700">
                                {formatCurrency(r.sgst)}
                              </Td>
                            </>
                          )}
                          <Td className="text-right font-bold tabular-nums text-zinc-900">
                            {formatCurrency(r.totalAmount)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── 5 & 6. Bank/Payment details + Summary box ──────────── */}
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
                {/* Bank & UPI (left ~55-60%) */}
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5 text-blue-600" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      Bank &amp; Payment Details
                    </h3>
                  </div>
                  {/* Use the org's bank details from invoice.bankDetails (multiline
                       string) — never hardcode HDFC for every org. Fall back to a
                       clear "not configured" state so the user knows to add them. */}
                  {(() => {
                    const raw = (invoice.bankDetails ?? '').trim();
                    if (raw) {
                      // Parse "Label: Value" or "Label: Value" lines.
                      const rows = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                      const parsed = rows.map((line) => {
                        const m = /^([^:]{2,40}):\s*(.+)$/.exec(line);
                        return m ? { label: m[1].trim(), value: m[2].trim() } : { label: '', value: line };
                      });
                      return (
                        <dl className="grid grid-cols-1 gap-y-1.5 text-xs sm:grid-cols-2 sm:gap-x-4">
                          {parsed.map((r, i) => (
                            <PayRow key={i} label={r.label || 'Detail'} value={r.value} />
                          ))}
                        </dl>
                      );
                    }
                    return (
                      <p className="text-xs italic text-zinc-400">
                        Bank details not configured. Add them in the invoice builder (Notes &amp; Terms section) so customers can pay via NEFT/RTGS/UPI.
                      </p>
                    );
                  })()}

                  <div className="mt-4 flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-3">
                    <UpiQrCode value={invoice.paymentLink} size={88} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <QrCode className="h-3.5 w-3.5 text-blue-600" />
                        <p className="text-xs font-bold text-zinc-900">Scan to pay via UPI</p>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                        Use any UPI app (GPay, PhonePe, Paytm) to scan and pay
                        <span className="font-semibold text-zinc-700">
                          {' '}{formatCurrency(totals.balance)}
                        </span>
                        .
                      </p>
                      {invoice.paymentLink && (
                        <a
                          href={invoice.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-400"
                        >
                          <LinkIcon className="h-3 w-3" />
                          Open Payment Link
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary box (right ~40%) */}
                <div className="rounded-lg border-2 border-zinc-900/85 bg-white p-4">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Amount Summary
                  </h3>
                  <dl className="space-y-2 text-xs">
                    <SummaryRow label="Subtotal (Taxable Value)" value={formatCurrency(totals.subtotal)} />
                    {!isInterState && (
                      <>
                        <SummaryRow label="CGST" value={formatCurrency(totals.cgst)} muted />
                        <SummaryRow label="SGST" value={formatCurrency(totals.sgst)} muted />
                      </>
                    )}
                    {isInterState && (
                      <SummaryRow label="IGST" value={formatCurrency(totals.igst)} muted />
                    )}
                    {totals.cess > 0 && (
                      <SummaryRow label="CESS" value={formatCurrency(totals.cess)} muted />
                    )}
                    {Math.abs(totals.roundOff) >= 0.5 && (
                      <SummaryRow
                        label={`Round Off (${totals.roundOff >= 0 ? '+' : '−'})`}
                        value={formatCurrency(Math.abs(totals.roundOff))}
                        muted
                      />
                    )}
                    <div className="my-2 border-t border-dashed border-zinc-300" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black uppercase tracking-wide text-zinc-900">
                        Total Amount
                      </span>
                      <span className="text-lg font-black tabular-nums text-zinc-900">
                        {formatCurrency(totals.total)}
                      </span>
                    </div>
                    <div className="my-2 border-t border-dashed border-zinc-300" />
                    <SummaryRow
                      label="Paid Amount"
                      value={formatCurrency(totals.paid)}
                      tone="success"
                    />
                    <div
                      className={cn(
                        'flex items-center justify-between rounded-md px-2 py-1.5',
                        totals.balance > 0
                          ? 'bg-amber-50 ring-1 ring-amber-300'
                          : 'bg-blue-50 ring-1 ring-blue-300',
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-bold uppercase tracking-wide',
                          totals.balance > 0 ? 'text-amber-800' : 'text-emerald-800',
                        )}
                      >
                        Balance Due
                      </span>
                      <span
                        className={cn(
                          'text-sm font-black tabular-nums',
                          totals.balance > 0 ? 'text-amber-900' : 'text-emerald-900',
                        )}
                      >
                        {formatCurrency(totals.balance)}
                      </span>
                    </div>
                  </dl>
                </div>
              </section>

              {/* ── 7. Terms & Conditions ──────────────────────────────── */}
              <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Terms &amp; Conditions
                </h3>
                <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-zinc-600">
                  {terms.map((t, i) => (
                    <li key={`term-${i}`}>{t}</li>
                  ))}
                </ol>
              </section>

              {/* ── 8. Footer ──────────────────────────────────────────── */}
              <footer className="mt-auto border-t border-zinc-200 pt-5">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-[11px] font-medium text-zinc-500">
                    This is a computer-generated invoice and does not require a physical signature.
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-blue-400 to-blue-600 text-[10px] font-black text-white">
                      G
                    </div>
                    <span>
                      Powered by <span className="font-bold text-zinc-600">VEYRO™</span>
                    </span>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Small presentational helpers (kept in this file to avoid churn) ─────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b border-zinc-200 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn('px-2.5 py-2 text-zinc-700', className)}>{children}</td>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-200/60 py-1 last:border-0">
      <dt className="flex items-center gap-1.5 text-zinc-500">
        <span className="text-blue-600">{icon}</span>
        {label}
      </dt>
      <dd className="font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}

function PayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="truncate font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: 'success';
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn('text-zinc-600', muted && 'text-zinc-500')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums font-semibold text-zinc-900',
          tone === 'success' && 'text-emerald-700',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default InvoiceA4Preview;
