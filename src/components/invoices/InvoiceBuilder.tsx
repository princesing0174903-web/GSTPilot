'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoiceBuilder
//
// The premium "Create Invoice" / "Edit Invoice" dialog. A billion-dollar SaaS
// builder with smart GST calculations, live totals, searchable client picker,
// and the same dark-glass design language as InvoiceA4Preview.
//
// Design system:
//   • Dark glass surfaces (bg-white/[0.03], border-white/[0.06], rounded-2xl).
//   • Emerald primary actions, gold Oracle accent for AI hints, zinc neutrals.
//   • Framer Motion entrance (fade + scale + slide-up).
//   • Wide Dialog (max-w-5xl) with scrollable body, sticky header + footer.
//   • Smart GST: auto inter-state detection (sellerGstin vs buyerGstin first 2
//     digits), auto CGST/SGST vs IGST, auto CESS, auto round-off.
//   • Live GST summary card with mini slab-breakdown bars.
//   • Money inputs show ₹ prefix via formatCurrency for display; raw number
//     kept in state for accurate math.
//
// Spec compliance: Task 3-b (Invoice Builder).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  IndianRupee,
  Search,
  UserPlus,
  Building2,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  Hash,
  FileText,
  StickyNote,
  Lock,
  Landmark,
  CreditCard,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/gst-utils';
import { toast } from 'sonner';
import type { ApiInvoice } from '@/hooks/useInvoicesApi';
import type { ApiClient } from '@/hooks/useClientsApi';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LineItem {
  key: string; // unique id for React key
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string; // NOS, PCS, KG, MTR, BOX
  unitPrice: number;
  discountPct: number;
  gstRate: number; // 0, 5, 12, 18, 28
  cessRate: number; // 0 by default
  taxableValue: number; // computed
  cgst: number; // computed
  sgst: number; // computed
  igst: number; // computed
  cess: number; // computed
  total: number; // computed
}

interface InvoiceBuilderOrganization {
  name: string;
  gstin: string;
  stateCode?: string;
}

interface InvoiceBuilderItemPayload {
  description: string;
  hsnCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPct?: number;
  gstRate: number;
  cessRate?: number;
}

interface InvoiceBuilderSubmitPayload {
  clientId?: string;
  customerName: string;
  buyerGstin?: string;
  sellerGstin?: string;
  date?: string;
  dueDate?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  items: InvoiceBuilderItemPayload[];
  notes?: string;
  notesFinance?: string;
  terms?: string;
  bankDetails?: string;
  reverseCharge?: boolean;
  placeOfSupply?: string;
  status?: 'draft' | 'sent';
}

export interface InvoiceBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ApiClient[];
  initialInvoice?: ApiInvoice | null;
  organization?: InvoiceBuilderOrganization | null;
  onSubmit: (payload: InvoiceBuilderSubmitPayload) => void | Promise<void>;
  saving?: boolean;
  onCreateClient?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GST_RATES = [0, 5, 12, 18, 28] as const;

const UNITS = ['NOS', 'PCS', 'KG', 'MTR', 'BOX'] as const;

const INVOICE_TYPES = [
  'B2B',
  'B2C Large',
  'B2C Small',
  'Export',
  'Credit Note',
  'Debit Note',
] as const;

const PAYMENT_TERMS_OPTIONS = [
  { value: '7', label: 'Net 7' },
  { value: '15', label: 'Net 15' },
  { value: '30', label: 'Net 30' },
  { value: '60', label: 'Net 60' },
] as const;

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Card'] as const;

/** Indian state codes (first 2 digits of GSTIN). Used for Place of Supply select
 *  and inter-state detection. */
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

const DEFAULT_TERMS = [
  '1. Payment is due within the agreed credit period from the date of invoice.',
  '2. Interest @ 18% p.a. will be charged on overdue invoices.',
  '3. All disputes are subject to local jurisdiction only.',
  '4. Goods once sold will not be taken back or exchanged.',
  '5. E. & O.E. — Errors and omissions excepted.',
].join('\n');

const DEFAULT_BANK_DETAILS = [
  'Bank Name: HDFC Bank Ltd.',
  'Account Name: <Your Company Name>',
  'Account No.: 000000000000000',
  'IFSC: HDFC0000000',
  'Branch: Bengaluru — MG Road',
  'UPI ID: yourcompany@hdfcbank',
].join('\n');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NUMBER = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clampNonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const addDaysISO = (iso: string, days: number): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayISO();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Generate a placeholder invoice number: INV-YYYY-#### */
function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit
  return `INV-${year}-${rand}`;
}

/** Extract the 2-digit state code from a GSTIN (first 2 chars). Returns '' if
 *  the GSTIN is too short or starts with non-digits. */
function stateCodeFromGstin(gstin: string | null | undefined): string {
  if (!gstin) return '';
  const m = /^(\d{2})/.exec(gstin.trim());
  return m ? m[1] : '';
}

/** Decide inter-state vs intra-state supply from seller + buyer GSTINs.
 *  Returns true if IGST applies (different states), false for CGST+SGST.
 *  Defaults to intra-state when either side is missing. */
function isInterStateSupply(
  sellerGstin: string | null | undefined,
  buyerGstin: string | null | undefined,
): boolean {
  const sellerState = stateCodeFromGstin(sellerGstin);
  const buyerState = stateCodeFromGstin(buyerGstin);
  if (!sellerState || !buyerState) return false;
  return sellerState !== buyerState;
}

/** Compute per-line GST math. Pure function — no side effects. */
function computeLineItem(
  item: Pick<
    LineItem,
    'quantity' | 'unitPrice' | 'discountPct' | 'gstRate' | 'cessRate'
  >,
  interState: boolean,
): { taxableValue: number; cgst: number; sgst: number; igst: number; cess: number; total: number } {
  const qty = clampNonNeg(NUMBER(item.quantity));
  const rate = clampNonNeg(NUMBER(item.unitPrice));
  const disc = clampNonNeg(NUMBER(item.discountPct));
  const gstPct = clampNonNeg(NUMBER(item.gstRate));
  const cessPct = clampNonNeg(NUMBER(item.cessRate));

  const taxableValue = round2(qty * rate * (1 - disc / 100));
  const gstAmount = round2((taxableValue * gstPct) / 100);
  const cess = round2((taxableValue * cessPct) / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (interState) {
    igst = gstAmount;
  } else {
    cgst = round2(gstAmount / 2);
    sgst = round2(gstAmount - cgst);
  }
  const total = round2(taxableValue + cgst + sgst + igst + cess);
  return { taxableValue, cgst, sgst, igst, cess, total };
}

/** Aggregate all line items into invoice-level totals. */
function computeTotals(
  items: Array<Pick<LineItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'cess' | 'total'>>,
): {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  total: number;
} {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  for (const it of items) {
    subtotal += NUMBER(it.taxableValue);
    cgst += NUMBER(it.cgst);
    sgst += NUMBER(it.sgst);
    igst += NUMBER(it.igst);
    cess += NUMBER(it.cess);
  }
  subtotal = round2(subtotal);
  cgst = round2(cgst);
  sgst = round2(sgst);
  igst = round2(igst);
  cess = round2(cess);
  const exactTotal = subtotal + cgst + sgst + igst + cess;
  const total = Math.round(exactTotal);
  const roundOff = round2(total - exactTotal);
  return { subtotal, cgst, sgst, igst, cess, roundOff, total };
}

/** Build a fresh empty line item with a unique key. */
let __lineKeyCounter = 0;
function makeEmptyLineItem(): LineItem {
  __lineKeyCounter += 1;
  return {
    key: `line-${Date.now().toString(36)}-${__lineKeyCounter}`,
    description: '',
    hsnCode: '',
    quantity: 1,
    unit: 'NOS',
    unitPrice: 0,
    discountPct: 0,
    gstRate: 18,
    cessRate: 0,
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
  };
}

/** Derive a LineItem from an existing invoice line (for Edit mode). */
function lineItemFromApiItem(
  it: {
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
  },
  interState: boolean,
): LineItem {
  __lineKeyCounter += 1;
  const gstRate =
    NUMBER(it.cgstRate) + NUMBER(it.sgstRate) + NUMBER(it.igstRate) + NUMBER(it.cessRate);
  // Re-derive discountPct is impossible from API; default to 0.
  const base: LineItem = {
    key: `line-${Date.now().toString(36)}-${__lineKeyCounter}`,
    description: it.description ?? '',
    hsnCode: it.hsnCode ?? '',
    quantity: NUMBER(it.quantity) || 1,
    unit: (it.unit as LineItem['unit']) || 'NOS',
    unitPrice: NUMBER(it.unitPrice),
    discountPct: 0,
    gstRate,
    cessRate: NUMBER(it.cessRate),
    taxableValue: NUMBER(it.taxableValue),
    cgst: NUMBER(it.cgst),
    sgst: NUMBER(it.sgst),
    igst: NUMBER(it.igst),
    cess: NUMBER(it.cess),
    total: NUMBER(it.totalAmount),
  };
  // Recompute to keep things consistent with the builder's math (rounding may
  // shift totals by ≤ ₹1; acceptable).
  const c = computeLineItem(base, interState);
  return { ...base, ...c };
}

/** Risk pill color logic from a numeric health score (0-100). */
function healthTone(score: number): { label: string; className: string } {
  if (score >= 80) return { label: 'Healthy', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  if (score >= 60) return { label: 'Fair', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  if (score >= 40) return { label: 'Watch', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
  return { label: 'Risk', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** A consistent glass card wrapper for each major section. */
function SectionCard({
  icon,
  title,
  description,
  right,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {icon ? (
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20">
              {icon}
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{description}</p>
            ) : null}
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Small label used inside form grids. */
function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Label className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
      {children}
      {hint ? <span className="ml-1 normal-case text-zinc-500">· {hint}</span> : null}
    </Label>
  );
}

/** Searchable client combobox (Popover + Command). */
function ClientCombobox({
  clients,
  value,
  onSelect,
  onCreateClient,
}: {
  clients: ApiClient[];
  value: ApiClient | null;
  onSelect: (client: ApiClient) => void;
  onCreateClient?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.tradeName, c.legalName, c.gstin, c.state].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'group flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-left text-sm',
              'transition-all hover:border-emerald-500/30 hover:bg-white/[0.05]',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
              value ? 'text-zinc-100' : 'text-zinc-500',
            )}
          >
            <span className="flex items-center gap-2.5 truncate">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="truncate">
                {value ? (
                  <>
                    <span className="font-medium text-zinc-100">{value.tradeName}</span>
                    <span className="ml-2 text-xs text-zinc-500">{value.gstin}</span>
                  </>
                ) : (
                  'Search client by name or GSTIN…'
                )}
              </span>
            </span>
            <Search className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-emerald-300" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] min-w-[320px] border-white/[0.08] bg-zinc-950/95 p-0 backdrop-blur-xl"
        >
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              placeholder="Type a name or GSTIN…"
              value={query}
              onValueChange={setQuery}
              className="text-sm"
            />
            <CommandList className="max-h-[280px]">
              <CommandEmpty className="py-6 text-center text-xs text-zinc-500">
                No clients match “{query}”.
              </CommandEmpty>
              <CommandGroup heading="Clients" className="text-zinc-300">
                {filtered.map((c) => {
                  const tone = healthTone(c.healthScore ?? 0);
                  return (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onSelect(c);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="gap-2 py-2 text-zinc-200 data-[selected=true]:bg-emerald-500/10 data-[selected=true]:text-emerald-200"
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{c.tradeName}</span>
                        <span className="ml-2 text-[11px] text-zinc-500">{c.gstin}</span>
                      </span>
                      <span
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                          tone.className,
                        )}
                      >
                        {tone.label}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-white/[0.06] p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (onCreateClient) onCreateClient();
                  else toast.info('Open the Customers module to add a new client.', { description: 'New clients appear here instantly.' });
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/10"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add new client
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {value.gstin ? 'GSTIN verified' : 'No GSTIN'}
          </Badge>
          <Badge
            variant="outline"
            className={cn('border-white/[0.08]', healthTone(value.healthScore ?? 0).className)}
          >
            Health {value.healthScore ?? 0}/100 · {healthTone(value.healthScore ?? 0).label}
          </Badge>
          {value.contactEmail ? (
            <span className="text-[11px] text-zinc-500">{value.contactEmail}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Mini horizontal bars showing each GST slab's contribution to the subtotal. */
function SlabBreakdownBars({
  items,
}: {
  items: Array<{ gstRate: number; taxableValue: number }>;
}) {
  const slabs = useMemo(() => {
    const map = new Map<number, number>();
    for (const it of items) {
      const r = NUMBER(it.gstRate);
      map.set(r, (map.get(r) ?? 0) + NUMBER(it.taxableValue));
    }
    const arr = Array.from(map.entries())
      .map(([rate, taxable]) => ({ rate, taxable }))
      .sort((a, b) => a.rate - b.rate);
    const max = arr.reduce((m, s) => Math.max(m, s.taxable), 0);
    return { arr, max };
  }, [items]);

  if (slabs.arr.length === 0 || slabs.max === 0) {
    return (
      <p className="text-[11px] text-zinc-500">Add line items to see the slab breakdown.</p>
    );
  }

  const SLAB_COLORS: Record<number, string> = {
    0: 'bg-zinc-500',
    5: 'bg-sky-500',
    12: 'bg-violet-500',
    18: 'bg-emerald-500',
    28: 'bg-amber-500',
  };

  return (
    <div className="space-y-2">
      {slabs.arr.map((s) => {
        const pct = slabs.max > 0 ? (s.taxable / slabs.max) * 100 : 0;
        return (
          <div key={s.rate} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11px] font-medium tabular-nums text-zinc-400">
              {s.rate}%
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className={cn('h-full rounded-full', SLAB_COLORS[s.rate] ?? 'bg-emerald-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">
              {formatCurrency(s.taxable)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Money input — ₹ prefix, numeric only, clamped to ≥ 0. */
const MoneyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { value: number; onValueChange: (n: number) => void }
>(function MoneyInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <div
      className={cn(
        'group flex h-9 items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2',
        'transition-all focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/30',
        className,
      )}
    >
      <span className="mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500 group-focus-within:text-emerald-300">
        <IndianRupee className="h-3.5 w-3.5" />
      </span>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onValueChange(clampNonNeg(n));
        }}
        className="w-full bg-transparent text-right text-sm tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600"
        {...props}
      />
    </div>
  );
});

/** Numeric input — no ₹ prefix, clamped to ≥ 0. */
const NumberInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { value: number; onValueChange: (n: number) => void }
>(function NumberInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const n = Number(e.target.value);
        onValueChange(clampNonNeg(n));
      }}
      className={cn(
        'h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-right text-sm tabular-nums text-zinc-100 outline-none',
        'transition-all focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/30',
        'placeholder:text-zinc-600',
        className,
      )}
      {...props}
    />
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

export function InvoiceBuilder({
  open,
  onOpenChange,
  clients,
  initialInvoice = null,
  organization = null,
  onSubmit,
  saving = false,
  onCreateClient,
}: InvoiceBuilderProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState<string | null>(null);
  const [buyerGstin, setBuyerGstin] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(todayISO());
  const [dueDate, setDueDate] = useState<string>(addDaysISO(todayISO(), 30));
  const [invoiceType, setInvoiceType] = useState<string>('B2B');
  const [placeOfSupply, setPlaceOfSupply] = useState<string>('');
  const [reverseCharge, setReverseCharge] = useState<boolean>(false);
  const [items, setItems] = useState<LineItem[]>(() => [makeEmptyLineItem()]);
  const [notes, setNotes] = useState<string>('');
  const [notesFinance, setNotesFinance] = useState<string>('');
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);
  const [bankDetails, setBankDetails] = useState<string>(DEFAULT_BANK_DETAILS);
  const [paymentTermsDays, setPaymentTermsDays] = useState<string>('30');
  const [paymentModeHint, setPaymentModeHint] = useState<string>('UPI');
  const [showCess, setShowCess] = useState<boolean>(false);
  const [clientComboboxOpen, setClientComboboxOpen] = useState<boolean>(false);
  void clientComboboxOpen; // reserved for future external control

  // ── Reset / hydrate state when the dialog opens or initialInvoice changes ─
  const lastInitIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-init only once per open (or when the initialInvoice id changes).
    const initId = initialInvoice?.id ?? '__new__';
    if (lastInitIdRef.current === initId) return;
    lastInitIdRef.current = initId;

    if (initialInvoice) {
      setClientId(initialInvoice.clientId ?? null);
      setBuyerGstin(initialInvoice.buyerGstin ?? '');
      setBuyerName(initialInvoice.buyerName ?? '');
      setInvoiceNumber(initialInvoice.invoiceNumber ?? generateInvoiceNumber());
      setInvoiceDate(initialInvoice.invoiceDate?.slice(0, 10) ?? todayISO());
      setDueDate(initialInvoice.dueDate?.slice(0, 10) ?? addDaysISO(todayISO(), 30));
      setInvoiceType(initialInvoice.invoiceType || 'B2B');
      setReverseCharge(Boolean((initialInvoice as ApiInvoice & { reverseCharge?: boolean }).reverseCharge));
      setNotes(initialInvoice.notes ?? '');
      setNotesFinance((initialInvoice as ApiInvoice & { notesFinance?: string }).notesFinance ?? '');
      setTerms(DEFAULT_TERMS);
      setBankDetails(DEFAULT_BANK_DETAILS);

      // Build line items from invoice.items[] if available, else one aggregated row.
      const apiItems = (initialInvoice as ApiInvoice & {
        items?: Array<Record<string, unknown>>;
      }).items;
      const interState = isInterStateSupply(initialInvoice.sellerGstin, initialInvoice.buyerGstin);
      if (Array.isArray(apiItems) && apiItems.length > 0) {
        setItems(apiItems.map((it) => lineItemFromApiItem(it as Parameters<typeof lineItemFromApiItem>[0], interState)));
      } else {
        // Synthesize one aggregated row from invoice-level totals.
        const line = makeEmptyLineItem();
        line.description = 'Aggregated invoice total';
        line.unit = 'LOT';
        line.quantity = 1;
        line.unitPrice = NUMBER(initialInvoice.taxableValue);
        const taxable = NUMBER(initialInvoice.taxableValue);
        const gstTotal =
          NUMBER(initialInvoice.cgst) + NUMBER(initialInvoice.sgst) + NUMBER(initialInvoice.igst);
        const gstRate = taxable > 0 ? Math.round((gstTotal / taxable) * 100) : 0;
        line.gstRate = gstRate;
        const computed = computeLineItem(line, interState);
        setItems([{ ...line, ...computed }]);
      }
      // Derive place of supply from buyerGstin first 2 digits.
      const code = stateCodeFromGstin(initialInvoice.buyerGstin);
      setPlaceOfSupply(code || '');
      // Payment terms derived from invoiceDate vs dueDate.
      const diffDays = Math.round(
        (new Date(initialInvoice.dueDate ?? todayISO()).getTime() -
          new Date(initialInvoice.invoiceDate ?? todayISO()).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if ([7, 15, 30, 60].includes(diffDays)) {
        setPaymentTermsDays(String(diffDays));
      } else {
        setPaymentTermsDays('30');
      }
    } else {
      // Fresh invoice — sensible defaults.
      setClientId(null);
      setBuyerGstin('');
      setBuyerName('');
      setInvoiceNumber(generateInvoiceNumber());
      setInvoiceDate(todayISO());
      setDueDate(addDaysISO(todayISO(), 30));
      setInvoiceType('B2B');
      setPlaceOfSupply('');
      setReverseCharge(false);
      setItems([makeEmptyLineItem()]);
      setNotes('');
      setNotesFinance('');
      setTerms(DEFAULT_TERMS);
      setBankDetails(DEFAULT_BANK_DETAILS);
      setPaymentTermsDays('30');
      setPaymentModeHint('UPI');
    }
  }, [open, initialInvoice]);

  // Reset the init tracker when the dialog closes so reopening re-hydrates.
  useEffect(() => {
    if (!open) {
      lastInitIdRef.current = null;
    }
  }, [open]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const sellerGstin = organization?.gstin ?? '';
  const sellerStateCode = stateCodeFromGstin(sellerGstin);
  const buyerStateCode = stateCodeFromGstin(buyerGstin);
  const interState = useMemo(
    () => isInterStateSupply(sellerGstin, buyerGstin),
    [sellerGstin, buyerGstin],
  );

  // Recompute every line item with current inter-state flag.
  const computedItems = useMemo(
    () =>
      items.map((it) => {
        const c = computeLineItem(it, interState);
        return { ...it, ...c };
      }),
    [items, interState],
  );

  const totals = useMemo(() => computeTotals(computedItems), [computedItems]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  // Live GST amount (for header subtitle).
  const gstAmount = totals.cgst + totals.sgst + totals.igst + totals.cess;

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectClient = useCallback((client: ApiClient) => {
    setClientId(client.id);
    setBuyerGstin(client.gstin ?? '');
    setBuyerName(client.tradeName ?? client.legalName ?? '');
    const code = stateCodeFromGstin(client.gstin);
    if (code) setPlaceOfSupply(code);
  }, []);

  const addLineItem = useCallback(() => {
    setItems((prev) => [...prev, makeEmptyLineItem()]);
  }, []);

  const removeLineItem = useCallback((key: string) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        // Always keep at least one row — replace with a fresh empty row.
        return [makeEmptyLineItem()];
      }
      return prev.filter((it) => it.key !== key);
    });
  }, []);

  const duplicateLineItem = useCallback((key: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], key: `line-${Date.now().toString(36)}-${++__lineKeyCounter}` };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const moveLineItem = useCallback((key: string, dir: 'up' | 'down') => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx === -1) return prev;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const updateLineItem = useCallback(
    <K extends keyof LineItem>(key: string, field: K, value: LineItem[K]) => {
      setItems((prev) =>
        prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)),
      );
    },
    [],
  );

  const setDueDatePreset = useCallback(
    (days: number) => {
      setPaymentTermsDays(String(days));
      setDueDate(addDaysISO(invoiceDate, days));
    },
    [invoiceDate],
  );

  // When paymentTermsDays changes via the Payment Section select, recompute due date.
  const onPaymentTermsChange = useCallback(
    (val: string) => {
      setPaymentTermsDays(val);
      const days = Number(val);
      if (Number.isFinite(days) && days > 0) {
        setDueDate(addDaysISO(invoiceDate, days));
      }
    },
    [invoiceDate],
  );

  // When invoiceDate changes, also nudge dueDate to keep the same term gap.
  const onInvoiceDateChange = useCallback(
    (newDate: string) => {
      setInvoiceDate(newDate);
      const days = Number(paymentTermsDays);
      if (Number.isFinite(days) && days > 0) {
        setDueDate(addDaysISO(newDate, days));
      }
    },
    [paymentTermsDays],
  );

  const buildPayload = useCallback(
    (status: 'draft' | 'sent'): InvoiceBuilderSubmitPayload => ({
      clientId: clientId ?? undefined,
      customerName: buyerName || selectedClient?.tradeName || 'Valued Customer',
      buyerGstin: buyerGstin || undefined,
      sellerGstin: sellerGstin || undefined,
      date: invoiceDate,
      dueDate,
      invoiceNumber,
      invoiceType,
      items: computedItems.map((it) => ({
        description: it.description || 'Line item',
        hsnCode: it.hsnCode || undefined,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
        gstRate: it.gstRate,
        cessRate: it.cessRate,
      })),
      notes,
      notesFinance,
      terms,
      bankDetails,
      reverseCharge,
      placeOfSupply: placeOfSupply || buyerStateCode || undefined,
      status,
    }),
    [
      clientId,
      buyerName,
      selectedClient,
      buyerGstin,
      sellerGstin,
      invoiceDate,
      dueDate,
      invoiceNumber,
      invoiceType,
      computedItems,
      notes,
      notesFinance,
      terms,
      bankDetails,
      reverseCharge,
      placeOfSupply,
      buyerStateCode,
    ],
  );

  const handleSubmit = useCallback(
    async (status: 'draft' | 'sent') => {
      if (!buyerName && !selectedClient) {
        toast.error('Please pick a client or enter a customer name.', {
          description: 'The invoice needs a Bill-To before saving.',
        });
        return;
      }
      if (computedItems.every((it) => it.taxableValue === 0)) {
        toast.error('Add at least one item with a non-zero amount.', {
          description: 'Line items drive the taxable value on this invoice.',
        });
        return;
      }
      try {
        await onSubmit(buildPayload(status));
      } catch (err) {
        console.error('[InvoiceBuilder] onSubmit threw:', err);
        toast.error('Unable to save this invoice right now.', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    },
    [buyerName, selectedClient, computedItems, onSubmit, buildPayload],
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  const dialogTitle = initialInvoice ? 'Edit Invoice' : 'Create New Invoice';
  const dialogSubtitle = `Total: ${formatCurrency(totals.total)} (incl. GST ${formatCurrency(gstAmount)})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          'max-w-5xl gap-0 overflow-hidden border-white/[0.08] bg-zinc-950/95 p-0 text-zinc-100 backdrop-blur-2xl',
          'sm:max-w-5xl',
        )}
      >
        {/* Header ─────────────────────────────────────────────────────────── */}
        <DialogHeader className="gap-1 border-b border-white/[0.06] bg-white/[0.02] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight text-zinc-100">
                  {dialogTitle}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-zinc-400">
                  {dialogSubtitle}
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'border-white/[0.08] bg-white/[0.03] text-zinc-300',
                )}
              >
                {interState ? (
                  <>
                    <AlertCircle className="h-3 w-3 text-amber-300" />
                    Inter-state · IGST
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    Intra-state · CGST+SGST
                  </>
                )}
              </Badge>
              {initialInvoice ? (
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-zinc-400">
                  Editing · {initialInvoice.invoiceNumber}
                </Badge>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="max-h-[calc(90vh-9rem)] overflow-y-auto px-5 py-5 sm:px-6"
        >
          <div className="space-y-5">
            {/* ── 1. Client Section ─────────────────────────────────────────── */}
            <SectionCard
              icon={<Building2 className="h-4 w-4" />}
              title="Bill To"
              description="Pick a client — buyer GSTIN & name auto-fill, and the GST type (CGST/SGST vs IGST) updates live."
              right={
                <button
                  type="button"
                  onClick={() =>
                    onCreateClient
                      ? onCreateClient()
                      : toast.info('Open the Customers module to add a new client.', {
                          description: 'New clients appear here instantly.',
                        })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-emerald-500/30 hover:text-emerald-300"
                >
                  <UserPlus className="h-3 w-3" />
                  New client
                </button>
              }
            >
              <ClientCombobox
                clients={clients}
                value={selectedClient}
                onSelect={selectClient}
                onCreateClient={onCreateClient}
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Customer name</FieldLabel>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Acme Industries Pvt. Ltd."
                    className="border-white/[0.08] bg-white/[0.03] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <FieldLabel hint="first 2 digits drive Place of Supply">Buyer GSTIN</FieldLabel>
                  <Input
                    value={buyerGstin}
                    onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                    placeholder="29ABCDE1234F1Z5"
                    maxLength={15}
                    className="border-white/[0.08] bg-white/[0.03] font-mono text-sm uppercase text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </SectionCard>

            {/* ── 2. Invoice Info ───────────────────────────────────────────── */}
            <SectionCard
              icon={<Hash className="h-4 w-4" />}
              title="Invoice Details"
              description="Number, dates, type and supply place — reverse charge if applicable."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <FieldLabel>Invoice Number</FieldLabel>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-2025-0001"
                    className="border-white/[0.08] bg-white/[0.03] font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <FieldLabel>Invoice Date</FieldLabel>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => onInvoiceDateChange(e.target.value)}
                    className="border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <FieldLabel hint="auto from terms">Due Date</FieldLabel>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {[7, 15, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDueDatePreset(d)}
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors',
                          paymentTermsDays === String(d)
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200',
                        )}
                      >
                        +{d}d
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel>Invoice Type</FieldLabel>
                  <Select value={invoiceType} onValueChange={setInvoiceType}>
                    <SelectTrigger className="h-9 w-full border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:ring-emerald-500/30">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="border-white/[0.08] bg-zinc-950/95 text-zinc-100">
                      {INVOICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="focus:bg-emerald-500/10 focus:text-emerald-200">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel hint="auto from buyer GSTIN">Place of Supply</FieldLabel>
                  <Select
                    value={placeOfSupply || '__none__'}
                    onValueChange={(v) => setPlaceOfSupply(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 w-full border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:ring-emerald-500/30">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="border-white/[0.08] bg-zinc-950/95 text-zinc-100">
                      <SelectItem value="__none__" className="focus:bg-emerald-500/10">— Auto —</SelectItem>
                      {Object.entries(STATE_CODE_TO_NAME)
                        .sort((a, b) => a[1].localeCompare(b[1]))
                        .map(([code, name]) => (
                          <SelectItem key={code} value={code} className="focus:bg-emerald-500/10 focus:text-emerald-200">
                            {name} ({code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label
                    htmlFor="reverse-charge"
                    className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-300"
                  >
                    <span className="flex items-center gap-2">
                      <Switch
                        id="reverse-charge"
                        checked={reverseCharge}
                        onCheckedChange={setReverseCharge}
                      />
                      Reverse Charge
                    </span>
                    <span className="text-[11px] font-medium tabular-nums text-zinc-500">
                      {reverseCharge ? 'Yes' : 'No'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Oracle AI hint banner */}
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div className="flex-1 text-[11px] leading-relaxed text-amber-100/90">
                  <span className="font-semibold text-amber-200">Oracle AI ·</span>{' '}
                  {interState
                    ? `Seller state (${sellerStateCode || '—'}) ≠ Buyer state (${buyerStateCode || '—'}). IGST @ the slab rate will apply on every line.`
                    : `Seller state (${sellerStateCode || '—'}) = Buyer state (${buyerStateCode || '—'}). CGST + SGST (split 50/50) will apply on every line.`}
                  {!buyerGstin ? ' Add a buyer GSTIN to enable inter-state detection.' : ''}
                </div>
              </div>
            </SectionCard>

            {/* ── 3. Smart Item Table ──────────────────────────────────────── */}
            <SectionCard
              icon={<CreditCard className="h-4 w-4" />}
              title="Line Items"
              description="Auto CGST/SGST (intra-state) or IGST (inter-state). CESS is hidden by default."
              right={
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-400">
                    <Checkbox
                      checked={showCess}
                      onCheckedChange={(v) => setShowCess(v === true)}
                      className="border-white/[0.2] data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    Show CESS
                  </label>
                  <Button
                    type="button"
                    onClick={addLineItem}
                    className="h-8 bg-emerald-500 text-white hover:bg-emerald-600"
                    size="sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                  </Button>
                </div>
              }
            >
              <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500">
                      <th className="w-10 px-2 py-2 text-left">#</th>
                      <th className="min-w-[180px] px-2 py-2 text-left">Description</th>
                      <th className="w-24 px-2 py-2 text-left">HSN/SAC</th>
                      <th className="w-20 px-2 py-2 text-right">Qty</th>
                      <th className="w-24 px-2 py-2 text-left">Unit</th>
                      <th className="w-28 px-2 py-2 text-right">Rate</th>
                      <th className="w-20 px-2 py-2 text-right">Disc%</th>
                      <th className="w-24 px-2 py-2 text-right">GST%</th>
                      {showCess ? <th className="w-20 px-2 py-2 text-right">CESS%</th> : null}
                      <th className="w-28 px-2 py-2 text-right">Taxable</th>
                      {interState ? (
                        <th className="w-28 px-2 py-2 text-right">IGST</th>
                      ) : (
                        <>
                          <th className="w-24 px-2 py-2 text-right">CGST</th>
                          <th className="w-24 px-2 py-2 text-right">SGST</th>
                        </>
                      )}
                      {showCess ? <th className="w-24 px-2 py-2 text-right">CESS</th> : null}
                      <th className="w-28 px-2 py-2 text-right">Total</th>
                      <th className="w-24 px-2 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedItems.map((it, idx) => (
                      <LineItemRow
                        key={it.key}
                        index={idx}
                        item={it}
                        interState={interState}
                        showCess={showCess}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < computedItems.length - 1}
                        onUpdate={(field, value) => updateLineItem(it.key, field, value)}
                        onRemove={() => removeLineItem(it.key)}
                        onDuplicate={() => duplicateLineItem(it.key)}
                        onMoveUp={() => moveLineItem(it.key, 'up')}
                        onMoveDown={() => moveLineItem(it.key, 'down')}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/[0.06] bg-white/[0.02] text-[11px] text-zinc-400">
                      <td colSpan={interState ? (showCess ? 10 : 9) : (showCess ? 11 : 10)} className="px-2 py-2 text-right font-medium uppercase tracking-wider">
                        Totals
                      </td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums text-zinc-200">
                        {formatCurrency(totals.subtotal)}
                      </td>
                      {interState ? (
                        <td className="px-2 py-2 text-right font-medium tabular-nums text-zinc-200">
                          {formatCurrency(totals.igst)}
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-2 text-right font-medium tabular-nums text-zinc-200">
                            {formatCurrency(totals.cgst)}
                          </td>
                          <td className="px-2 py-2 text-right font-medium tabular-nums text-zinc-200">
                            {formatCurrency(totals.sgst)}
                          </td>
                        </>
                      )}
                      {showCess ? (
                        <td className="px-2 py-2 text-right font-medium tabular-nums text-zinc-200">
                          {formatCurrency(totals.cess)}
                        </td>
                      ) : null}
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-emerald-300">
                        {formatCurrency(totals.subtotal + totals.cgst + totals.sgst + totals.igst + totals.cess)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            {/* ── 4 + 5. GST Summary + Slab Breakdown (side by side on lg) ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
              <SectionCard
                icon={<Sparkles className="h-4 w-4" />}
                title="GST Summary"
                description="Live totals — recomputed on every keystroke."
              >
                <div className="space-y-1.5">
                  <SummaryRow label="Subtotal (Taxable)" value={formatCurrency(totals.subtotal)} />
                  {interState ? (
                    <SummaryRow label="IGST" value={formatCurrency(totals.igst)} muted />
                  ) : (
                    <>
                      <SummaryRow label="CGST" value={formatCurrency(totals.cgst)} muted />
                      <SummaryRow label="SGST" value={formatCurrency(totals.sgst)} muted />
                    </>
                  )}
                  {totals.cess > 0 || showCess ? (
                    <SummaryRow label="CESS" value={formatCurrency(totals.cess)} muted />
                  ) : null}
                  <SummaryRow
                    label="Round Off"
                    value={`${totals.roundOff >= 0 ? '+' : '−'}${formatCurrency(Math.abs(totals.roundOff))}`}
                    muted
                  />
                  <div className="mt-2 flex items-baseline justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3.5 py-3">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/80">
                        Total Amount
                      </div>
                      <div className="text-[10px] text-emerald-300/60">incl. GST {formatCurrency(gstAmount)}</div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-emerald-300">
                      {formatCurrency(totals.total)}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={<Hash className="h-4 w-4" />}
                title="Slab Breakdown"
                description="Taxable value grouped by GST rate."
              >
                <SlabBreakdownBars items={computedItems} />
                <div className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
                  <div className="flex justify-between py-0.5">
                    <span>Line items</span>
                    <span className="tabular-nums text-zinc-300">{computedItems.length}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>GST type</span>
                    <span className="text-zinc-300">{interState ? 'IGST' : 'CGST + SGST'}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Seller state</span>
                    <span className="text-zinc-300">
                      {STATE_CODE_TO_NAME[sellerStateCode] ?? '—'} {sellerStateCode ? `(${sellerStateCode})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span>Buyer state</span>
                    <span className="text-zinc-300">
                      {STATE_CODE_TO_NAME[buyerStateCode] ?? '—'} {buyerStateCode ? `(${buyerStateCode})` : ''}
                    </span>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* ── 6. Notes & Terms ─────────────────────────────────────────── */}
            <SectionCard
              icon={<StickyNote className="h-4 w-4" />}
              title="Notes & Terms"
              description="Notes appear on the invoice. Finance notes stay internal. Pre-filled defaults included."
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div>
                  <FieldLabel>Notes (on invoice)</FieldLabel>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Thank-you note or special instructions visible to the buyer."
                    rows={3}
                    className="border-white/[0.08] bg-white/[0.03] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <FieldLabel hint="internal only">
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Finance Notes
                    </span>
                  </FieldLabel>
                  <Textarea
                    value={notesFinance}
                    onChange={(e) => setNotesFinance(e.target.value)}
                    placeholder="Internal team notes — never shown on the invoice."
                    rows={3}
                    className="border-white/[0.08] bg-white/[0.03] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <FieldLabel>Terms & Conditions</FieldLabel>
                  <Textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    rows={5}
                    className="border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <FieldLabel hint="auto-filled">
                    <span className="inline-flex items-center gap-1">
                      <Landmark className="h-3 w-3" /> Bank Details
                    </span>
                  </FieldLabel>
                  <Textarea
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    rows={5}
                    className="border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:border-emerald-500/40 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </SectionCard>

            {/* ── 7. Payment Section ───────────────────────────────────────── */}
            <SectionCard
              icon={<CalendarDays className="h-4 w-4" />}
              title="Payment"
              description="Payment terms drive the due date. Pick the preferred payment channel."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Payment Terms</FieldLabel>
                  <Select value={paymentTermsDays} onValueChange={onPaymentTermsChange}>
                    <SelectTrigger className="h-9 w-full border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:ring-emerald-500/30">
                      <SelectValue placeholder="Net 30" />
                    </SelectTrigger>
                    <SelectContent className="border-white/[0.08] bg-zinc-950/95 text-zinc-100">
                      {PAYMENT_TERMS_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="focus:bg-emerald-500/10 focus:text-emerald-200">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    Due date auto-set to {new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.
                  </p>
                </div>
                <div>
                  <FieldLabel>Preferred Payment Mode</FieldLabel>
                  <Select value={paymentModeHint} onValueChange={setPaymentModeHint}>
                    <SelectTrigger className="h-9 w-full border-white/[0.08] bg-white/[0.03] text-zinc-100 focus:ring-emerald-500/30">
                      <SelectValue placeholder="UPI" />
                    </SelectTrigger>
                    <SelectContent className="border-white/[0.08] bg-zinc-950/95 text-zinc-100">
                      {PAYMENT_MODES.map((m) => (
                        <SelectItem key={m} value={m} className="focus:bg-emerald-500/10 focus:text-emerald-200">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    Hint shown on the invoice. A UPI QR is generated automatically.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </motion.div>

        {/* Footer ─────────────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2 border-t border-white/[0.06] bg-white/[0.02] px-5 py-4 sm:px-6">
          <div className="mr-auto flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="hidden sm:inline">
              {computedItems.length} line item{computedItems.length === 1 ? '' : 's'} ·{' '}
              {interState ? 'IGST' : 'CGST+SGST'}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit('draft')}
            loading={saving}
            className="border-white/[0.12] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06] hover:text-zinc-100"
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit('sent')}
            loading={saving}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
          >
            Save &amp; Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-component: Summary row (used in GST summary card) ───────────────────

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
    <div className="flex items-center justify-between px-1 py-1 text-sm">
      <span className={cn('text-zinc-400', muted && 'text-zinc-500')}>{label}</span>
      <span
        className={cn(
          'tabular-nums font-medium',
          muted ? 'text-zinc-300' : 'text-zinc-100',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Sub-component: Line item row ────────────────────────────────────────────

interface LineItemRowProps {
  index: number;
  item: LineItem;
  interState: boolean;
  showCess: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: <K extends keyof LineItem>(field: K, value: LineItem[K]) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function LineItemRow({
  index,
  item,
  interState,
  showCess,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: LineItemRowProps) {
  // Enter key moves focus to the next focusable input in the row.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = (e.currentTarget as HTMLInputElement).form;
      if (!form) return;
      const focusables = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])',
        ),
      );
      const idx = focusables.indexOf(e.currentTarget as HTMLInputElement);
      const next = focusables[idx + 1];
      if (next) {
        next.focus();
        if (next instanceof HTMLInputElement) next.select?.();
      }
    }
  };

  return (
    <tr className="group border-b border-white/[0.04] text-zinc-200 transition-colors hover:bg-white/[0.02]">
      <td className="px-2 py-2 text-[11px] tabular-nums text-zinc-500">{index + 1}</td>
      <td className="px-2 py-2">
        <Input
          value={item.description}
          onChange={(e) => onUpdate('description', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Item description"
          className="h-9 border-transparent bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:bg-white/[0.04] focus:ring-emerald-500/30"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          value={item.hsnCode}
          onChange={(e) => onUpdate('hsnCode', e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="998314"
          className="h-9 border-transparent bg-transparent font-mono text-xs uppercase text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:bg-white/[0.04] focus:ring-emerald-500/30"
        />
      </td>
      <td className="px-2 py-2">
        <NumberInput
          value={item.quantity}
          onValueChange={(n) => onUpdate('quantity', n)}
          onKeyDown={handleKeyDown}
          className="h-9 border-transparent bg-transparent text-zinc-100 focus:border-emerald-500/40 focus:bg-white/[0.04]"
        />
      </td>
      <td className="px-2 py-2">
        <Select value={item.unit} onValueChange={(v) => onUpdate('unit', v)}>
          <SelectTrigger
            size="sm"
            className="h-9 w-full border-transparent bg-transparent text-zinc-100 focus:ring-emerald-500/30"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/[0.08] bg-zinc-950/95 text-zinc-100">
            {UNITS.map((u) => (
              <SelectItem key={u} value={u} className="focus:bg-emerald-500/10 focus:text-emerald-200">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-2">
        <MoneyInput
          value={item.unitPrice}
          onValueChange={(n) => onUpdate('unitPrice', n)}
          onKeyDown={handleKeyDown}
          className="h-9 border-transparent bg-transparent focus:border-emerald-500/40 focus:bg-white/[0.04]"
        />
      </td>
      <td className="px-2 py-2">
        <NumberInput
          value={item.discountPct}
          onValueChange={(n) => onUpdate('discountPct', n)}
          onKeyDown={handleKeyDown}
          className="h-9 border-transparent bg-transparent text-zinc-100 focus:border-emerald-500/40 focus:bg-white/[0.04]"
        />
      </td>
      <td className="px-2 py-2">
        <Select
          value={String(item.gstRate)}
          onValueChange={(v) => onUpdate('gstRate', Number(v))}
        >
          <SelectTrigger
            size="sm"
            className="h-9 w-full border-transparent bg-transparent text-zinc-100 focus:ring-emerald-500/30"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/[0.08] bg-zinc-950/95 text-zinc-100">
            {GST_RATES.map((r) => (
              <SelectItem key={r} value={String(r)} className="focus:bg-emerald-500/10 focus:text-emerald-200">
                {r}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      {showCess ? (
        <td className="px-2 py-2">
          <NumberInput
            value={item.cessRate}
            onValueChange={(n) => onUpdate('cessRate', n)}
            onKeyDown={handleKeyDown}
            className="h-9 border-transparent bg-transparent text-zinc-100 focus:border-emerald-500/40 focus:bg-white/[0.04]"
          />
        </td>
      ) : null}
      <td className="px-2 py-2 text-right text-xs tabular-nums text-zinc-300">
        {formatCurrency(item.taxableValue)}
      </td>
      {interState ? (
        <td className="px-2 py-2 text-right text-xs tabular-nums text-zinc-400">
          {formatCurrency(item.igst)}
        </td>
      ) : (
        <>
          <td className="px-2 py-2 text-right text-xs tabular-nums text-zinc-400">
            {formatCurrency(item.cgst)}
          </td>
          <td className="px-2 py-2 text-right text-xs tabular-nums text-zinc-400">
            {formatCurrency(item.sgst)}
          </td>
        </>
      )}
      {showCess ? (
        <td className="px-2 py-2 text-right text-xs tabular-nums text-zinc-400">
          {formatCurrency(item.cess)}
        </td>
      ) : null}
      <td className="px-2 py-2 text-right text-xs font-medium tabular-nums text-emerald-300">
        {formatCurrency(item.total)}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center justify-end gap-0.5">
          <RowIconButton
            label="Move up"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            icon={<ChevronUp className="h-3.5 w-3.5" />}
          />
          <RowIconButton
            label="Move down"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            icon={<ChevronDown className="h-3.5 w-3.5" />}
          />
          <RowIconButton
            label="Duplicate"
            onClick={onDuplicate}
            icon={<Copy className="h-3.5 w-3.5" />}
          />
          <RowIconButton
            label="Delete"
            onClick={onRemove}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            tone="danger"
          />
        </div>
      </td>
    </tr>
  );
}

function RowIconButton({
  label,
  onClick,
  icon,
  disabled = false,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors',
        'hover:bg-white/[0.06] hover:text-zinc-200',
        'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500',
        tone === 'danger' && 'hover:bg-red-500/15 hover:text-red-300',
      )}
    >
      {icon}
    </button>
  );
}

export default InvoiceBuilder;
