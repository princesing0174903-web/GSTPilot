'use client';

import React, { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  Eye,
  Send,
  CheckCircle2,
  Copy,
  Printer,
  Download,
  Archive,
  Trash2,
  Pencil,
  FileText,
  IndianRupee,
  Smartphone,
} from 'lucide-react';
import type { ApiInvoice } from '@/hooks/useInvoicesApi';
import type { ApiClient } from '@/hooks/useClientsApi';
import { formatCurrency, formatDate } from '@/lib/gst-utils';
import { StatusPill, PaymentPill, RiskBadge } from './InvoiceStatusPills';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Invoice Table (Premium Enterprise Edition)
//
// Professional data table with:
//   • Sticky header with sortable columns (Invoice #, Client, GSTIN, Date,
//     Due Date, Subtotal, GST, Total, Status, Payment, Risk, Actions)
//   • Bulk selection with select-all + count badge
//   • Per-row dropdown: View, Edit, Send, Mark Paid, Duplicate, PDF, Print, Archive, Delete
//   • Search highlight (matches wrapped in <mark>)
//   • Memoized rows (React.memo) for performance
//   • Hover row highlight, click opens details
//   • Mobile responsive: card list below md, full table md+
//   • Pagination at bottom
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Sort System ──────────────────────────────────────────────────────────────

export type SortKey =
  | 'invoiceNumber'
  | 'client'
  | 'buyerGstin'
  | 'invoiceDate'
  | 'dueDate'
  | 'taxableValue'
  | 'gstAmount'
  | 'totalAmount'
  | 'status'
  | 'paymentStatus'
  | 'riskLevel';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  current: SortState;
  onChange: (key: SortKey) => void;
  className?: string;
  align?: 'left' | 'right';
}

function SortHeader({ label, sortKey, current, onChange, className = '', align = 'left' }: SortHeaderProps) {
  const isActive = current.key === sortKey;
  const isAsc = isActive && current.dir === 'asc';
  const isDesc = isActive && current.dir === 'desc';

  return (
    <button
      type="button"
      onClick={() => onChange(sortKey)}
      className={`group inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ${
        align === 'right' ? 'justify-end' : ''
      } ${isActive ? 'text-foreground' : ''} ${className}`}
    >
      {label}
      <span className="opacity-0 group-hover:opacity-50 transition-opacity">
        {!isActive && <ChevronsUpDown className="h-3 w-3" />}
      </span>
      {isAsc && <ChevronUp className="h-3 w-3 text-blue-400 opacity-100" />}
      {isDesc && <ChevronDown className="h-3 w-3 text-blue-400 opacity-100" />}
    </button>
  );
}

// ─── Search Highlight Helper ──────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-500/30 text-blue-100 rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── Memoized Row ─────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  invoice: ApiInvoice;
  client?: ApiClient | null;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onClick: () => void;
  searchQuery: string;
  onAction: (action: string, invoice: ApiInvoice) => void;
}

const InvoiceRow = memo(function InvoiceRow({
  invoice,
  client,
  isSelected,
  onSelectChange,
  onClick,
  searchQuery,
  onAction,
}: InvoiceRowProps) {
  // Prefer the invoice's buyerName (what the user typed for THIS invoice) over
  // the client record's tradeName (the master name). The buyerName on the
  // invoice is what appears on the PDF and is what the user intended to show.
  const clientName = invoice.buyerName || client?.tradeName || 'Unknown Client';
  const gstin = invoice.buyerGstin ?? client?.gstin ?? '—';
  // FIX (B11): overdue is derived from paymentStatus + due date, not just
  // status. An invoice with status='sent' but paymentStatus='overdue' (due
  // date passed, unpaid) must show the red overdue indicator.
  const isOverdue =
    invoice.status === 'overdue' ||
    invoice.paymentStatus === 'overdue' ||
    (!!invoice.dueDate &&
      new Date(invoice.dueDate).getTime() < Date.now() &&
      (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial') &&
      invoice.status !== 'cancelled');

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    onAction(action, invoice);
  };

  return (
    <TableRow
      data-invoice-id={invoice.id}
      onClick={onClick}
      className={`gst-table-row cursor-pointer transition-colors group ${
        isSelected ? 'gst-table-row-selected' : ''
      } ${isOverdue ? 'border-l-2 border-l-red-500/50' : ''}`}
    >
      <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(v) => onSelectChange(Boolean(v))}
          aria-label={`Select invoice ${invoice.invoiceNumber}`}
        />
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-white/[0.04] group-hover:bg-blue-500/10 transition-colors">
            <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              {highlightMatch(invoice.invoiceNumber ?? '—', searchQuery)}
            </div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {invoice.invoiceType ?? 'B2B'}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <div className="text-sm font-medium text-foreground truncate max-w-[180px]">
          {highlightMatch(clientName, searchQuery)}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {highlightMatch(gstin, searchQuery)}
        </div>
      </TableCell>
      <TableCell className="py-3 hidden lg:table-cell text-sm text-muted-foreground">
        {invoice.invoiceDate ? formatDate(invoice.invoiceDate) : '—'}
      </TableCell>
      <TableCell className="py-3 hidden lg:table-cell text-sm">
        {invoice.dueDate ? (
          <span className={isOverdue ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
            {formatDate(invoice.dueDate)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-3 hidden xl:table-cell text-right text-sm text-muted-foreground gst-text-tabular">
        {formatCurrency(invoice.taxableValue ?? 0)}
      </TableCell>
      <TableCell className="py-3 hidden xl:table-cell text-right text-sm text-muted-foreground gst-text-tabular">
        {formatCurrency(invoice.gstAmount ?? 0)}
      </TableCell>
      <TableCell className="py-3 text-right">
        <div className="text-sm font-semibold text-foreground gst-text-tabular">
          {formatCurrency(invoice.totalAmount ?? 0)}
        </div>
        {invoice.balanceAmount > 0 && (
          <div className="text-[11px] text-amber-400 gst-text-tabular">
            Bal: {formatCurrency(invoice.balanceAmount)}
          </div>
        )}
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <StatusPill status={invoice.status} />
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <PaymentPill status={invoice.paymentStatus} />
      </TableCell>
      <TableCell className="py-3 hidden lg:table-cell">
        <RiskBadge level={invoice.riskLevel} />
      </TableCell>
      <TableCell className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {/* Quick actions */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => handleAction(e, 'view')}
                  className="h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground flex items-center justify-center transition-colors"
                  aria-label="View invoice"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-zinc-950 border-white/10"
            >
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Invoice Actions
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onAction('view', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('edit', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => onAction('send', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
                disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
              >
                <Send className="h-3.5 w-3.5 mr-2" />
                Send Email
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('send-whatsapp', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
                disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
              >
                <Smartphone className="h-3.5 w-3.5 mr-2" />
                Send WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('mark-paid', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
                disabled={invoice.status === 'paid'}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                Mark Paid
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => onAction('duplicate', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('pdf', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 mr-2" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('print', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 mr-2" />
                Print
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => onAction('cancel', invoice)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Archive className="h-3.5 w-3.5 mr-2" />
                Cancel Invoice
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('delete', invoice)}
                className="text-xs text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
});

// ─── Mobile Card Row ──────────────────────────────────────────────────────────

interface MobileInvoiceCardProps {
  invoice: ApiInvoice;
  client?: ApiClient | null;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onClick: () => void;
  onAction: (action: string, invoice: ApiInvoice) => void;
}

const MobileInvoiceCard = memo(function MobileInvoiceCard({
  invoice,
  client,
  isSelected,
  onSelectChange,
  onClick,
  onAction,
}: MobileInvoiceCardProps) {
  const clientName = invoice.buyerName || client?.tradeName || 'Unknown';
  // FIX (B11): same overdue derivation as the desktop row.
  const isOverdue =
    invoice.status === 'overdue' ||
    invoice.paymentStatus === 'overdue' ||
    (!!invoice.dueDate &&
      new Date(invoice.dueDate).getTime() < Date.now() &&
      (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial') &&
      invoice.status !== 'cancelled');

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`glass-surface rounded-xl border p-3 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500/40 bg-blue-500/[0.04]'
          : 'border-white/[0.06] hover:border-white/[0.12]'
      } ${isOverdue ? 'border-l-2 border-l-red-500/60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(v) => onSelectChange(Boolean(v))}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${invoice.invoiceNumber}`}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {invoice.invoiceNumber}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {clientName}
            </div>
          </div>
        </div>
        <StatusPill status={invoice.status} />
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          <div className="text-base font-bold text-foreground gst-text-tabular">
            {formatCurrency(invoice.totalAmount ?? 0)}
          </div>
          {invoice.balanceAmount > 0 && (
            <div className="text-[11px] text-amber-400">
              Bal: {formatCurrency(invoice.balanceAmount)}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Due
          </div>
          <div className="text-xs text-muted-foreground">
            {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.06] flex items-center justify-center"
              aria-label="Actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-zinc-950 border-white/10">
            <DropdownMenuItem onClick={() => onAction('view', invoice)} className="text-xs cursor-pointer">
              <Eye className="h-3.5 w-3.5 mr-2" /> View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('send', invoice)} className="text-xs cursor-pointer">
              <Send className="h-3.5 w-3.5 mr-2" /> Send
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('mark-paid', invoice)} className="text-xs cursor-pointer">
              <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark Paid
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('duplicate', invoice)} className="text-xs cursor-pointer">
              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('pdf', invoice)} className="text-xs cursor-pointer">
              <Download className="h-3.5 w-3.5 mr-2" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('delete', invoice)} className="text-xs text-red-400 focus:bg-red-500/10 cursor-pointer">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
});

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkAction: (action: string) => void;
  saving?: boolean;
}

function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkAction,
  saving = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass-surface rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-3 flex flex-wrap items-center gap-2 mb-3"
    >
      <div className="flex items-center gap-2 mr-2">
        <Checkbox
          checked={selectedCount === totalCount}
          onCheckedChange={() => (selectedCount === totalCount ? onClearSelection() : onSelectAll())}
          aria-label="Select all"
        />
        <span className="text-sm font-medium text-foreground">
          {selectedCount} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>

      <div className="h-5 w-px bg-white/[0.08]" />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
          onClick={() => onBulkAction('send')}
          disabled={saving}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Send
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
          onClick={() => onBulkAction('mark-paid')}
          disabled={saving}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Mark Paid
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
          onClick={() => onBulkAction('export-csv')}
          disabled={saving}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
          onClick={() => onBulkAction('pdf')}
          disabled={saving}
        >
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Print
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
          onClick={() => onBulkAction('cancel')}
          disabled={saving}
        >
          <Archive className="h-3.5 w-3.5 mr-1.5" />
          Cancel
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-300 text-xs"
          onClick={() => onBulkAction('delete')}
          disabled={saving}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Main Table Component ─────────────────────────────────────────────────────

export interface InvoiceTableProps {
  invoices: ApiInvoice[];
  clients: ApiClient[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick: (invoice: ApiInvoice) => void;
  onAction: (action: string, invoice: ApiInvoice) => void;
  onBulkAction: (action: string) => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  searchQuery: string;
  saving?: boolean;
}

export function InvoiceTable({
  invoices,
  clients,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onAction,
  onBulkAction,
  sort,
  onSortChange,
  searchQuery,
  saving = false,
}: InvoiceTableProps) {
  const clientMap = useMemo(() => {
    const m = new Map<string, ApiClient>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const handleSort = (key: SortKey) => {
    if (sort.key === key) {
      onSortChange({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key, dir: 'asc' });
    }
  };

  const allSelected = invoices.length > 0 && invoices.every((inv) => selectedIds.has(inv.id));
  const someSelected = invoices.some((inv) => selectedIds.has(inv.id));

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(invoices.map((i) => i.id)));
    }
  };

  const handleRowSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={invoices.length}
            onSelectAll={handleSelectAll}
            onClearSelection={() => onSelectionChange(new Set())}
            onBulkAction={onBulkAction}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Desktop table */}
      <div className="hidden md:block glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02]">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="py-3">
                  <SortHeader
                    label="Invoice #"
                    sortKey="invoiceNumber"
                    current={sort}
                    onChange={handleSort}
                  />
                </TableHead>
                <TableHead className="py-3 hidden md:table-cell">
                  <SortHeader
                    label="Client / GSTIN"
                    sortKey="client"
                    current={sort}
                    onChange={handleSort}
                  />
                </TableHead>
                <TableHead className="py-3 hidden lg:table-cell">
                  <SortHeader
                    label="Date"
                    sortKey="invoiceDate"
                    current={sort}
                    onChange={handleSort}
                  />
                </TableHead>
                <TableHead className="py-3 hidden lg:table-cell">
                  <SortHeader
                    label="Due"
                    sortKey="dueDate"
                    current={sort}
                    onChange={handleSort}
                  />
                </TableHead>
                <TableHead className="py-3 hidden xl:table-cell text-right">
                  <SortHeader
                    label="Taxable"
                    sortKey="taxableValue"
                    current={sort}
                    onChange={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="py-3 hidden xl:table-cell text-right">
                  <SortHeader
                    label="GST"
                    sortKey="gstAmount"
                    current={sort}
                    onChange={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="py-3 text-right">
                  <SortHeader
                    label="Total"
                    sortKey="totalAmount"
                    current={sort}
                    onChange={handleSort}
                    align="right"
                  />
                </TableHead>
                <TableHead className="py-3 hidden md:table-cell">
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    current={sort}
                    onChange={handleSort}
                  />
                </TableHead>
                <TableHead className="py-3 hidden md:table-cell">
                  <SortHeader
                    label="Payment"
                    sortKey="paymentStatus"
                    current={sort}
                    onChange={handleSort}
                  />
                </TableHead>
                <TableHead className="py-3 hidden lg:table-cell">
                  <SortHeader
                    label="Risk"
                    sortKey="riskLevel"
                    current={sort}
                    onChange={handleSort}
                  />
                </TableHead>
                <TableHead className="py-3 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    client={clientMap.get(invoice.clientId) ?? null}
                    isSelected={selectedIds.has(invoice.id)}
                    onSelectChange={(c) => handleRowSelect(invoice.id, c)}
                    onClick={() => onRowClick(invoice)}
                    searchQuery={searchQuery}
                    onAction={onAction}
                  />
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {invoices.map((invoice) => (
          <MobileInvoiceCard
            key={invoice.id}
            invoice={invoice}
            client={clientMap.get(invoice.clientId) ?? null}
            isSelected={selectedIds.has(invoice.id)}
            onSelectChange={(c) => handleRowSelect(invoice.id, c)}
            onClick={() => onRowClick(invoice)}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function InvoicePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <div className="text-xs text-muted-foreground">
        Showing <span className="text-foreground font-medium">{from}</span>–
        <span className="text-foreground font-medium">{to}</span> of{' '}
        <span className="text-foreground font-medium">{total}</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 bg-white/[0.03] border border-white/[0.08] rounded-md text-xs text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
        >
          {[10, 25, 50, 100].map((s) => (
            <option key={s} value={s} className="bg-zinc-950">
              {s} / page
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 w-8 p-0 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
          >
            <ChevronUp className="h-3.5 w-3.5 rotate-[-90deg]" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 w-8 p-0 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
