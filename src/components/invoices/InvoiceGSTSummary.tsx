'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoiceGSTSummary
//
// The third row of the rebuilt Invoice Builder — three premium cards side by
// side:
//   1. GST SUMMARY  — premium metric cards for Taxable Value / CGST / SGST /
//                     IGST / CESS / Grand Total (large numbers, .gst-metric).
//   2. TOTALS       — the breakdown stack: Subtotal → GST → CESS → Round Off
//                     → Total Amount Payable (large, prominent).
//   3. NOTES        — Notes (on invoice) + Finance Notes (internal) + T&C +
//                     Bank Details, in a 2×2 grid.
//
// All cards use the .gst-card system. Numbers are LARGE (gst-metric, 28px),
// tabular-nums, blue accent on Grand Total.
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Sparkles, Hash, StickyNote, Lock, Landmark, IndianRupee, Percent, TrendingUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/gst-utils';
import {
  SectionCard,
  FieldLabel,
  HelperText,
  PREMIUM_TEXTAREA_CLASSNAMES,
} from './builder/ui';
import { STATE_CODE_TO_NAME, DEFAULT_NOTES, DEFAULT_TERMS, DEFAULT_BANK_DETAILS } from './builder/constants';
import type { LineItem } from './builder/types';

export interface InvoiceGSTSummaryProps {
  totals: {
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    roundOff: number;
    total: number;
  };
  interState: boolean;
  sellerStateCode: string;
  buyerStateCode: string;
  items: LineItem[];

  // Notes
  notes: string;
  onNotesChange: (v: string) => void;

  notesFinance: string;
  onNotesFinanceChange: (v: string) => void;

  terms: string;
  onTermsChange: (v: string) => void;

  bankDetails: string;
  onBankDetailsChange: (v: string) => void;
}

export function InvoiceGSTSummary({
  totals,
  interState,
  sellerStateCode,
  buyerStateCode,
  items,
  notes,
  onNotesChange,
  notesFinance,
  onNotesFinanceChange,
  terms,
  onTermsChange,
  bankDetails,
  onBankDetailsChange,
}: InvoiceGSTSummaryProps) {
  const gstAmount = totals.cgst + totals.sgst + totals.igst + totals.cess;
  const sellerStateName = sellerStateCode ? STATE_CODE_TO_NAME[sellerStateCode] ?? '—' : '—';
  const buyerStateName = buyerStateCode ? STATE_CODE_TO_NAME[buyerStateCode] ?? '—' : '—';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ── Card 1: GST Summary (premium metric cards) ─────────────────────── */}
      <SectionCard
        icon={<Sparkles className="h-5 w-5" />}
        title="GST Summary"
        description="Live totals — recomputed on every keystroke."
        className="lg:col-span-1"
      >
        {/* Metric grid — 2 cols */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Taxable Value"
            value={formatCurrency(totals.subtotal)}
            icon={<IndianRupee className="h-4 w-4" />}
            tone="neutral"
          />
          {interState ? (
            <MetricCard
              label="IGST"
              value={formatCurrency(totals.igst)}
              icon={<Percent className="h-4 w-4" />}
              tone="warning"
            />
          ) : (
            <>
              <MetricCard
                label="CGST"
                value={formatCurrency(totals.cgst)}
                icon={<Percent className="h-4 w-4" />}
                tone="info"
              />
              <MetricCard
                label="SGST"
                value={formatCurrency(totals.sgst)}
                icon={<Percent className="h-4 w-4" />}
                tone="info"
              />
            </>
          )}
          <MetricCard
            label="CESS"
            value={formatCurrency(totals.cess)}
            icon={<Percent className="h-4 w-4" />}
            tone="neutral"
          />
          <MetricCard
            label="Round Off"
            value={`${totals.roundOff >= 0 ? '+' : '−'}${formatCurrency(Math.abs(totals.roundOff))}`}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="neutral"
          />
        </div>

        {/* Grand total — large, prominent, gst-metric */}
        <div className="mt-5 rounded-lg border border-[#2563EB]/30 bg-gradient-to-br from-[#2563EB]/[0.08] to-transparent p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="gst-label text-[11px] uppercase tracking-wider text-[#60A5FA]">
                Grand Total
              </div>
              <div className="gst-caption mt-0.5 text-muted-foreground">
                incl. GST {formatCurrency(gstAmount)}
              </div>
            </div>
            <div className="gst-metric text-[28px] text-[#60A5FA] sm:text-[32px]">
              {formatCurrency(totals.total)}
            </div>
          </div>
        </div>

        {/* Slab breakdown */}
        <div className="mt-5 space-y-2 border-t border-[#2A2E36] pt-4">
          <SlabBreakdownBars items={items} />
          <div className="flex justify-between py-0.5 text-[12px]">
            <span className="text-muted-foreground">GST type</span>
            <span className="text-foreground">{interState ? 'IGST' : 'CGST + SGST'}</span>
          </div>
          <div className="flex justify-between py-0.5 text-[12px]">
            <span className="text-muted-foreground">Seller state</span>
            <span className="text-foreground">
              {sellerStateName} {sellerStateCode ? `(${sellerStateCode})` : ''}
            </span>
          </div>
          <div className="flex justify-between py-0.5 text-[12px]">
            <span className="text-muted-foreground">Buyer state</span>
            <span className="text-foreground">
              {buyerStateName} {buyerStateCode ? `(${buyerStateCode})` : ''}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Card 2: Totals (breakdown stack) ─────────────────────────────── */}
      <SectionCard
        icon={<Hash className="h-5 w-5" />}
        title="Totals"
        description="How the invoice total is built up."
      >
        <div className="space-y-1">
          <SummaryRow label="Subtotal (Taxable)" value={formatCurrency(totals.subtotal)} />
          {interState ? (
            <SummaryRow label="IGST" value={formatCurrency(totals.igst)} muted />
          ) : (
            <>
              <SummaryRow label="CGST" value={formatCurrency(totals.cgst)} muted />
              <SummaryRow label="SGST" value={formatCurrency(totals.sgst)} muted />
            </>
          )}
          {totals.cess > 0 ? <SummaryRow label="CESS" value={formatCurrency(totals.cess)} muted /> : null}
          <SummaryRow
            label="Round Off"
            value={`${totals.roundOff >= 0 ? '+' : '−'}${formatCurrency(Math.abs(totals.roundOff))}`}
            muted
          />
        </div>

        <div className="mt-5 space-y-3 border-t border-[#2A2E36] pt-4">
          <div className="flex items-center justify-between rounded-md bg-[#0F1115] px-3 py-2">
            <span className="gst-label text-[12px] uppercase tracking-wider text-muted-foreground">
              Total GST
            </span>
            <span className="text-[15px] font-semibold tabular-nums text-foreground">
              {formatCurrency(gstAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-[#2563EB]/10 px-3 py-2">
            <span className="gst-label text-[12px] uppercase tracking-wider text-[#60A5FA]">
              Total Payable
            </span>
            <span className="text-[17px] font-bold tabular-nums text-[#60A5FA]">
              {formatCurrency(totals.total)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#2A2E36] pt-4">
          <MiniStat label="Line items" value={String(items.length)} />
          <MiniStat
            label="Avg. line value"
            value={items.length > 0 ? formatCurrency(totals.subtotal / items.length) : '—'}
          />
        </div>
      </SectionCard>

      {/* ── Card 3: Notes & Terms ────────────────────────────────────────── */}
      <SectionCard
        icon={<StickyNote className="h-5 w-5" />}
        title="Notes & Terms"
        description="Pre-filled with sensible defaults."
      >
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="notes-customer" hint="on invoice">
              Notes
            </FieldLabel>
            <Textarea
              id="notes-customer"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={DEFAULT_NOTES}
              rows={3}
              className={cn(PREMIUM_TEXTAREA_CLASSNAMES, 'text-[14px]')}
            />
            <HelperText>Visible to the buyer on the invoice.</HelperText>
          </div>
          <div>
            <FieldLabel htmlFor="notes-finance" hint="internal only">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" /> Finance Notes
              </span>
            </FieldLabel>
            <Textarea
              id="notes-finance"
              value={notesFinance}
              onChange={(e) => onNotesFinanceChange(e.target.value)}
              placeholder="Internal team notes — never shown on the invoice."
              rows={3}
              className={cn(PREMIUM_TEXTAREA_CLASSNAMES, 'text-[14px]')}
            />
            <HelperText>Only visible to your team.</HelperText>
          </div>
          <div>
            <FieldLabel htmlFor="terms">Terms &amp; Conditions</FieldLabel>
            <Textarea
              id="terms"
              value={terms}
              onChange={(e) => onTermsChange(e.target.value)}
              placeholder={DEFAULT_TERMS}
              rows={4}
              className={cn(PREMIUM_TEXTAREA_CLASSNAMES, 'text-[13px] leading-relaxed')}
            />
          </div>
          <div>
            <FieldLabel htmlFor="bank-details" hint="auto-filled">
              <span className="inline-flex items-center gap-1">
                <Landmark className="h-3 w-3" /> Bank Details
              </span>
            </FieldLabel>
            <Textarea
              id="bank-details"
              value={bankDetails}
              onChange={(e) => onBankDetailsChange(e.target.value)}
              placeholder={DEFAULT_BANK_DETAILS}
              rows={4}
              className={cn(PREMIUM_TEXTAREA_CLASSNAMES, 'text-[13px] leading-relaxed')}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'border-[#2A2E36] bg-[#0F1115] text-foreground',
    info: 'border-[#2563EB]/30 bg-[#2563EB]/[0.06] text-[#60A5FA]',
    warning: 'border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] text-[#FBBF24]',
    success: 'border-[#2563EB]/30 bg-[#2563EB]/[0.06] text-[#34D399]',
    danger: 'border-[#EF4444]/30 bg-[#EF4444]/[0.06] text-[#F87171]',
  };
  return (
    <div className={cn('rounded-lg border p-3 transition-colors', toneClasses[tone])}>
      <div className="flex items-center gap-1.5 gst-caption text-[11px] uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[18px] font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-1 py-1.5 text-[14px]">
      <span className={cn('gst-body', muted ? 'text-muted-foreground' : 'text-foreground')}>{label}</span>
      <span
        className={cn(
          'tabular-nums font-medium',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#0F1115] p-2.5">
      <div className="gst-caption text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

/** Mini horizontal bars showing each GST slab's contribution to the subtotal. */
function SlabBreakdownBars({
  items,
}: {
  items: Array<{ gstRate: number; taxableValue: number }>;
}) {
  const slabs = React.useMemo(() => {
    const map = new Map<number, number>();
    for (const it of items) {
      const r = Number(it.gstRate) || 0;
      map.set(r, (map.get(r) ?? 0) + (Number(it.taxableValue) || 0));
    }
    const arr = Array.from(map.entries())
      .map(([rate, taxable]) => ({ rate, taxable }))
      .sort((a, b) => a.rate - b.rate);
    const max = arr.reduce((m, s) => Math.max(m, s.taxable), 0);
    return { arr, max };
  }, [items]);

  if (slabs.arr.length === 0 || slabs.max === 0) {
    return <p className="gst-caption text-[12px]">Add line items to see the slab breakdown.</p>;
  }

  const SLAB_COLORS: Record<number, string> = {
    0: 'bg-zinc-500',
    5: 'bg-sky-500',
    12: 'bg-blue-500',
    18: 'bg-cyan-500',
    28: 'bg-amber-500',
  };

  return (
    <div className="space-y-2">
      <div className="gst-label text-[11px] uppercase tracking-wider text-muted-foreground">
        Slab breakdown
      </div>
      {slabs.arr.map((s) => {
        const pct = slabs.max > 0 ? (s.taxable / slabs.max) * 100 : 0;
        return (
          <div key={s.rate} className="flex items-center gap-2">
            <span className="w-9 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
              {s.rate}%
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#2A2E36]">
              <div
                className={cn('h-full rounded-full', SLAB_COLORS[s.rate] ?? 'bg-[#2563EB]')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-foreground">
              {formatCurrency(s.taxable)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
