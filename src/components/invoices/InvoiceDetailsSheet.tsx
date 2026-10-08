'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — InvoiceDetailsSheet
//
// A premium right-side slide-over Sheet that opens when the user clicks an
// invoice row in the Invoice Workspace. Contains 6 tabs and a sticky bottom
// action bar.
//
// Tabs:
//   1. Overview  — Status pills, payment pill, risk badge, key metrics,
//                  payment timeline mini.
//   2. Items     — Items table (reads invoice.items[] if available, else
//                  synthesizes an aggregated row from totals).
//   3. GST       — Tax breakdown + small breakdown chart by GST slab.
//   4. Payments  — Paid/balance/status/mode/date + Record Payment button.
//   5. Preview   — Renders <InvoiceA4Preview> inside a scaled container.
//   6. History   — Timeline of status changes derived from timestamps.
//
// Actions (sticky bottom of sheet):
//   Edit · Send Email · Mark Paid · Duplicate · More (Print, Download PDF,
//   Share, Archive, Delete).
//
// Design system:
//   • Dark theme, pure-black sheet background, glass cards.
//   • Sheet body bg-zinc-950/95 backdrop-blur.
//   • Framer Motion entrance per tab content (fade + slide).
//   • All money via formatCurrency (en-IN).
//
// Spec compliance: Task 3-c (Oracle Panel + Details Sheet).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  CheckCircle2,
  Copy,
  Pencil,
  MoreHorizontal,
  Printer,
  Download,
  Share2,
  Archive,
  Trash2,
  Hash,
  CalendarDays,
  Building2,
  Receipt,
  Wallet,
  Landmark,
  ShieldCheck,
  Clock,
  CreditCard,
  CheckCircle,
  FileText,
  Circle,
  Banknote,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/gst-utils';
import type { ApiInvoice, InvoiceInsights } from '@/hooks/useInvoicesApi';
import type { ApiClient } from '@/hooks/useClientsApi';
import { StatusPill, PaymentPill, RiskBadge } from './InvoiceStatusPills';
import { InvoiceA4Preview } from './InvoiceA4Preview';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Per-line item shape when the API includes `items[]`. */
interface InvoiceItem {
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

/** Extended invoice type — ApiInvoice + the optional fields the API returns
 *  but doesn't declare on the shared type (matches InvoiceA4Preview). */
type DetailedInvoice = ApiInvoice & {
  items?: InvoiceItem[];
  hsnCode?: string | null;
  reverseCharge?: boolean | null;
  notesFinance?: string | null;
  paymentLink?: string | null;
  paymentMode?: string | null;
  paymentDate?: string | null;
};

interface InvoiceDetailsOrganization {
  name: string;
  gstin: string;
  address?: string;
}

export interface InvoiceDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ApiInvoice | null;
  client?: ApiClient | null;
  organization?: InvoiceDetailsOrganization | null;
  onEdit?: () => void;
  onSendEmail?: () => void;
  onMarkPaid?: () => void;
  onDuplicate?: () => void;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onShare?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  fetchInsights?: (id: string) => Promise<InvoiceInsights | null>;
  saving?: boolean;
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

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ─── Tab entrance animation (Framer Motion) ──────────────────────────────────
// Each tab content uses this preset for its mount animation (fade + slide up).
const tabEnter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: 'easeOut' as const },
};

// ─── Items table (reads invoice.items[] or synthesizes aggregated row) ───────

interface ItemsRow {
  lineNumber: number;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

function deriveItems(invoice: DetailedInvoice): ItemsRow[] {
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
        gstRate:
          NUMBER(it.cgstRate) +
          NUMBER(it.sgstRate) +
          NUMBER(it.igstRate),
        cgst: NUMBER(it.cgst),
        sgst: NUMBER(it.sgst),
        igst: NUMBER(it.igst),
        cess: NUMBER(it.cess),
        totalAmount: NUMBER(it.totalAmount),
      }));
  }
  // Legacy fallback — one aggregated row.
  const taxable = NUMBER(invoice.taxableValue);
  const totalTax =
    NUMBER(invoice.cgst) +
    NUMBER(invoice.sgst) +
    NUMBER(invoice.igst) +
    NUMBER(invoice.cess);
  const gstRatePct = taxable > 0 ? Math.round((totalTax / taxable) * 100) : 0;
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
}

// ─── GST breakdown by slab ───────────────────────────────────────────────────

const GST_SLABS = [0, 5, 12, 18, 28] as const;

function nearestSlab(rate: number): number {
  if (rate <= 0) return 0;
  let nearest = GST_SLABS[0];
  let minDiff = Math.abs(rate - nearest);
  for (const s of GST_SLABS) {
    const diff = Math.abs(rate - s);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = s;
    }
  }
  return nearest;
}

interface SlabBucket {
  slab: number;
  taxable: number;
  tax: number;
}

function deriveSlabBreakdown(invoice: DetailedInvoice, rows: ItemsRow[]): SlabBucket[] {
  // If we have real items, bucket per-item taxable by its nearest GST slab.
  if (Array.isArray(invoice.items) && invoice.items.length > 0) {
    const map = new Map<number, SlabBucket>();
    for (const r of rows) {
      const slab = nearestSlab(r.gstRate);
      const bucket = map.get(slab) ?? { slab, taxable: 0, tax: 0 };
      bucket.taxable += r.taxableValue;
      bucket.tax += r.cgst + r.sgst + r.igst + r.cess;
      map.set(slab, bucket);
    }
    return Array.from(map.values()).sort((a, b) => a.slab - b.slab);
  }
  // Legacy fallback — one bucket for the aggregated row's effective rate.
  const taxable = NUMBER(invoice.taxableValue);
  const totalTax =
    NUMBER(invoice.cgst) +
    NUMBER(invoice.sgst) +
    NUMBER(invoice.igst) +
    NUMBER(invoice.cess);
  const effRate = taxable > 0 ? (totalTax / taxable) * 100 : 0;
  const slab = nearestSlab(effRate);
  return [{ slab, taxable, tax: totalTax }];
}

// ─── History timeline ────────────────────────────────────────────────────────

interface HistoryEvent {
  label: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

function deriveHistory(invoice: DetailedInvoice): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  const created = invoice.createdAt;
  if (created) {
    events.push({
      label: `Invoice created (${invoice.invoiceNumber || '—'})`,
      timestamp: created,
      icon: FileText,
      tone: 'text-zinc-400',
    });
  }
  // Status change inferred from `status` field — show as the latest transition.
  const status = (invoice.status ?? '').toLowerCase();
  if (status && status !== 'draft' && invoice.updatedAt) {
    events.push({
      label: `Status → ${status.replace(/_/g, ' ')}`,
      timestamp: invoice.updatedAt,
      icon: CheckCircle,
      tone: 'text-blue-400',
    });
  }
  if (invoice.dueDate) {
    events.push({
      label: 'Payment due',
      timestamp: invoice.dueDate,
      icon: Clock,
      tone: 'text-amber-400',
    });
  }
  const paymentDate = invoice.paymentDate;
  if (paymentDate || status === 'paid' || status === 'partially_paid') {
    events.push({
      label:
        status === 'partially_paid'
          ? 'Partial payment recorded'
          : 'Payment received',
      timestamp: paymentDate ?? invoice.updatedAt ?? '',
      icon: Banknote,
      tone: 'text-blue-400',
    });
  }
  if (invoice.updatedAt && invoice.updatedAt !== created) {
    events.push({
      label: 'Last updated',
      timestamp: invoice.updatedAt,
      icon: Circle,
      tone: 'text-zinc-500',
    });
  }
  // Sort descending by timestamp (most recent first).
  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

// ─── Tab content components ──────────────────────────────────────────────────

function OverviewTab({
  invoice,
  client,
}: {
  invoice: DetailedInvoice;
  client?: ApiClient | null;
}) {
  const balance = NUMBER(invoice.balanceAmount);
  const paid = NUMBER(invoice.paidAmount);
  const total = NUMBER(invoice.totalAmount);
  const taxable = NUMBER(invoice.taxableValue);
  const paymentProgress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const metrics: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string }> = [
    { icon: Hash, label: 'Invoice No.', value: invoice.invoiceNumber || '—' },
    { icon: CalendarDays, label: 'Invoice Date', value: formatDate(invoice.invoiceDate) },
    { icon: CalendarDays, label: 'Due Date', value: formatDate(invoice.dueDate) },
    { icon: Building2, label: 'Client', value: invoice.buyerName ?? client?.tradeName ?? '—' },
    { icon: ShieldCheck, label: 'Buyer GSTIN', value: invoice.buyerGstin ?? client?.gstin ?? '—' },
    { icon: Receipt, label: 'Taxable Value', value: formatCurrency(taxable) },
    { icon: Landmark, label: 'Total Amount', value: formatCurrency(total) },
    { icon: CheckCircle2, label: 'Paid', value: formatCurrency(paid) },
    { icon: Wallet, label: 'Balance Due', value: formatCurrency(balance) },
  ];

  return (
    <motion.div {...tabEnter} className="space-y-4">
      {/* Status pills row */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Status
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={invoice.status} size="md" />
          <PaymentPill status={invoice.paymentStatus} size="md" />
          <RiskBadge level={invoice.riskLevel} />
          {invoice.matchStatus && (
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.03] text-zinc-300"
            >
              Match: {invoice.matchStatus}
            </Badge>
          )}
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Key Metrics
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <div
                key={`metric-${i}`}
                className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.04]"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-amber-300/80" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    {m.label}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {m.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment timeline mini */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Payment Timeline
          </p>
          <span className="text-[11px] font-semibold text-blue-400">
            {paymentProgress}% paid
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
            initial={{ width: 0 }}
            animate={{ width: `${paymentProgress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/[0.02] p-2">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Total
            </p>
            <p className="mt-0.5 text-xs font-bold text-zinc-200">
              {formatCurrency(total)}
            </p>
          </div>
          <div className="rounded-lg bg-blue-500/[0.06] p-2">
            <p className="text-[11px] uppercase tracking-wider text-blue-400">
              Paid
            </p>
            <p className="mt-0.5 text-xs font-bold text-blue-300">
              {formatCurrency(paid)}
            </p>
          </div>
          <div className="rounded-lg bg-amber-500/[0.06] p-2">
            <p className="text-[11px] uppercase tracking-wider text-amber-400">
              Balance
            </p>
            <p className="mt-0.5 text-xs font-bold text-amber-300">
              {formatCurrency(balance)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ItemsTab({ invoice }: { invoice: DetailedInvoice }) {
  const rows = useMemo(() => deriveItems(invoice), [invoice]);
  const isInterState = NUMBER(invoice.igst) > 0;

  return (
    <motion.div {...tabEnter}>
      <div className="glass-surface overflow-hidden rounded-2xl border border-white/[0.06]">
        <div className="max-h-[60vh] overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
              <tr className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-center">#</th>
                <th className="border-b border-white/[0.06] px-3 py-2.5">Description</th>
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-center">HSN</th>
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-right">Qty</th>
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-center">Unit</th>
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-right">Rate</th>
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-right">Taxable</th>
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-center">GST%</th>
                {isInterState ? (
                  <th className="border-b border-white/[0.06] px-3 py-2.5 text-right">IGST</th>
                ) : (
                  <>
                    <th className="border-b border-white/[0.06] px-3 py-2.5 text-right">CGST</th>
                    <th className="border-b border-white/[0.06] px-3 py-2.5 text-right">SGST</th>
                  </>
                )}
                <th className="border-b border-white/[0.06] px-3 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`row-${r.lineNumber}`}
                  className="border-t border-white/[0.04] align-top transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 text-center text-zinc-500">{r.lineNumber}</td>
                  <td className="px-3 py-2 font-medium text-zinc-200">{r.description}</td>
                  <td className="px-3 py-2 text-center text-zinc-400">{r.hsnCode}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.quantity}</td>
                  <td className="px-3 py-2 text-center text-zinc-400">{r.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                    {formatCurrency(r.unitPrice)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                    {formatCurrency(r.taxableValue)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-zinc-300">{r.gstRate}%</td>
                  {isInterState ? (
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                      {formatCurrency(r.igst)}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                        {formatCurrency(r.cgst)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                        {formatCurrency(r.sgst)}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-100">
                    {formatCurrency(r.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function GstTab({ invoice }: { invoice: DetailedInvoice }) {
  const rows = useMemo(() => deriveItems(invoice), [invoice]);
  const slabs = useMemo(() => deriveSlabBreakdown(invoice, rows), [invoice, rows]);

  const taxable = NUMBER(invoice.taxableValue);
  const cgst = NUMBER(invoice.cgst);
  const sgst = NUMBER(invoice.sgst);
  const igst = NUMBER(invoice.igst);
  const cess = NUMBER(invoice.cess);
  const totalGst = cgst + sgst + igst + cess;
  const total = NUMBER(invoice.totalAmount);
  const roundOff = total - (taxable + totalGst);
  const isInterState = igst > 0;

  const maxSlabTaxable = Math.max(1, ...slabs.map((s) => s.taxable));

  const breakdownRows: Array<{ label: string; value: string; muted?: boolean; bold?: boolean }> = [
    { label: 'Taxable Value', value: formatCurrency(taxable) },
    ...(isInterState
      ? [{ label: 'IGST', value: formatCurrency(igst), muted: true }]
      : [
          { label: 'CGST', value: formatCurrency(cgst), muted: true },
          { label: 'SGST', value: formatCurrency(sgst), muted: true },
        ]),
    ...(cess > 0 ? [{ label: 'CESS', value: formatCurrency(cess), muted: true }] : []),
    { label: 'Total GST', value: formatCurrency(totalGst), bold: true },
    ...(Math.abs(roundOff) >= 0.5
      ? [
          {
            label: `Round Off (${roundOff >= 0 ? '+' : '−'})`,
            value: formatCurrency(Math.abs(roundOff)),
            muted: true,
          },
        ]
      : []),
    { label: 'Total Amount', value: formatCurrency(total), bold: true },
  ];

  return (
    <motion.div {...tabEnter} className="space-y-4">
      {/* Tax breakdown */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Tax Breakdown
        </p>
        <dl className="space-y-2">
          {breakdownRows.map((r, i) => (
            <div
              key={`gst-row-${i}`}
              className={cn(
                'flex items-center justify-between gap-3',
                r.bold && 'border-t border-white/[0.06] pt-2',
              )}
            >
              <span
                className={cn(
                  'text-xs',
                  r.bold ? 'font-bold uppercase tracking-wider text-zinc-200' : 'text-zinc-400',
                )}
              >
                {r.label}
              </span>
              <span
                className={cn(
                  'tabular-nums text-sm',
                  r.bold ? 'font-bold text-zinc-100' : 'font-semibold text-zinc-300',
                )}
              >
                {r.value}
              </span>
            </div>
          ))}
        </dl>
      </div>

      {/* GST slab breakdown chart */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Taxable Value by GST Slab
        </p>
        <div className="space-y-2.5">
          {slabs.map((s, i) => {
            const pct = Math.round((s.taxable / maxSlabTaxable) * 100);
            return (
              <div key={`slab-${i}`} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-zinc-300">
                    {s.slab}% slab
                  </span>
                  <span className="tabular-nums text-zinc-400">
                    {formatCurrency(s.taxable)} ·{' '}
                    <span className="text-amber-300/80">
                      {formatCurrency(s.tax)} tax
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function PaymentsTab({
  invoice,
  onMarkPaid,
  saving,
}: {
  invoice: DetailedInvoice;
  onMarkPaid?: () => void;
  saving?: boolean;
}) {
  const total = NUMBER(invoice.totalAmount);
  const paid = NUMBER(invoice.paidAmount);
  const balance = NUMBER(invoice.balanceAmount);
  const isPaid = balance <= 0 && total > 0;

  const details: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: string }> = [
    { icon: Receipt, label: 'Total Amount', value: formatCurrency(total) },
    { icon: CheckCircle2, label: 'Paid Amount', value: formatCurrency(paid), tone: 'text-blue-300' },
    { icon: Wallet, label: 'Balance Due', value: formatCurrency(balance), tone: balance > 0 ? 'text-amber-300' : 'text-blue-300' },
    { icon: Circle, label: 'Payment Status', value: (invoice.paymentStatus || 'unpaid').replace(/_/g, ' ') },
    { icon: CreditCard, label: 'Payment Mode', value: invoice.paymentMode ?? '—' },
    { icon: CalendarDays, label: 'Payment Date', value: formatDate(invoice.paymentDate) },
  ];

  return (
    <motion.div {...tabEnter} className="space-y-4">
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Payment Details
        </p>
        <dl className="grid grid-cols-2 gap-3">
          {details.map((d, i) => {
            const Icon = d.icon;
            return (
              <div
                key={`pay-${i}`}
                className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.04]"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-amber-300/80" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    {d.label}
                  </span>
                </div>
                <p
                  className={cn(
                    'truncate text-sm font-semibold capitalize text-zinc-100',
                    d.tone,
                  )}
                >
                  {d.value}
                </p>
              </div>
            );
          })}
        </dl>
      </div>

      {/* Status banner */}
      <div
        className={cn(
          'glass-surface rounded-2xl border p-4',
          isPaid
            ? 'border-blue-500/20 bg-blue-500/[0.04]'
            : 'border-amber-500/20 bg-amber-500/[0.04]',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              isPaid ? 'bg-blue-500/15' : 'bg-amber-500/15',
            )}
          >
            {isPaid ? (
              <CheckCircle2 className="h-4 w-4 text-blue-400" />
            ) : (
              <Clock className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-sm font-semibold',
                isPaid ? 'text-blue-300' : 'text-amber-300',
              )}
            >
              {isPaid
                ? 'Payment complete'
                : `Outstanding balance: ${formatCurrency(balance)}`}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
              {isPaid
                ? 'This invoice has been fully paid. You can still record an adjustment if needed.'
                : 'Record a payment to update the balance and notify the client.'}
            </p>
          </div>
        </div>
      </div>

      {/* Record Payment button */}
      {onMarkPaid && (
        <Button
          type="button"
          onClick={onMarkPaid}
          disabled={saving || isPaid}
          loading={saving}
          className="w-full gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isPaid ? 'Already Paid' : 'Record Payment'}
        </Button>
      )}
    </motion.div>
  );
}

function PreviewTab({
  invoice,
  client,
  organization,
  onPrint,
  onDownloadPdf,
  onSendEmail,
  onShare,
  onMarkPaid,
  saving,
}: {
  invoice: DetailedInvoice;
  client?: ApiClient | null;
  organization?: InvoiceDetailsOrganization | null;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onSendEmail?: () => void;
  onShare?: () => void;
  onMarkPaid?: () => void;
  saving?: boolean;
}) {
  return (
    <motion.div
      {...tabEnter}
      className="rounded-2xl bg-black p-2 ring-1 ring-white/[0.06]"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        <InvoiceA4Preview
          invoice={invoice}
          client={client ?? null}
          organization={organization ?? null}
          onPrint={onPrint}
          onDownloadPdf={onDownloadPdf}
          onSendEmail={onSendEmail}
          onShare={onShare}
          onMarkPaid={onMarkPaid}
          loadingAction={saving}
        />
      </div>
    </motion.div>
  );
}

function HistoryTab({ invoice }: { invoice: DetailedInvoice }) {
  const events = useMemo(() => deriveHistory(invoice), [invoice]);

  if (events.length === 0) {
    return (
      <motion.div {...tabEnter}>
        <div className="glass-surface flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-8 text-center">
          <Clock className="h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm font-semibold text-zinc-300">
            No history available
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Status changes will appear here as the invoice progresses through
            its lifecycle.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...tabEnter}>
      <div className="glass-surface rounded-2xl border border-white/[0.06] p-4">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Status Timeline
        </p>
        <ol className="relative space-y-4 border-l border-white/[0.08] pl-5">
          {events.map((ev, i) => {
            const Icon = ev.icon;
            return (
              <li key={`ev-${i}`} className="relative">
                <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-white/[0.08]">
                  <Icon className={cn('h-3 w-3', ev.tone)} />
                </span>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold capitalize text-zinc-200">
                      {ev.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {formatDateTime(ev.timestamp)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </motion.div>
  );
}

// ─── Sticky action bar ───────────────────────────────────────────────────────

function ActionBar({
  onEdit,
  onSendEmail,
  onMarkPaid,
  onDuplicate,
  onPrint,
  onDownloadPdf,
  onShare,
  onArchive,
  onDelete,
  saving,
}: {
  onEdit?: () => void;
  onSendEmail?: () => void;
  onMarkPaid?: () => void;
  onDuplicate?: () => void;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onShare?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  saving?: boolean;
}) {
  return (
    <div className="border-t border-white/[0.06] bg-black/95 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {onEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={saving}
            className="gap-1.5 rounded-lg border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        )}
        {onSendEmail && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSendEmail}
            disabled={saving}
            className="gap-1.5 rounded-lg border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08] hover:text-white"
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send Email</span>
          </Button>
        )}
        {onMarkPaid && (
          <Button
            type="button"
            size="sm"
            onClick={onMarkPaid}
            disabled={saving}
            loading={saving}
            className="gap-1.5 rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mark Paid</span>
          </Button>
        )}
        {onDuplicate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            disabled={saving}
            className="gap-1.5 rounded-lg text-zinc-300 hover:bg-white/[0.06] hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Duplicate</span>
          </Button>
        )}

        {/* More dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto gap-1.5 rounded-lg text-zinc-300 hover:bg-white/[0.06] hover:text-white"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 rounded-xl border-white/[0.08] bg-zinc-950/95 text-zinc-200 backdrop-blur-xl"
          >
            {onPrint && (
              <DropdownMenuItem
                onClick={onPrint}
                className="gap-2 rounded-lg focus:bg-white/[0.06] focus:text-white"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </DropdownMenuItem>
            )}
            {onDownloadPdf && (
              <DropdownMenuItem
                onClick={onDownloadPdf}
                className="gap-2 rounded-lg focus:bg-white/[0.06] focus:text-white"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </DropdownMenuItem>
            )}
            {onShare && (
              <DropdownMenuItem
                onClick={onShare}
                className="gap-2 rounded-lg focus:bg-white/[0.06] focus:text-white"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            {onArchive && (
              <DropdownMenuItem
                onClick={onArchive}
                className="gap-2 rounded-lg focus:bg-white/[0.06] focus:text-white"
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 rounded-lg text-red-300 focus:bg-red-500/10 focus:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function InvoiceDetailsSheet({
  open,
  onOpenChange,
  invoice,
  client,
  organization,
  onEdit,
  onSendEmail,
  onMarkPaid,
  onDuplicate,
  onPrint,
  onDownloadPdf,
  onShare,
  onArchive,
  onDelete,
  fetchInsights: _fetchInsights,
  saving,
}: InvoiceDetailsSheetProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');

  // The fetchInsights prop is reserved for parent wiring of VEYRO AI panel.
  // We accept it here so the parent can pass the same hook surface; the panel
  // itself lives in <InvoiceOraclePanel> outside this Sheet.
  void _fetchInsights;

  if (!invoice) {
    // Render the Sheet shell so close animations still play. The body is empty.
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="border-white/[0.06] bg-black p-0 sm:max-w-3xl"
        >
          <SheetHeader className="px-6 pt-6">
            <SheetTitle className="text-white">Invoice details</SheetTitle>
            <SheetDescription className="text-zinc-400">
              No invoice selected.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const detailedInvoice = invoice as DetailedInvoice;
  const clientName = detailedInvoice.buyerName ?? client?.tradeName ?? '—';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 border-white/[0.06] bg-black p-0 sm:max-w-3xl"
      >
        {/* ─── Title section (fixed at top) ────────────────────────────── */}
        <div className="border-b border-white/[0.06] bg-zinc-950/95 px-4 py-4 pr-12 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-2 text-base font-bold text-white">
                <Receipt className="h-4 w-4 text-amber-300" />
                <span className="truncate">
                  {detailedInvoice.invoiceNumber || 'Invoice'}
                </span>
              </SheetTitle>
              {/* NOTE: SheetDescription renders a <p> by default, but we put
                  <Separator> (a <div>) and <StatusPill> inside it, which is
                  invalid HTML (<div> cannot descend from <p>) and triggers
                  React hydration warnings. Render as a <div> instead. */}
              <SheetDescription
                asChild
                className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400"
              >
                <div>
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {clientName}
                  </span>
                  <Separator orientation="vertical" className="h-3 bg-white/10" />
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(detailedInvoice.invoiceDate)}
                  </span>
                  <Separator orientation="vertical" className="h-3 bg-white/10" />
                  <StatusPill status={detailedInvoice.status} />
                </div>
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-right ring-1 ring-white/[0.06]">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Total
                </p>
                <p className="text-sm font-bold text-blue-300">
                  {formatCurrency(NUMBER(detailedInvoice.totalAmount))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabs (fills remaining height) ────────────────────────────── */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          {/* Tabs nav — horizontally scrollable on mobile */}
          <div className="border-b border-white/[0.06] bg-zinc-950/95 px-4 py-2 backdrop-blur-xl sm:px-6">
            <div className="overflow-x-auto">
              <TabsList className="h-9 w-max gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                <TabsTrigger
                  value="overview"
                  className="rounded-lg data-[state=active]:bg-amber-400/15 data-[state=active]:text-amber-200 data-[state=active]:shadow-none"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="items"
                  className="rounded-lg data-[state=active]:bg-amber-400/15 data-[state=active]:text-amber-200 data-[state=active]:shadow-none"
                >
                  Items
                </TabsTrigger>
                <TabsTrigger
                  value="gst"
                  className="rounded-lg data-[state=active]:bg-amber-400/15 data-[state=active]:text-amber-200 data-[state=active]:shadow-none"
                >
                  GST
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="rounded-lg data-[state=active]:bg-amber-400/15 data-[state=active]:text-amber-200 data-[state=active]:shadow-none"
                >
                  Payments
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="rounded-lg data-[state=active]:bg-amber-400/15 data-[state=active]:text-amber-200 data-[state=active]:shadow-none"
                >
                  Preview
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="rounded-lg data-[state=active]:bg-amber-400/15 data-[state=active]:text-amber-200 data-[state=active]:shadow-none"
                >
                  History
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* ─── Tab content (scrollable) ──────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <TabsContent value="overview" className="mt-0 focus-visible:outline-none" tabIndex={-1}>
              <OverviewTab invoice={detailedInvoice} client={client ?? null} />
            </TabsContent>
            <TabsContent value="items" className="mt-0 focus-visible:outline-none" tabIndex={-1}>
              <ItemsTab invoice={detailedInvoice} />
            </TabsContent>
            <TabsContent value="gst" className="mt-0 focus-visible:outline-none" tabIndex={-1}>
              <GstTab invoice={detailedInvoice} />
            </TabsContent>
            <TabsContent value="payments" className="mt-0 focus-visible:outline-none" tabIndex={-1}>
              <PaymentsTab
                invoice={detailedInvoice}
                onMarkPaid={onMarkPaid}
                saving={saving}
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-0 focus-visible:outline-none" tabIndex={-1}>
              <PreviewTab
                invoice={detailedInvoice}
                client={client ?? null}
                organization={organization ?? null}
                onPrint={onPrint}
                onDownloadPdf={onDownloadPdf}
                onSendEmail={onSendEmail}
                onShare={onShare}
                onMarkPaid={onMarkPaid}
                saving={saving}
              />
            </TabsContent>
            <TabsContent value="history" className="mt-0 focus-visible:outline-none" tabIndex={-1}>
              <HistoryTab invoice={detailedInvoice} />
            </TabsContent>
          </div>
        </Tabs>

        {/* ─── Sticky action bar (bottom) ───────────────────────────────── */}
        <ActionBar
          onEdit={onEdit}
          onSendEmail={onSendEmail}
          onMarkPaid={onMarkPaid}
          onDuplicate={onDuplicate}
          onPrint={onPrint}
          onDownloadPdf={onDownloadPdf}
          onShare={onShare}
          onArchive={onArchive}
          onDelete={onDelete}
          saving={saving}
        />
      </SheetContent>
    </Sheet>
  );
}

export default InvoiceDetailsSheet;
