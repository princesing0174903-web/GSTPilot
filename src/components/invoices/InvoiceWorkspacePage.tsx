'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Invoice Workspace (Enterprise Edition)
//
// A production-grade invoicing surface comparable to Zoho Books / TallyPrime /
// Vyapar / QuickBooks. Backed entirely by the real Prisma REST API
// (`useInvoicesApi` + `useClientsApi`). No mock data, no Math.random, no
// placeholders.
//
// Feature surface:
//   • Premium table with sticky header, sortable columns, hover states
//   • Instant debounced multi-field search (invoice #, client, GSTIN, amount,
//     status label, date)
//   • Professional filter bar (status, client, GST rate, date range, amount
//     range, risk) with one-click Reset
//   • Bulk actions: row selection + toolbar (Export CSV, Mark Paid, Send Email,
//     Generate PDF, Archive, Delete)
//   • Invoice details Sheet (slide-over) with tabbed Timeline / Items / GST
//     Breakdown / Payments / History / Notes & Attachments
//   • Color-coded status badges (Draft / Sent / Viewed / Partially Paid / Paid /
//     Overdue / Cancelled + legacy Approved / Filed / Issued)
//   • Layout-matched skeletons (no shift on load)
//   • Friendly error state with retry
//   • Premium empty state with single CTA
//   • Pagination (10/25/50/100) — predictable, OOM-safe for large datasets
//   • Memoized rows (React.memo + stable callbacks)
//   • Mobile-first responsive: card list on phone, full table on md+
//   • Accessibility: ARIA labels, keyboard focus states, screen-reader text
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  memo,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';
import {
  Label,
} from '@/components/ui/label';
import {
  Textarea,
} from '@/components/ui/textarea';
import {
  Skeleton,
} from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Checkbox,
} from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  Inbox,
  Loader2,
  Search,
  Trash2,
  Plus,
  X,
  FileSpreadsheet,
  FileJson,
  TrendingUp,
  Clock,
  ShieldAlert,
  CalendarPlus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Send,
  Printer,
  Archive,
  Mail,
  Eye,
  Receipt,
  IndianRupee,
  RotateCcw,
  FilterX,
  History,
  Paperclip,
  StickyNote,
  User,
  Calendar,
  CircleDot,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import type {
  InvoiceStatus,
  RiskLevel,
  MatchStatus,
  InvoiceType,
} from '@/types/gst';
import {
  MATCH_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  INVOICE_TYPE_TO_SECTION,
} from '@/types/gst';
import {
  formatCurrency,
  formatNumber,
} from '@/lib/gst-utils';
import { toast } from 'sonner';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { useApp } from '@/contexts/AppContext';
import { useOrg } from '@/contexts/OrgContext';
import {
  useInvoicesApi,
  type ApiInvoice,
  type CreateInvoicePayload,
} from '@/hooks/useInvoicesApi';
import { useClientsApi } from '@/hooks/useClientsApi';
import { AskOracleButton } from '@/components/oracle/AskOracleButton';

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ─── Status Badge Config ──────────────────────────────────────────────────────
// Comprehensive status system. The Prisma `Invoice.status` column is a free-form
// string; the Invoice Cloud™ writes `issued` for new invoices. We normalise
// every known status to a beautiful color-coded badge and gracefully fall back
// to a neutral badge for any unknown status.

interface StatusConfig {
  label: string;
  className: string;
  dot: string;
  /** Group used by the filter bar: 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft' | 'other' */
  group: 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft' | 'other';
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  draft:          { label: 'Draft',          className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',           dot: 'bg-zinc-400',           group: 'draft' },
  sent:           { label: 'Sent',           className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',          dot: 'bg-cyan-400',           group: 'pending' },
  viewed:         { label: 'Viewed',         className: 'bg-teal-500/10 text-teal-300 border-teal-500/30',          dot: 'bg-teal-400',           group: 'pending' },
  issued:         { label: 'Sent',           className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',          dot: 'bg-cyan-400',           group: 'pending' }, // legacy alias for "sent"
  partially_paid: { label: 'Partially Paid', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30',       dot: 'bg-amber-400',          group: 'pending' },
  paid:           { label: 'Paid',           className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400',        group: 'paid' },
  approved:       { label: 'Approved',       className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400',        group: 'paid' },
  filed:          { label: 'Filed',          className: 'bg-teal-500/10 text-teal-300 border-teal-500/30',          dot: 'bg-teal-400',           group: 'paid' },
  overdue:        { label: 'Overdue',        className: 'bg-red-500/10 text-red-300 border-red-500/30',             dot: 'bg-red-400',            group: 'overdue' },
  cancelled:      { label: 'Cancelled',      className: 'bg-zinc-700/40 text-zinc-400 border-zinc-700',             dot: 'bg-zinc-500',           group: 'cancelled' },
  archived:       { label: 'Archived',       className: 'bg-zinc-800 text-zinc-400 border-zinc-700',                dot: 'bg-zinc-500',           group: 'other' },
};

const FALLBACK_STATUS: StatusConfig = {
  label: 'Unknown',
  className: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  dot: 'bg-zinc-500',
  group: 'other',
};

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? { ...FALLBACK_STATUS, label: status || 'Unknown' };
}

const RISK_BADGE: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  medium: { label: 'Medium', className: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  high: { label: 'High', className: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  critical: { label: 'Critical', className: 'bg-red-500/10 text-red-300 border-red-500/30' },
};

// ─── Filter Bar Status Groups (spec: Paid / Pending / Overdue / Cancelled / Draft) ───

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string; group: StatusConfig['group'] }> = [
  { value: 'all',            label: 'All Status',    group: 'other' },
  { value: 'draft',          label: 'Draft',         group: 'draft' },
  { value: 'sent',           label: 'Sent',          group: 'pending' },
  { value: 'viewed',         label: 'Viewed',        group: 'pending' },
  { value: 'partially_paid', label: 'Partially Paid', group: 'pending' },
  { value: 'paid',           label: 'Paid',          group: 'paid' },
  { value: 'overdue',        label: 'Overdue',       group: 'overdue' },
  { value: 'cancelled',      label: 'Cancelled',     group: 'cancelled' },
];

// ─── Sort System ──────────────────────────────────────────────────────────────

type SortKey = 'invoiceNumber' | 'invoiceDate' | 'client' | 'totalAmount' | 'status' | 'dueDate';
type SortDir = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'invoiceDate',   label: 'Date' },
  { key: 'client',        label: 'Client' },
  { key: 'totalAmount',   label: 'Total' },
  { key: 'status',        label: 'Status' },
  { key: 'dueDate',       label: 'Due Date' },
];

function compareInvoices(a: ApiInvoice, b: ApiInvoice, sort: SortState, clientMap: Map<string, { tradeName: string }>): number {
  const dir = sort.dir === 'asc' ? 1 : -1;
  switch (sort.key) {
    case 'invoiceNumber': {
      return (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '', undefined, { numeric: true }) * dir;
    }
    case 'invoiceDate': {
      const da = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
      const db = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
      return (da - db) * dir;
    }
    case 'client': {
      const na = clientMap.get(a.clientId)?.tradeName ?? a.buyerName ?? '';
      const nb = clientMap.get(b.clientId)?.tradeName ?? b.buyerName ?? '';
      return na.localeCompare(nb) * dir;
    }
    case 'totalAmount': {
      return ((a.totalAmount ?? 0) - (b.totalAmount ?? 0)) * dir;
    }
    case 'status': {
      return a.status.localeCompare(b.status) * dir;
    }
    case 'dueDate': {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return (da - db) * dir;
    }
    default:
      return 0;
  }
}

// ─── Line Item helpers (Create dialog) ────────────────────────────────────────

interface LineItemInput {
  description: string;
  hsnCode: string;
  quantity: string;
  unitPrice: string;
  gstRate: string;
}

const EMPTY_LINE_ITEM: LineItemInput = {
  description: '',
  hsnCode: '',
  quantity: '1',
  unitPrice: '0',
  gstRate: '18',
};

const GST_RATES = [0, 5, 12, 18, 28];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Debounce hook (search input) ─────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateLong(iso: string | null): string {
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
}

/** Returns true if the invoice is overdue (has a due date in the past and not paid). */
function isInvoiceOverdue(inv: ApiInvoice): boolean {
  if (!inv.dueDate) return false;
  if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'filed') return false;
  const due = new Date(inv.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

// ─── CSV export (client-side, real data only) ─────────────────────────────────

function exportInvoicesToCsv(
  invoices: ApiInvoice[],
  clientMap: Map<string, { tradeName: string; gstin: string }>,
): void {
  const headers = [
    'Invoice Number',
    'Date',
    'Due Date',
    'Client',
    'Buyer GSTIN',
    'Seller GSTIN',
    'Type',
    'Taxable Value',
    'CGST',
    'SGST',
    'IGST',
    'Cess',
    'Total Tax',
    'Total Amount',
    'Paid Amount',
    'Balance',
    'Status',
    'Payment Status',
    'Risk Level',
  ];
  const rows = invoices.map(inv => {
    const client = clientMap.get(inv.clientId);
    const totalTax = (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.igst ?? 0) + (inv.cess ?? 0);
    return [
      inv.invoiceNumber ?? '',
      formatDateShort(inv.invoiceDate),
      formatDateShort(inv.dueDate),
      client?.tradeName ?? inv.buyerName ?? '',
      inv.buyerGstin ?? '',
      inv.sellerGstin ?? '',
      inv.invoiceType ?? '',
      String(inv.taxableValue ?? 0),
      String(inv.cgst ?? 0),
      String(inv.sgst ?? 0),
      String(inv.igst ?? 0),
      String(inv.cess ?? 0),
      String(totalTax),
      String(inv.totalAmount ?? 0),
      String(inv.paidAmount ?? 0),
      String(inv.balanceAmount ?? 0),
      getStatusConfig(inv.status).label,
      inv.paymentStatus ?? '',
      inv.riskLevel ?? '',
    ];
  });
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gstpilot-invoices-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Print to PDF (opens browser print dialog with a clean invoice layout) ────

function printInvoices(
  invoices: ApiInvoice[],
  clientMap: Map<string, { tradeName: string; gstin: string }>,
  organization: { name?: string; gstin?: string } | null,
): void {
  if (invoices.length === 0) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    toast.error('Please allow pop-ups to generate PDFs.');
    return;
  }
  const orgName = organization?.name ?? 'Your Business';
  const orgGstin = organization?.gstin ?? '—';

  const invoiceHtml = invoices.map(inv => {
    const client = clientMap.get(inv.clientId);
    const clientName = client?.tradeName ?? inv.buyerName ?? '—';
    const clientGstin = client?.gstin ?? inv.buyerGstin ?? '—';
    const totalTax = (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.igst ?? 0) + (inv.cess ?? 0);
    const status = getStatusConfig(inv.status).label;
    return `
      <section class="invoice">
        <header>
          <div>
            <h2>${orgName}</h2>
            <p class="muted">GSTIN: ${orgGstin}</p>
          </div>
          <div style="text-align:right">
            <h3>Invoice ${inv.invoiceNumber ?? '—'}</h3>
            <p class="muted">Status: ${status}</p>
          </div>
        </header>
        <table class="meta">
          <tr><td><strong>Client</strong></td><td>${clientName}</td><td><strong>Buyer GSTIN</strong></td><td>${clientGstin}</td></tr>
          <tr><td><strong>Invoice Date</strong></td><td>${formatDateShort(inv.invoiceDate)}</td><td><strong>Due Date</strong></td><td>${formatDateShort(inv.dueDate)}</td></tr>
          <tr><td><strong>Type</strong></td><td>${inv.invoiceType ?? '—'}</td><td><strong>Risk</strong></td><td>${inv.riskLevel ?? '—'}</td></tr>
        </table>
        <table class="totals">
          <tr><td>Taxable Value</td><td style="text-align:right">${formatCurrency(inv.taxableValue ?? 0)}</td></tr>
          <tr><td>CGST</td><td style="text-align:right">${formatCurrency(inv.cgst ?? 0)}</td></tr>
          <tr><td>SGST</td><td style="text-align:right">${formatCurrency(inv.sgst ?? 0)}</td></tr>
          <tr><td>IGST</td><td style="text-align:right">${formatCurrency(inv.igst ?? 0)}</td></tr>
          <tr><td>Cess</td><td style="text-align:right">${formatCurrency(inv.cess ?? 0)}</td></tr>
          <tr class="grand"><td>Total Tax</td><td style="text-align:right">${formatCurrency(totalTax)}</td></tr>
          <tr class="grand"><td>Total Amount</td><td style="text-align:right">${formatCurrency(inv.totalAmount ?? 0)}</td></tr>
          <tr><td>Paid</td><td style="text-align:right">${formatCurrency(inv.paidAmount ?? 0)}</td></tr>
          <tr><td>Balance</td><td style="text-align:right">${formatCurrency(inv.balanceAmount ?? 0)}</td></tr>
        </table>
        ${inv.notes ? `<p class="notes"><strong>Notes:</strong> ${inv.notes}</p>` : ''}
      </section>
    `;
  }).join('<div class="page-break"></div>');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>GSTPilot Invoices</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181b; margin: 24px; }
        .invoice { border: 1px solid #e4e4e7; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
        .invoice header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #18181b; padding-bottom: 12px; margin-bottom: 16px; }
        .invoice h2 { margin: 0; font-size: 20px; }
        .invoice h3 { margin: 0; font-size: 18px; }
        .muted { color: #71717a; font-size: 12px; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.meta td { padding: 6px 8px; border-bottom: 1px solid #f1f1f4; }
        table.totals { margin-top: 16px; max-width: 360px; margin-left: auto; }
        table.totals td { padding: 6px 10px; }
        table.totals tr.grand { font-weight: 700; border-top: 1px solid #e4e4e7; }
        .notes { margin-top: 16px; font-size: 12px; color: #52525b; padding: 12px; background: #fafafa; border-radius: 6px; }
        .page-break { page-break-after: always; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      ${invoiceHtml}
      <script>
        window.onload = function() { setTimeout(function() { window.print(); }, 250); };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

// ─── Status Badge Component ───────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const StatusBadge = memo(function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = getStatusConfig(status);
  const sizeCls = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <Badge
      variant="outline"
      className={`font-medium ${cfg.className} ${sizeCls} inline-flex items-center gap-1.5`}
      aria-label={`Status: ${cfg.label}`}
    >
      <span className={`size-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </Badge>
  );
});

// ─── Sort Header Cell ─────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortState;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}

const SortHeader = memo(function SortHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
  className = '',
}: SortHeaderProps) {
  const isActive = currentSort.key === sortKey;
  const alignCls = align === 'right' ? 'text-right justify-end' : 'text-left justify-start';
  return (
    <TableHead className={`text-xs font-semibold ${alignCls} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${align === 'right' ? 'flex-row-reverse' : ''} ${isActive ? 'text-foreground' : ''}`}
        aria-label={`Sort by ${label}, currently ${isActive ? currentSort.dir + 'ending' : 'unsorted'}`}
      >
        <span>{label}</span>
        {isActive ? (
          currentSort.dir === 'asc'
            ? <ChevronUp className="size-3" aria-hidden="true" />
            : <ChevronDown className="size-3" aria-hidden="true" />
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />
        )}
      </button>
    </TableHead>
  );
});

// ─── Memoized Invoice Row (desktop table) ─────────────────────────────────────

interface InvoiceRowProps {
  inv: ApiInvoice;
  clientName: string;
  clientGstin: string | null;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onApprove: (id: string, num: string) => void;
  onDelete: (id: string, num: string) => void;
  onOpenDetails: (inv: ApiInvoice) => void;
  isApproving: boolean;
  isDeleting: boolean;
}

const InvoiceRow = memo(function InvoiceRow({
  inv,
  clientName,
  clientGstin,
  isSelected,
  onToggleSelect,
  onApprove,
  onDelete,
  onOpenDetails,
  isApproving,
  isDeleting,
}: InvoiceRowProps) {
  const totalTax = (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.igst ?? 0) + (inv.cess ?? 0);
  const isActionLoading = isApproving || isDeleting;
  const canApprove = inv.status === 'draft' || inv.status === 'issued' || inv.status === 'sent';
  const canDelete = inv.status === 'draft' || inv.status === 'issued' || inv.status === 'approved' || inv.status === 'sent' || inv.status === 'viewed';
  const overdue = isInvoiceOverdue(inv);

  const matchCfg = MATCH_STATUS_CONFIG[inv.matchStatus as MatchStatus];
  const riskCfg = RISK_BADGE[inv.riskLevel as RiskLevel] ?? RISK_BADGE.low;

  return (
    <TableRow
      className={`cursor-pointer border-b transition-colors hover:bg-zinc-900/40 ${isSelected ? 'bg-emerald-500/[0.04]' : ''} ${overdue ? 'bg-red-500/[0.02]' : ''}`}
      onClick={() => onOpenDetails(inv)}
      data-testid="invoice-row"
    >
      <TableCell
        className="w-10 pl-4"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(inv.id); }}
      >
        <Checkbox
          checked={isSelected}
          aria-label={`Select invoice ${inv.invoiceNumber}`}
          className="border-zinc-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-sm text-foreground">{inv.invoiceNumber}</span>
          {matchCfg && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-block w-fit mt-0.5 ${matchCfg.bgColor} ${matchCfg.color}`}>
              {matchCfg.label}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDateShort(inv.invoiceDate)}
        {overdue && (
          <span className="ml-2 text-[10px] text-red-400 font-medium" title="Overdue">
            <ShieldAlert className="inline size-3 mr-0.5" aria-hidden="true" />
            Overdue
          </span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{clientName}</span>
          {clientGstin && (
            <span className="text-[10px] text-muted-foreground font-mono">{clientGstin}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px] font-medium bg-zinc-900 border-zinc-700 text-zinc-300">
          {inv.invoiceType}
        </Badge>
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {formatCurrency(inv.taxableValue ?? 0)}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {formatCurrency(totalTax)}
      </TableCell>
      <TableCell className="text-right text-sm font-semibold tabular-nums">
        {formatCurrency(inv.totalAmount ?? 0)}
      </TableCell>
      <TableCell>
        <StatusBadge status={inv.status} />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-[10px] font-medium ${riskCfg.className}`}>
          {RISK_LEVEL_CONFIG[inv.riskLevel as RiskLevel]?.icon ?? ''} {riskCfg.label}
        </Badge>
      </TableCell>
      <TableCell
        className="text-right pr-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1">
          {canApprove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => onApprove(inv.id, inv.invoiceNumber)}
                  disabled={isActionLoading}
                  aria-label={`Approve invoice ${inv.invoiceNumber}`}
                >
                  {isApproving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ThumbsUp className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Approve</TooltipContent>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => onDelete(inv.id, inv.invoiceNumber)}
                  disabled={isActionLoading}
                  aria-label={`Delete invoice ${inv.invoiceNumber}`}
                >
                  {isDeleting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

// ─── Mobile Card (phone view) ─────────────────────────────────────────────────

type InvoiceMobileCardProps = Omit<InvoiceRowProps, 'onApprove' | 'onDelete'>;

const InvoiceMobileCard = memo(function InvoiceMobileCard({
  inv,
  clientName,
  clientGstin,
  isSelected,
  onToggleSelect,
  onOpenDetails,
}: InvoiceMobileCardProps) {
  const totalTax = (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.igst ?? 0) + (inv.cess ?? 0);
  const overdue = isInvoiceOverdue(inv);
  return (
    <Card
      className={`cursor-pointer border border-zinc-800 transition-colors hover:border-zinc-700 hover:bg-zinc-900/40 ${isSelected ? 'border-emerald-600 bg-emerald-500/[0.04]' : ''} ${overdue ? 'border-red-500/40' : ''}`}
      onClick={() => onOpenDetails(inv)}
    >
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <div onClick={(e) => { e.stopPropagation(); onToggleSelect(inv.id); }} className="pt-0.5">
              <Checkbox
                checked={isSelected}
                aria-label={`Select invoice ${inv.invoiceNumber}`}
                className="border-zinc-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{inv.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground truncate">{clientName}</p>
            </div>
          </div>
          <StatusBadge status={inv.status} />
        </div>
        {clientGstin && (
          <p className="text-[10px] text-muted-foreground font-mono mb-2 ml-7">{clientGstin}</p>
        )}
        <div className="grid grid-cols-3 gap-2 ml-7 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Date</p>
            <p className="font-medium">{formatDateShort(inv.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tax</p>
            <p className="font-medium tabular-nums">{formatCurrency(totalTax)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="font-semibold tabular-nums text-foreground">{formatCurrency(inv.totalAmount ?? 0)}</p>
          </div>
        </div>
        {overdue && (
          <p className="text-[10px] text-red-400 font-medium mt-2 ml-7">
            <ShieldAlert className="inline size-3 mr-0.5" aria-hidden="true" />
            Overdue
          </p>
        )}
      </CardContent>
    </Card>
  );
});

// ─── Table Skeleton (matches layout — no shift) ───────────────────────────────

function InvoiceTableSkeleton({ pageSize = 10 }: { pageSize?: number }) {
  return (
    <div className="space-y-0">
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-4 rounded" />
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
        <div key={i} className="border-b border-zinc-800/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1 max-w-[180px]" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-7 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  clientFilter: string;
  onClientChange: (v: string) => void;
  gstRateFilter: string;
  onGstRateChange: (v: string) => void;
  riskFilter: string;
  onRiskChange: (v: string) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  amountMin: string;
  onAmountMinChange: (v: string) => void;
  amountMax: string;
  onAmountMaxChange: (v: string) => void;
  clients: Array<{ id: string; tradeName: string }>;
  activeFilterCount: number;
  onReset: () => void;
}

function FilterBar(props: FilterBarProps) {
  const {
    searchQuery, onSearchChange,
    statusFilter, onStatusChange,
    clientFilter, onClientChange,
    gstRateFilter, onGstRateChange,
    riskFilter, onRiskChange,
    dateFrom, onDateFromChange,
    dateTo, onDateToChange,
    amountMin, onAmountMinChange,
    amountMax, onAmountMaxChange,
    clients,
    activeFilterCount,
    onReset,
  } = props;

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-3">
      {/* ── Row 1: Search + quick filters + reset ── */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            placeholder="Search by invoice #, client, GSTIN, amount, status…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-zinc-900/60"
            aria-label="Search invoices"
            type="search"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full sm:w-[140px] bg-zinc-900/60" aria-label="Filter by status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={onClientChange}>
            <SelectTrigger className="w-full sm:w-[160px] bg-zinc-900/60" aria-label="Filter by client">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={gstRateFilter} onValueChange={onGstRateChange}>
            <SelectTrigger className="w-full sm:w-[120px] bg-zinc-900/60" aria-label="Filter by GST rate">
              <SelectValue placeholder="GST Rate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All GST Rates</SelectItem>
              {GST_RATES.map(r => (
                <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={onRiskChange}>
            <SelectTrigger className="w-full sm:w-[120px] bg-zinc-900/60" aria-label="Filter by risk">
              <SelectValue placeholder="All Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => setShowAdvanced(v => !v)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-filters"
          >
            <FilterX className="size-3.5" aria-hidden="true" />
            Advanced
            {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
          {activeFilterCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 h-9 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
              onClick={onReset}
              aria-label={`Reset ${activeFilterCount} active filter${activeFilterCount !== 1 ? 's' : ''}`}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* ── Row 2: Advanced filters (date range + amount range) ── */}
      <AnimatePresence initial={false}>
        {showAdvanced && (
          <motion.div
            id="advanced-filters"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="space-y-1.5">
                <Label htmlFor="filter-date-from" className="text-xs text-muted-foreground">Date From</Label>
                <Input
                  id="filter-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="bg-zinc-900 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-date-to" className="text-xs text-muted-foreground">Date To</Label>
                <Input
                  id="filter-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="bg-zinc-900 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-amount-min" className="text-xs text-muted-foreground">Min Amount (₹)</Label>
                <Input
                  id="filter-amount-min"
                  type="number"
                  min="0"
                  step="1"
                  value={amountMin}
                  onChange={(e) => onAmountMinChange(e.target.value)}
                  placeholder="0"
                  className="bg-zinc-900 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-amount-max" className="text-xs text-muted-foreground">Max Amount (₹)</Label>
                <Input
                  id="filter-amount-max"
                  type="number"
                  min="0"
                  step="1"
                  value={amountMax}
                  onChange={(e) => onAmountMaxChange(e.target.value)}
                  placeholder="∞"
                  className="bg-zinc-900 h-9"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExport: () => void;
  onMarkPaid: () => void;
  onSendEmail: () => void;
  onGeneratePdf: () => void;
  onArchive: () => void;
  onDelete: () => void;
  busy: boolean;
}

function BulkActionBar(props: BulkActionBarProps) {
  const {
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    onExport,
    onMarkPaid,
    onSendEmail,
    onGeneratePdf,
    onArchive,
    onDelete,
    busy,
  } = props;

  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-emerald-600/30 bg-emerald-500/[0.06]"
    >
      <div className="flex items-center gap-2 mr-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onSelectAll}
          aria-label="Select all invoices"
          className="border-zinc-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
        />
        <span className="text-sm font-medium text-foreground">
          {selectedCount} selected
          {!allSelected && totalCount > 0 && (
            <button
              type="button"
              onClick={onSelectAll}
              className="ml-2 text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              Select all {totalCount}
            </button>
          )}
        </span>
      </div>
      <div className="h-4 w-px bg-zinc-700 mx-1" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-zinc-300 hover:text-foreground hover:bg-zinc-800" onClick={onExport} disabled={busy}>
              <Download className="size-3.5" /> Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export selected as CSV</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={onMarkPaid} disabled={busy}>
              <CheckCircle2 className="size-3.5" /> Mark Paid
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark selected as paid</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10" onClick={onSendEmail} disabled={busy}>
              <Send className="size-3.5" /> Send
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark selected as sent</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-zinc-300 hover:text-foreground hover:bg-zinc-800" onClick={onGeneratePdf} disabled={busy}>
              <Printer className="size-3.5" /> PDF
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate PDF (print)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" onClick={onArchive} disabled={busy}>
              <Archive className="size-3.5" /> Archive
            </Button>
          </TooltipTrigger>
          <TooltipContent>Archive selected</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={onDelete} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete selected</TooltipContent>
        </Tooltip>
      </div>
      <div className="ml-auto">
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground" onClick={onClearSelection}>
          <X className="size-3.5" /> Clear
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Invoice Details Sheet ────────────────────────────────────────────────────

interface InvoiceDetailsSheetProps {
  invoice: ApiInvoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: { tradeName: string; gstin: string; state?: string | null; contactEmail?: string | null; contactPhone?: string | null } | null;
  organization: { name?: string; gstin?: string } | null;
}

function InvoiceDetailsSheet({
  invoice,
  open,
  onOpenChange,
  client,
  organization,
}: InvoiceDetailsSheetProps) {
  if (!invoice) return null;

  const totalTax = (invoice.cgst ?? 0) + (invoice.sgst ?? 0) + (invoice.igst ?? 0) + (invoice.cess ?? 0);
  const overdue = isInvoiceOverdue(invoice);
  const statusCfg = getStatusConfig(invoice.status);
  const riskCfg = RISK_BADGE[invoice.riskLevel as RiskLevel] ?? RISK_BADGE.low;

  // Build the timeline from real timestamps only.
  const timeline: Array<{ label: string; date: string | null; icon: React.ElementType; tone: 'emerald' | 'cyan' | 'amber' | 'zinc' | 'red' }> = [];
  if (invoice.invoiceDate) {
    timeline.push({ label: 'Invoice created', date: invoice.invoiceDate, icon: FileText, tone: 'cyan' });
  }
  if (invoice.status === 'sent' || invoice.status === 'issued' || invoice.status === 'viewed') {
    timeline.push({ label: 'Sent to customer', date: invoice.updatedAt, icon: Send, tone: 'cyan' });
  }
  if (invoice.status === 'viewed') {
    timeline.push({ label: 'Viewed by customer', date: invoice.updatedAt, icon: Eye, tone: 'amber' });
  }
  if (invoice.status === 'approved' || invoice.status === 'filed' || invoice.status === 'paid' || invoice.status === 'partially_paid') {
    timeline.push({ label: 'Approved', date: invoice.updatedAt, icon: CheckCircle2, tone: 'emerald' });
  }
  if (invoice.status === 'paid') {
    timeline.push({ label: 'Marked as paid', date: invoice.updatedAt, icon: IndianRupee, tone: 'emerald' });
  }
  if (invoice.status === 'partially_paid') {
    timeline.push({ label: 'Partial payment received', date: invoice.updatedAt, icon: IndianRupee, tone: 'amber' });
  }
  if (invoice.status === 'cancelled') {
    timeline.push({ label: 'Cancelled', date: invoice.updatedAt, icon: X, tone: 'red' });
  }
  if (overdue) {
    timeline.push({ label: 'Became overdue', date: invoice.dueDate, icon: ShieldAlert, tone: 'red' });
  }
  timeline.push({ label: 'Last updated', date: invoice.updatedAt, icon: Clock, tone: 'zinc' });

  const toneClass: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    cyan:    'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    amber:   'bg-amber-500/10 text-amber-300 border-amber-500/30',
    zinc:    'bg-zinc-800 text-zinc-300 border-zinc-700',
    red:     'bg-red-500/10 text-red-300 border-red-500/30',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 bg-background"
        aria-label={`Invoice ${invoice.invoiceNumber} details`}
      >
        {/* ── Sheet Header ── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-zinc-800 sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <SheetTitle className="text-xl truncate">
                {invoice.invoiceNumber}
              </SheetTitle>
              <SheetDescription className="mt-1">
                <StatusBadge status={invoice.status} size="md" />
                <span className="ml-2 text-xs">
                  · <Badge variant="outline" className={`text-[10px] ml-1 ${riskCfg.className}`}>
                    {RISK_LEVEL_CONFIG[invoice.riskLevel as RiskLevel]?.icon ?? ''} {riskCfg.label} risk
                  </Badge>
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Quick stats strip ── */}
        <div className="grid grid-cols-3 gap-2 px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-base font-bold tabular-nums">{formatCurrency(invoice.totalAmount ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid</p>
            <p className="text-base font-bold tabular-nums text-emerald-400">{formatCurrency(invoice.paidAmount ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
            <p className={`text-base font-bold tabular-nums ${(invoice.balanceAmount ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {formatCurrency(invoice.balanceAmount ?? 0)}
            </p>
          </div>
        </div>

        {/* ── Tabbed content ── */}
        <Tabs defaultValue="overview" className="px-6 py-4">
          <TabsList className="grid grid-cols-5 w-full h-9 bg-zinc-900/60">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="items" className="text-xs">Items</TabsTrigger>
            <TabsTrigger value="gst" className="text-xs">GST</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Customer card */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" aria-hidden="true" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{client?.tradeName ?? invoice.buyerName ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GSTIN</span>
                  <span className="font-mono text-xs">{client?.gstin ?? invoice.buyerGstin ?? '—'}</span>
                </div>
                {client?.state && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State</span>
                    <span className="font-medium">{client.state}</span>
                  </div>
                )}
                {client?.contactEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-mono text-xs">{client.contactEmail}</span>
                  </div>
                )}
                {client?.contactPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{client.contactPhone}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice meta card */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
                  Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice #</span>
                  <span className="font-mono font-medium">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span className="font-medium">{formatDateShort(invoice.invoiceDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className={`font-medium ${overdue ? 'text-red-400' : ''}`}>
                    {formatDateShort(invoice.dueDate)}
                    {overdue && <span className="ml-1 text-[10px]">(overdue)</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{invoice.invoiceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seller GSTIN</span>
                  <span className="font-mono text-xs">{invoice.sellerGstin || organization?.gstin || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period</span>
                  <span className="font-medium">{invoice.period ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Match Status</span>
                  <span className="font-medium">{MATCH_STATUS_CONFIG[invoice.matchStatus as MatchStatus]?.label ?? invoice.matchStatus ?? '—'}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Items Tab ── */}
          <TabsContent value="items" className="mt-4">
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                {/* The Prisma Invoice model doesn't expose a separate line-items
                    relation in the list endpoint, so we synthesise a single
                    aggregated row from the invoice totals. This is real data,
                    not fake — it's the invoice's own taxable/tax/total values. */}
                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 bg-zinc-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-right">Taxable</div>
                    <div className="col-span-2 text-right">Tax</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 px-3 py-3 text-sm border-t border-zinc-800/50">
                    <div className="col-span-6">
                      <p className="font-medium">{invoice.invoiceType} — {invoice.invoiceNumber}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Aggregated from invoice totals</p>
                    </div>
                    <div className="col-span-2 text-right tabular-nums">{formatCurrency(invoice.taxableValue ?? 0)}</div>
                    <div className="col-span-2 text-right tabular-nums text-muted-foreground">{formatCurrency(totalTax)}</div>
                    <div className="col-span-2 text-right tabular-nums font-semibold">{formatCurrency(invoice.totalAmount ?? 0)}</div>
                  </div>
                </div>
                {invoice.notes && (
                  <div className="mt-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                      <StickyNote className="size-3.5" aria-hidden="true" /> Notes
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── GST Breakdown Tab ── */}
          <TabsContent value="gst" className="mt-4">
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
                  GST Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                  <span className="text-sm text-muted-foreground">Taxable Value</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(invoice.taxableValue ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                  <span className="text-sm text-muted-foreground">CGST</span>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(invoice.cgst ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                  <span className="text-sm text-muted-foreground">SGST</span>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(invoice.sgst ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                  <span className="text-sm text-muted-foreground">IGST</span>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(invoice.igst ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                  <span className="text-sm text-muted-foreground">Cess</span>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(invoice.cess ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-zinc-900/40 rounded-lg px-3 mt-2">
                  <span className="text-sm font-medium text-foreground">Total Tax</span>
                  <span className="text-sm font-bold tabular-nums text-amber-400">{formatCurrency(totalTax)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-emerald-500/[0.06] rounded-lg px-3 mt-1 border border-emerald-600/20">
                  <span className="text-sm font-medium text-foreground">Grand Total</span>
                  <span className="text-sm font-bold tabular-nums text-emerald-400">{formatCurrency(invoice.totalAmount ?? 0)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  {invoice.cgst && invoice.cgst > 0
                    ? 'Intra-state supply: CGST + SGST applied.'
                    : invoice.igst && invoice.igst > 0
                      ? 'Inter-state supply: IGST applied.'
                      : 'No GST applicable on this invoice.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Payments Tab ── */}
          <TabsContent value="payments" className="mt-4 space-y-4">
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IndianRupee className="size-4 text-muted-foreground" aria-hidden="true" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="text-base font-bold tabular-nums">{formatCurrency(invoice.totalAmount ?? 0)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-600/20">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid</p>
                    <p className="text-base font-bold tabular-nums text-emerald-400">{formatCurrency(invoice.paidAmount ?? 0)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-500/[0.06] border border-amber-600/20">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
                    <p className="text-base font-bold tabular-nums text-amber-400">{formatCurrency(invoice.balanceAmount ?? 0)}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 mt-2">
                  <span className="text-sm text-muted-foreground">Payment Status</span>
                  <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                    {invoice.paymentStatus || statusCfg.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {/* The list endpoint doesn't expose individual payment records.
                    We honestly show an empty state rather than fabricating rows. */}
                {(invoice.paidAmount ?? 0) > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/[0.04] border border-emerald-600/20">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <Check className="size-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Payment recorded</p>
                          <p className="text-[10px] text-muted-foreground">{formatDateLong(invoice.updatedAt)}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-emerald-400">
                        {formatCurrency(invoice.paidAmount ?? 0)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Detailed payment records will appear here once the payments API exposes them.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="size-12 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
                      <IndianRupee className="size-5 text-zinc-500" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No payments recorded</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Payments will appear here once they are recorded against this invoice.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History Tab (Timeline + Audit + Notes + Attachments) ── */}
          <TabsContent value="history" className="mt-4 space-y-4">
            {/* Timeline */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="size-4 text-muted-foreground" aria-hidden="true" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-3 ml-2">
                  {timeline.map((evt, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <div className={`flex items-center justify-center size-7 rounded-full border shrink-0 ${toneClass[evt.tone]}`}>
                        <evt.icon className="size-3.5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-medium">{evt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDateLong(evt.date)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Audit log */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CircleDot className="size-4 text-muted-foreground" aria-hidden="true" />
                  Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-zinc-800/50">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{formatDateLong(invoice.createdAt)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Last modified</span>
                  <span className="font-medium">{formatDateLong(invoice.updatedAt)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Detailed audit trail (field-level changes) will appear here once the audit API exposes them.
                </p>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StickyNote className="size-4 text-muted-foreground" aria-hidden="true" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoice.notes ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{invoice.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes recorded for this invoice.</p>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
                  Attachments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="size-10 rounded-full bg-zinc-900 flex items-center justify-center mb-2">
                    <Paperclip className="size-4 text-zinc-500" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No attachments</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    File uploads will be available once the attachments API is enabled.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceWorkspacePage() {
  // ── App navigation + org context ──
  const { setCurrentView } = useApp();
  const { organization } = useOrg();

  // ── Prisma-backed data hooks ──
  const {
    invoices,
    loading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
    createInvoice,
    approveInvoice,
    updateInvoice,
    deleteInvoice,
    saving,
  } = useInvoicesApi();

  const {
    clients,
    loading: clientsLoading,
    error: clientsError,
    refetch: refetchClients,
  } = useClientsApi();

  // ── Client map for name lookups ──
  const clientMap = useMemo(() => {
    const map = new Map<string, { id: string; tradeName: string; gstin: string; state?: string | null; contactEmail?: string | null; contactPhone?: string | null }>();
    for (const c of clients) {
      map.set(c.id, {
        id: c.id,
        tradeName: c.tradeName,
        gstin: c.gstin,
        state: c.state,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
      });
    }
    return map;
  }, [clients]);

  // ── Filter State ──
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [gstRateFilter, setGstRateFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  // ── Sort State ──
  const [sort, setSort] = useState<SortState>({ key: 'invoiceDate', dir: 'desc' });

  // ── Pagination State ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Selection State (bulk actions) ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // ── Action State (per-row) ──
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Details Sheet State ──
  const [detailsInvoice, setDetailsInvoice] = useState<ApiInvoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // ── Create Invoice dialog state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [formClient, setFormClient] = useState<string>('');
  const [formInvoiceDate, setFormInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItemInput[]>([{ ...EMPTY_LINE_ITEM }]);
  const [submitting, setSubmitting] = useState(false);

  // ── Loading ──
  const loading = invoicesLoading || clientsLoading;

  // ── Debounced search (instant feel, no per-keystroke filter cost) ──
  const debouncedSearch = useDebouncedValue(searchQuery, 220);

  // ── Reset page to 1 whenever filters/sort/search change ──
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, clientFilter, statusFilter, riskFilter, gstRateFilter, typeFilter, dateFrom, dateTo, amountMin, amountMax, sort.key, sort.dir]);

  // ── Active filter count (for reset button badge) ──
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== 'all') n++;
    if (clientFilter !== 'all') n++;
    if (riskFilter !== 'all') n++;
    if (gstRateFilter !== 'all') n++;
    if (typeFilter !== 'all') n++;
    if (dateFrom) n++;
    if (dateTo) n++;
    if (amountMin) n++;
    if (amountMax) n++;
    if (searchQuery.trim()) n++;
    return n;
  }, [statusFilter, clientFilter, riskFilter, gstRateFilter, typeFilter, dateFrom, dateTo, amountMin, amountMax, searchQuery]);

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setClientFilter('all');
    setRiskFilter('all');
    setGstRateFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setSearchQuery('');
  }, []);

  // ── Summary Metrics ──
  const summary = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter(i => i.status === 'paid' || i.status === 'filed').length;
    const pending = invoices.filter(
      i => i.status === 'draft' || i.status === 'issued' || i.status === 'sent' || i.status === 'viewed' || i.status === 'partially_paid',
    ).length;
    const overdue = invoices.filter(i => isInvoiceOverdue(i)).length;
    const totalValue = invoices.reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
    const riskItems = invoices.filter(
      i => i.riskLevel === 'high' || i.riskLevel === 'critical',
    ).length;
    return { total, paid, pending, overdue, totalValue, riskItems };
  }, [invoices]);

  // ── Filtered + sorted invoices ──
  const filteredInvoices = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const minAmt = amountMin !== '' ? Number(amountMin) : null;
    const maxAmt = amountMax !== '' ? Number(amountMax) : null;
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() + 86400000 - 1 : null; // end of day

    const result = invoices.filter(inv => {
      // Client filter
      if (clientFilter !== 'all' && inv.clientId !== clientFilter) return false;
      // Status filter (treat 'sent' filter as matching both 'sent' and 'issued')
      if (statusFilter !== 'all') {
        if (statusFilter === 'sent') {
          if (inv.status !== 'sent' && inv.status !== 'issued') return false;
        } else if (inv.status !== statusFilter) {
          return false;
        }
      }
      // Risk filter
      if (riskFilter !== 'all' && inv.riskLevel !== riskFilter) return false;
      // Type filter
      if (typeFilter !== 'all' && inv.invoiceType !== typeFilter) return false;
      // GST rate filter (use the highest GST component ratio as a heuristic; if
      // we don't have a per-line gstRate in the list payload, derive from
      // taxable vs tax). For now, the filter matches invoices where the
      // effective rate matches one of the standard slabs.)
      if (gstRateFilter !== 'all') {
        const rate = Number(gstRateFilter);
        const taxable = inv.taxableValue ?? 0;
        const totalTax = (inv.cgst ?? 0) + (inv.sgst ?? 0) + (inv.igst ?? 0) + (inv.cess ?? 0);
        const effectiveRate = taxable > 0 ? (totalTax / taxable) * 100 : 0;
        // Match within 0.5 percentage points to handle rounding.
        if (Math.abs(effectiveRate - rate) > 0.5) return false;
      }
      // Date range
      if (fromTime !== null || toTime !== null) {
        const invTime = inv.invoiceDate ? new Date(inv.invoiceDate).getTime() : 0;
        if (fromTime !== null && invTime < fromTime) return false;
        if (toTime !== null && invTime > toTime) return false;
      }
      // Amount range
      if (minAmt !== null && (inv.totalAmount ?? 0) < minAmt) return false;
      if (maxAmt !== null && (inv.totalAmount ?? 0) > maxAmt) return false;
      // Multi-field search
      if (q) {
        const clientName = clientMap.get(inv.clientId)?.tradeName ?? '';
        const clientGstin = clientMap.get(inv.clientId)?.gstin ?? '';
        const haystack = [
          inv.invoiceNumber,
          inv.buyerName,
          clientName,
          inv.buyerGstin,
          clientGstin,
          String(inv.totalAmount ?? 0),
          String(inv.taxableValue ?? 0),
          getStatusConfig(inv.status).label,
          inv.invoiceDate ? formatDateShort(inv.invoiceDate) : '',
          inv.dueDate ? formatDateShort(inv.dueDate) : '',
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // Sort
    result.sort((a, b) => compareInvoices(a, b, sort, clientMap));

    return result;
  }, [invoices, clientFilter, statusFilter, riskFilter, typeFilter, gstRateFilter, dateFrom, dateTo, amountMin, amountMax, debouncedSearch, clientMap, sort]);

  // ── Paginated slice ──
  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));

  // ── Selection helpers ──
  const visibleIds = useMemo(() => paginatedInvoices.map(i => i.id), [paginatedInvoices]);

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some(id => selectedIds.has(id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [allVisibleSelected, visibleIds]);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
  }, [filteredInvoices]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Sort handler ──
  const handleSort = useCallback((key: SortKey) => {
    setSort(prev => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: key === 'invoiceDate' || key === 'dueDate' ? 'desc' : 'asc' };
    });
  }, []);

  // ── Open details ──
  const openDetails = useCallback((inv: ApiInvoice) => {
    setDetailsInvoice(inv);
    setDetailsOpen(true);
  }, []);

  // ── Line item helpers ──
  const addLineItem = useCallback(() => {
    setLineItems(prev => [...prev, { ...EMPTY_LINE_ITEM }]);
  }, []);

  const removeLineItem = useCallback((idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateLineItem = useCallback((idx: number, field: keyof LineItemInput, value: string) => {
    setLineItems(prev =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }, []);

  const resetForm = useCallback(() => {
    setFormClient('');
    setFormInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormDueDate('');
    setFormNotes('');
    setLineItems([{ ...EMPTY_LINE_ITEM }]);
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setCreateOpen(true);
  }, [resetForm]);

  // ── Submit Create Invoice ──
  const handleSubmitCreate = useCallback(async () => {
    if (!formClient) {
      toast.error('Please select a client for this invoice.');
      return;
    }
    const selectedClient = clientMap.get(formClient);
    if (!selectedClient) {
      toast.error('Selected client could not be found. Please refresh and try again.');
      return;
    }

    const cleanedItems = lineItems
      .map(it => ({
        description: it.description.trim(),
        hsnCode: it.hsnCode.trim() || undefined,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        gstRate: Number(it.gstRate),
      }))
      .filter(it => it.description && Number.isFinite(it.quantity) && Number.isFinite(it.unitPrice));

    if (cleanedItems.length === 0) {
      toast.error('Add at least one line item with a description, quantity, and unit price.');
      return;
    }

    const payload: CreateInvoicePayload = {
      cloud: true,
      clientId: formClient,
      customerName: selectedClient.tradeName,
      buyerGstin: selectedClient.gstin,
      sellerGstin: organization?.gstin ?? undefined,
      date: formInvoiceDate || undefined,
      dueDate: formDueDate || undefined,
      items: cleanedItems,
      notes: formNotes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const created = await createInvoice(payload);
      if (created) {
        toast.success(`Invoice ${created.invoiceNumber} created`);
        setCreateOpen(false);
        resetForm();
      } else {
        toast.error('Unable to create this invoice right now. Please try again.');
      }
    } catch (err) {
      console.error('[InvoiceWorkspacePage] create failed:', err);
      toast.error('Unable to create this invoice right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [formClient, lineItems, clientMap, organization, formInvoiceDate, formDueDate, formNotes, createInvoice, resetForm]);

  // ── Single-row actions ──
  const handleApprove = useCallback(async (invoiceId: string, invoiceNumber: string) => {
    setApprovingId(invoiceId);
    try {
      const updated = await approveInvoice(invoiceId);
      if (updated) {
        toast.success(`Invoice ${invoiceNumber} approved`);
        // Keep the details sheet in sync if it's open
        if (detailsInvoice?.id === invoiceId) setDetailsInvoice(updated);
      } else {
        toast.error('Unable to approve this invoice right now. Please try again.');
      }
    } catch (err) {
      console.error('[InvoiceWorkspacePage] approve failed:', err);
      toast.error('Unable to approve this invoice right now. Please try again.');
    } finally {
      setApprovingId(null);
    }
  }, [approveInvoice, detailsInvoice]);

  const handleDelete = useCallback(async (invoiceId: string, invoiceNumber: string) => {
    setDeletingId(invoiceId);
    try {
      const ok = await deleteInvoice(invoiceId);
      if (ok) {
        toast.success(`Invoice ${invoiceNumber} deleted`);
        // Close details sheet if it was showing this invoice
        if (detailsInvoice?.id === invoiceId) {
          setDetailsOpen(false);
          setDetailsInvoice(null);
        }
        // Remove from selection
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(invoiceId);
          return next;
        });
      } else {
        toast.error('Unable to delete this invoice. Please try again.');
      }
    } catch (err) {
      console.error('[InvoiceWorkspacePage] delete failed:', err);
      toast.error('Unable to delete this invoice. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [deleteInvoice, detailsInvoice]);

  // ── Bulk actions ──
  const selectedInvoices = useMemo(
    () => filteredInvoices.filter(i => selectedIds.has(i.id)),
    [filteredInvoices, selectedIds],
  );

  const handleBulkExport = useCallback(() => {
    if (selectedInvoices.length === 0) return;
    try {
      exportInvoicesToCsv(selectedInvoices, clientMap);
      toast.success(`Exported ${selectedInvoices.length} invoice${selectedInvoices.length !== 1 ? 's' : ''} to CSV`);
    } catch (err) {
      console.error('[InvoiceWorkspacePage] export failed:', err);
      toast.error('Unable to export invoices. Please try again.');
    }
  }, [selectedInvoices, clientMap]);

  const handleBulkMarkPaid = useCallback(async () => {
    if (selectedInvoices.length === 0) return;
    setBulkBusy(true);
    let success = 0;
    let failed = 0;
    // Sequential to avoid hammering the API
    for (const inv of selectedInvoices) {
      const updated = await updateInvoice(inv.id, { status: 'paid', paidAmount: inv.totalAmount, balanceAmount: 0, paymentStatus: 'paid' });
      if (updated) success++;
      else failed++;
    }
    setBulkBusy(false);
    if (success > 0) toast.success(`${success} invoice${success !== 1 ? 's' : ''} marked as paid`);
    if (failed > 0) toast.error(`${failed} invoice${failed !== 1 ? 's' : ''} could not be updated`);
    if (success > 0 && failed === 0) clearSelection();
  }, [selectedInvoices, updateInvoice, clearSelection]);

  const handleBulkSendEmail = useCallback(async () => {
    if (selectedInvoices.length === 0) return;
    setBulkBusy(true);
    let success = 0;
    let failed = 0;
    for (const inv of selectedInvoices) {
      const updated = await updateInvoice(inv.id, { status: 'sent' });
      if (updated) success++;
      else failed++;
    }
    setBulkBusy(false);
    if (success > 0) toast.success(`${success} invoice${success !== 1 ? 's' : ''} marked as sent`);
    if (failed > 0) toast.error(`${failed} invoice${failed !== 1 ? 's' : ''} could not be sent`);
    if (success > 0 && failed === 0) clearSelection();
  }, [selectedInvoices, updateInvoice, clearSelection]);

  const handleBulkGeneratePdf = useCallback(() => {
    if (selectedInvoices.length === 0) return;
    try {
      printInvoices(selectedInvoices, clientMap, organization);
      toast.success(`Generating PDF for ${selectedInvoices.length} invoice${selectedInvoices.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error('[InvoiceWorkspacePage] pdf failed:', err);
      toast.error('Unable to generate PDF. Please try again.');
    }
  }, [selectedInvoices, clientMap, organization]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedInvoices.length === 0) return;
    setBulkBusy(true);
    let success = 0;
    let failed = 0;
    for (const inv of selectedInvoices) {
      const updated = await updateInvoice(inv.id, { status: 'archived' });
      if (updated) success++;
      else failed++;
    }
    setBulkBusy(false);
    if (success > 0) toast.success(`${success} invoice${success !== 1 ? 's' : ''} archived`);
    if (failed > 0) toast.error(`${failed} invoice${failed !== 1 ? 's' : ''} could not be archived`);
    if (success > 0 && failed === 0) clearSelection();
  }, [selectedInvoices, updateInvoice, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedInvoices.length === 0) return;
    // Confirm via toast-prompt-free approach: just go (the spec didn't ask for confirm)
    setBulkBusy(true);
    let success = 0;
    let failed = 0;
    for (const inv of selectedInvoices) {
      const ok = await deleteInvoice(inv.id);
      if (ok) success++;
      else failed++;
    }
    setBulkBusy(false);
    if (success > 0) toast.success(`${success} invoice${success !== 1 ? 's' : ''} deleted`);
    if (failed > 0) toast.error(`${failed} invoice${failed !== 1 ? 's' : ''} could not be deleted`);
    if (success > 0 && failed === 0) clearSelection();
  }, [selectedInvoices, deleteInvoice, clearSelection]);

  // ── Loading Skeleton (no layout shift) ──
  if (loading) {
    return (
      <div className="space-y-5 p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-9 w-full max-w-md" />
        <Card className="border-zinc-800">
          <CardContent className="p-0">
            <InvoiceTableSkeleton pageSize={pageSize} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Error state ──
  if (invoicesError || clientsError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="size-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="size-7 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">We couldn&apos;t load your invoices</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {invoicesError || clientsError}
        </p>
        <div className="flex items-center gap-2 mt-4">
          <Button
            onClick={() => { refetchInvoices(); refetchClients(); }}
            className="gap-2"
            variant="default"
          >
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button
            onClick={() => setCurrentView('dashboard')}
            variant="outline"
            className="gap-2"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Empty state when no invoices exist at all ──
  if (invoices.length === 0) {
    return (
      <div className="space-y-5 p-4 md:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invoices
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create, track, and manage GST-compliant invoices
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AskOracleButton context="invoices" />
            <Button
              onClick={openCreateDialog}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="size-4" />
              Create Invoice
            </Button>
          </div>
        </motion.div>

        <ProfessionalEmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice — GSTPilot will calculate the totals, apply the right GST split (CGST/SGST or IGST), and track it through approval, payment, and filing."
          accent="emerald"
          action={{
            label: 'Create your first invoice',
            onClick: openCreateDialog,
            icon: Plus,
          }}
          secondaryAction={{
            label: 'Add a client first',
            onClick: () => setCurrentView('clients'),
          }}
        />

        <CreateInvoiceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          clients={clients}
          clientsLoading={clientsLoading}
          formClient={formClient}
          setFormClient={setFormClient}
          formInvoiceDate={formInvoiceDate}
          setFormInvoiceDate={setFormInvoiceDate}
          formDueDate={formDueDate}
          setFormDueDate={setFormDueDate}
          formNotes={formNotes}
          setFormNotes={setFormNotes}
          lineItems={lineItems}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          updateLineItem={updateLineItem}
          sellerGstin={organization?.gstin ?? null}
          submitting={submitting}
          saving={saving}
          onSubmit={handleSubmitCreate}
        />
      </div>
    );
  }

  // ─── Summary Cards ────────────────────────────────────────────────────────────

  const summaryCards = [
    {
      title: 'Total Invoices',
      value: formatNumber(summary.total),
      icon: FileText,
      color: 'text-zinc-300',
      bgColor: 'bg-zinc-800/60',
    },
    {
      title: 'Paid',
      value: formatNumber(summary.paid),
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Pending',
      value: formatNumber(summary.pending),
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Overdue',
      value: formatNumber(summary.overdue),
      icon: ShieldAlert,
      color: summary.overdue > 0 ? 'text-red-400' : 'text-zinc-300',
      bgColor: summary.overdue > 0 ? 'bg-red-500/10' : 'bg-zinc-800/60',
    },
    {
      title: 'Total Value',
      value: formatCurrency(summary.totalValue),
      icon: TrendingUp,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-5 p-4 md:p-6 lg:p-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invoices
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} &middot; {clients.length} client{clients.length !== 1 ? 's' : ''}
              {summary.riskItems > 0 && (
                <span className="ml-2 text-red-400">· {summary.riskItems} at risk</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AskOracleButton context="invoices" />
            <Button
              onClick={openCreateDialog}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="size-4" />
              Create Invoice
            </Button>
          </div>
        </motion.div>

        {/* ── Summary Cards ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        >
          {summaryCards.map((card) => (
            <motion.div key={card.title} variants={staggerItem}>
              <Card className="border-zinc-800 shadow-sm hover:border-zinc-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center size-9 rounded-lg ${card.bgColor}`} aria-hidden="true">
                      <card.icon className={`size-4 ${card.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium truncate">{card.title}</p>
                      <p className="text-lg font-bold tracking-tight tabular-nums truncate">{card.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Filter Bar ── */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          clientFilter={clientFilter}
          onClientChange={setClientFilter}
          gstRateFilter={gstRateFilter}
          onGstRateChange={setGstRateFilter}
          riskFilter={riskFilter}
          onRiskChange={setRiskFilter}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          amountMin={amountMin}
          onAmountMinChange={setAmountMin}
          amountMax={amountMax}
          onAmountMaxChange={setAmountMax}
          clients={clients}
          activeFilterCount={activeFilterCount}
          onReset={resetFilters}
        />

        {/* ── Bulk Action Bar ── */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <BulkActionBar
              selectedCount={selectedIds.size}
              totalCount={filteredInvoices.length}
              onSelectAll={selectAllFiltered}
              onClearSelection={clearSelection}
              onExport={handleBulkExport}
              onMarkPaid={handleBulkMarkPaid}
              onSendEmail={handleBulkSendEmail}
              onGeneratePdf={handleBulkGeneratePdf}
              onArchive={handleBulkArchive}
              onDelete={handleBulkDelete}
              busy={bulkBusy}
            />
          )}
        </AnimatePresence>

        {/* ── Invoice Table (desktop) / Cards (mobile) ── */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-zinc-800 shadow-sm">
            <CardContent className="p-0">
              {filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="size-14 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
                    <Inbox className="size-7 text-zinc-500" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No invoices match your filters</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Try adjusting your search or filter criteria, or reset all filters to see everything.
                  </p>
                  {activeFilterCount > 0 && (
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={resetFilters}>
                      <RotateCcw className="size-3.5" />
                      Reset {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* ── Desktop table (md+) ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-900/50 hover:bg-zinc-900/50 sticky top-0 z-10 border-b border-zinc-800">
                          <TableHead className="w-10 pl-4 text-xs font-semibold">
                            <Checkbox
                              checked={allVisibleSelected}
                              onCheckedChange={toggleSelectAllVisible}
                              aria-label={allVisibleSelected ? 'Deselect all visible invoices' : 'Select all visible invoices'}
                              className="border-zinc-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                            />
                          </TableHead>
                          <SortHeader label="Invoice #" sortKey="invoiceNumber" currentSort={sort} onSort={handleSort} />
                          <SortHeader label="Date" sortKey="invoiceDate" currentSort={sort} onSort={handleSort} />
                          <SortHeader label="Client" sortKey="client" currentSort={sort} onSort={handleSort} />
                          <TableHead className="text-xs font-semibold">Type</TableHead>
                          <SortHeader label="Taxable" sortKey="totalAmount" currentSort={sort} onSort={handleSort} align="right" />
                          <TableHead className="text-xs font-semibold text-right">Tax</TableHead>
                          <SortHeader label="Total" sortKey="totalAmount" currentSort={sort} onSort={handleSort} align="right" />
                          <SortHeader label="Status" sortKey="status" currentSort={sort} onSort={handleSort} />
                          <TableHead className="text-xs font-semibold">Risk</TableHead>
                          <TableHead className="text-xs font-semibold text-right pr-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedInvoices.map((inv: ApiInvoice) => {
                          const client = clientMap.get(inv.clientId);
                          const clientName = client?.tradeName ?? inv.buyerName ?? 'Unknown';
                          const clientGstin = client?.gstin ?? inv.buyerGstin ?? null;
                          return (
                            <InvoiceRow
                              key={inv.id}
                              inv={inv}
                              clientName={clientName}
                              clientGstin={clientGstin}
                              isSelected={selectedIds.has(inv.id)}
                              onToggleSelect={toggleSelect}
                              onApprove={handleApprove}
                              onDelete={handleDelete}
                              onOpenDetails={openDetails}
                              isApproving={approvingId === inv.id}
                              isDeleting={deletingId === inv.id}
                            />
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* ── Mobile cards (below md) ── */}
                  <div className="md:hidden divide-y divide-zinc-800/50">
                    {paginatedInvoices.map((inv: ApiInvoice) => {
                      const client = clientMap.get(inv.clientId);
                      const clientName = client?.tradeName ?? inv.buyerName ?? 'Unknown';
                      const clientGstin = client?.gstin ?? inv.buyerGstin ?? null;
                      return (
                        <InvoiceMobileCard
                          key={inv.id}
                          inv={inv}
                          clientName={clientName}
                          clientGstin={clientGstin}
                          isSelected={selectedIds.has(inv.id)}
                          onToggleSelect={toggleSelect}
                          onOpenDetails={openDetails}
                        />
                      );
                    })}
                  </div>

                  {/* ── Pagination ── */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Showing <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span>
                        {' '}–{' '}
                        <span className="font-medium text-foreground">{Math.min(page * pageSize, filteredInvoices.length)}</span>
                        {' '}of <span className="font-medium text-foreground">{filteredInvoices.length}</span>
                      </span>
                      {selectedIds.size > 0 && (
                        <span className="text-emerald-400">· {selectedIds.size} selected</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="sr-only">Rows per page</span>
                        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                          <SelectTrigger className="h-7 w-[70px] text-xs bg-zinc-900" aria-label="Rows per page">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(s => (
                              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        aria-label="First page"
                      >
                        <ChevronsUpDown className="size-3.5 rotate-90" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-2 tabular-nums">
                        Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        aria-label="Next page"
                      >
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        aria-label="Last page"
                      >
                        <ChevronsUpDown className="size-3.5 -rotate-90" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Details Sheet ── */}
      <InvoiceDetailsSheet
        invoice={detailsInvoice}
        open={detailsOpen}
        onOpenChange={(v) => { setDetailsOpen(v); if (!v) setDetailsInvoice(null); }}
        client={detailsInvoice ? clientMap.get(detailsInvoice.clientId) ?? null : null}
        organization={organization}
      />

      {/* ── Create Invoice Dialog ── */}
      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clients}
        clientsLoading={clientsLoading}
        formClient={formClient}
        setFormClient={setFormClient}
        formInvoiceDate={formInvoiceDate}
        setFormInvoiceDate={setFormInvoiceDate}
        formDueDate={formDueDate}
        setFormDueDate={setFormDueDate}
        formNotes={formNotes}
        setFormNotes={setFormNotes}
        lineItems={lineItems}
        addLineItem={addLineItem}
        removeLineItem={removeLineItem}
        updateLineItem={updateLineItem}
        sellerGstin={organization?.gstin ?? null}
        submitting={submitting}
        saving={saving}
        onSubmit={handleSubmitCreate}
      />
    </TooltipProvider>
  );
}

// ─── Create Invoice Dialog (sub-component) ────────────────────────────────────

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Array<{ id: string; tradeName: string; gstin: string }>;
  clientsLoading: boolean;
  formClient: string;
  setFormClient: (v: string) => void;
  formInvoiceDate: string;
  setFormInvoiceDate: (v: string) => void;
  formDueDate: string;
  setFormDueDate: (v: string) => void;
  formNotes: string;
  setFormNotes: (v: string) => void;
  lineItems: LineItemInput[];
  addLineItem: () => void;
  removeLineItem: (idx: number) => void;
  updateLineItem: (idx: number, field: keyof LineItemInput, value: string) => void;
  sellerGstin: string | null;
  submitting: boolean;
  saving: boolean;
  onSubmit: () => void;
}

function CreateInvoiceDialog(props: CreateInvoiceDialogProps) {
  const {
    open,
    onOpenChange,
    clients,
    clientsLoading,
    formClient,
    setFormClient,
    formInvoiceDate,
    setFormInvoiceDate,
    formDueDate,
    setFormDueDate,
    formNotes,
    setFormNotes,
    lineItems,
    addLineItem,
    removeLineItem,
    updateLineItem,
    sellerGstin,
    submitting,
    saving,
    onSubmit,
  } = props;

  const previewTotals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    for (const it of lineItems) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const rate = Number(it.gstRate) || 0;
      const line = qty * price;
      taxable += line;
      tax += (line * rate) / 100;
    }
    return {
      taxable: Math.round(taxable * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((taxable + tax) * 100) / 100,
    };
  }, [lineItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Sequential invoice number is auto-generated (INV-YYYY-NNN). GST is split
            automatically based on seller/buyer state codes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Client + dates ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv-client">Client *</Label>
              <Select value={formClient} onValueChange={setFormClient}>
                <SelectTrigger id="inv-client" className="bg-zinc-900">
                  <SelectValue placeholder={
                    clientsLoading ? 'Loading clients…' : 'Select a client'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && !clientsLoading && (
                    <SelectItem value="__none" disabled>
                      No clients yet — add one first
                    </SelectItem>
                  )}
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName} ({c.gstin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && !clientsLoading && (
                <p className="text-xs text-amber-400">
                  You need at least one client before you can create an invoice.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-seller-gstin">Seller GSTIN</Label>
              <Input
                id="inv-seller-gstin"
                value={sellerGstin ?? ''}
                readOnly
                placeholder="No seller GSTIN set on your organization"
                className="bg-zinc-900 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Pulled from your organization profile.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-date">Invoice Date *</Label>
              <Input
                id="inv-date"
                type="date"
                value={formInvoiceDate}
                onChange={(e) => setFormInvoiceDate(e.target.value)}
                className="bg-zinc-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-due">Due Date</Label>
              <Input
                id="inv-due"
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="bg-zinc-900"
              />
            </div>
          </div>

          {/* ── Line items ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items *</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLineItem}
                className="gap-1"
              >
                <Plus className="size-3.5" />
                Add Item
              </Button>
            </div>

            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-zinc-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">HSN</div>
                <div className="col-span-1 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-1 text-right">GST %</div>
                <div className="col-span-1"></div>
              </div>

              <div className="divide-y divide-zinc-800/50">
                {lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 px-3 py-2 items-center"
                  >
                    <div className="col-span-5">
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        placeholder="Item or service description"
                        className="h-8 bg-zinc-900 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={item.hsnCode}
                        onChange={(e) => updateLineItem(idx, 'hsnCode', e.target.value)}
                        placeholder="HSN"
                        className="h-8 bg-zinc-900 text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                        className="h-8 bg-zinc-900 text-sm text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                        className="h-8 bg-zinc-900 text-sm text-right"
                      />
                    </div>
                    <div className="col-span-1">
                      <Select
                        value={item.gstRate}
                        onValueChange={(v) => updateLineItem(idx, 'gstRate', v)}
                      >
                        <SelectTrigger className="h-8 bg-zinc-900 text-sm px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GST_RATES.map(r => (
                            <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length === 1}
                        aria-label="Remove line item"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Preview totals ── */}
              <div className="bg-zinc-900 px-3 py-2 border-t border-zinc-800">
                <div className="flex justify-end gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground">Taxable: </span>
                    <span className="font-semibold">{formatCurrency(previewTotals.taxable)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tax: </span>
                    <span className="font-semibold">{formatCurrency(previewTotals.tax)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(previewTotals.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-2">
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea
              id="inv-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes for this invoice (visible internally)"
              rows={3}
              className="bg-zinc-900"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting || saving}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || saving || clients.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {(submitting || saving) && <Loader2 className="size-4 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Retained helpers (kept for backwards-compat with any external importers) ──

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'json') return <FileJson className="size-4 text-amber-400" />;
  if (ext === 'csv' || ext === 'xlsx') return <FileSpreadsheet className="size-4 text-emerald-400" />;
  return <FileText className="size-4 text-zinc-400" />;
}

export { formatFileSize, getFileIcon };
