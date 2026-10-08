'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Transactions Table (Premium Enterprise Edition)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Professional data table for banking transactions with:
//   • Header row with count badge + summary stats (inflow/outflow/net) + actions
//   • Collapsible filter bar (search, account, type, category, status, matched,
//     date range) with active-filter count + Clear All button
//   • Sticky sortable column headers (Date, Reference, Narration, Credit, Debit,
//     Balance, Type, Category, Status, Match, Actions)
//   • Search highlighting (<mark>) for description / counterparty / reference
//   • Credit rows: subtle emerald left border; Debit rows: subtle red left border
//   • Category badges colored per category (14 categories mapped to 4 tones)
//   • Per-row dropdown actions (View, Edit, Categorize, Match, Delete)
//   • Bulk action bar (Mark reconciled, Export CSV, Delete) — floats at bottom
//   • Pagination with page numbers (1 2 3 ... N) + page-size selector
//   • Mobile responsive: card list below md, full table md+
//   • Empty states: "No transactions yet" vs BankingFilteredEmptyState
//   • Memoized rows + useMemo pipeline + useCallback handlers
//   • Self-contained: falls back to useBankingApi() when callbacks omitted
// ═══════════════════════════════════════════════════════════════════════════════

import React, { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Download,
  Plus,
  Search,
  Filter,
  X,
  ShieldCheck,
  Tag,
  Link2,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  SlidersHorizontal,
} from 'lucide-react';
import type { BankingTransaction, TransactionCategory } from '@/lib/banking-prisma/types';
import { formatCurrency, formatDate } from '@/lib/gst-utils';
import { useBankingApi, useDebouncedValue } from '@/hooks/useBankingApi';
import {
  TransactionTypePill,
  TransactionStatusPill,
  MatchTypePill,
  StaggeredItem,
} from './BankingStatusPills';
import { BankingFilteredEmptyState } from './BankingEmptyErrorStates';
import { toast } from 'sonner';

// ─── Category Badge Config ────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<TransactionCategory, { label: string; className: string }> = {
  sales:           { label: 'Sales',     className: 'bg-blue-500/10 text-blue-300 border-blue-500/25' },
  purchase:        { label: 'Purchase',  className: 'bg-sky-500/10 text-sky-300 border-sky-500/25' },
  gst:             { label: 'GST',       className: 'bg-amber-500/10 text-amber-300 border-amber-500/25' },
  salary:          { label: 'Salary',    className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25' },
  rent:            { label: 'Rent',      className: 'bg-amber-500/10 text-amber-300 border-amber-500/25' },
  utilities:       { label: 'Utilities', className: 'bg-sky-500/10 text-sky-300 border-sky-500/25' },
  loan:            { label: 'Loan',      className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25' },
  interest:        { label: 'Interest',  className: 'bg-blue-500/10 text-blue-300 border-blue-500/25' },
  transfer:        { label: 'Transfer',  className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25' },
  investment:      { label: 'Investment',className: 'bg-sky-500/10 text-sky-300 border-sky-500/25' },
  cash_withdrawal: { label: 'Cash',      className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25' },
  fee:             { label: 'Fee',       className: 'bg-red-500/10 text-red-300 border-red-500/25' },
  refund:          { label: 'Refund',    className: 'bg-blue-500/10 text-blue-300 border-blue-500/25' },
  other:           { label: 'Other',     className: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/25' },
};

const CATEGORY_OPTIONS: TransactionCategory[] = [
  'sales', 'purchase', 'gst', 'salary', 'rent', 'utilities', 'loan', 'interest',
  'transfer', 'investment', 'cash_withdrawal', 'fee', 'refund', 'other',
];

function CategoryBadge({ category }: { category: TransactionCategory }) {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Sort System ──────────────────────────────────────────────────────────────

export type SortKey =
  | 'date'
  | 'reference'
  | 'description'
  | 'amount'
  | 'balance'
  | 'type'
  | 'category'
  | 'status'
  | 'match';

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
  if (!text) return text;
  if (!query) return text;
  const q = query.trim().toLowerCase();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-500/20 text-blue-100 rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─── CSV Export Helper ────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportTransactionsCSV(rows: BankingTransaction[]): void {
  if (rows.length === 0) {
    toast.info('No transactions to export');
    return;
  }
  const headers = [
    'Date', 'Value Date', 'Reference', 'Description', 'Narration',
    'Counterparty', 'Type', 'Amount', 'Balance', 'Category', 'Status',
    'Match Type', 'Matched', 'Source', 'Bank', 'Account', 'UPI Ref',
  ];
  const csvRows = rows.map((t) =>
    [
      t.date,
      t.valueDate ?? '',
      t.referenceNo ?? t.reference ?? '',
      t.description,
      t.narration ?? '',
      t.counterparty ?? '',
      t.type,
      t.amount,
      t.balance ?? '',
      t.category,
      t.status,
      t.matchType ?? '',
      t.matched ? 'yes' : 'no',
      t.source,
      t.bankName,
      t.accountMasked,
      t.upiRef ?? '',
    ]
      .map(csvEscape)
      .join(','),
  );
  const csv = [headers.join(','), ...csvRows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gstpilot-transactions-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} transaction${rows.length === 1 ? '' : 's'}`);
}

// ─── Memoized Desktop Row ─────────────────────────────────────────────────────

interface TransactionRowProps {
  txn: BankingTransaction;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  searchQuery: string;
  onAction: (action: string, txn: BankingTransaction) => void;
}

const TransactionRow = memo(function TransactionRow({
  txn,
  isSelected,
  onSelectChange,
  searchQuery,
  onAction,
}: TransactionRowProps) {
  const isCredit = txn.type === 'credit';
  const isDebit = txn.type === 'debit';
  const reference = txn.referenceNo ?? txn.reference ?? '—';
  const narration = txn.narration ?? txn.description;
  const counterparty = txn.counterparty ?? '';

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    onAction(action, txn);
  };

  return (
    <TableRow
      data-txn-id={txn.id}
      className={`gst-table-row group transition-colors ${
        isSelected ? 'gst-table-row-selected' : ''
      } ${isCredit ? 'border-l-2 border-l-blue-500/40' : ''} ${
        isDebit ? 'border-l-2 border-l-red-500/40' : ''
      }`}
    >
      <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(v) => onSelectChange(Boolean(v))}
          aria-label={`Select transaction ${txn.description}`}
        />
      </TableCell>
      <TableCell className="py-3">
        <div className="text-sm font-medium text-foreground gst-text-tabular">
          {formatDate(txn.date)}
        </div>
        {txn.valueDate && (
          <div className="text-[11px] text-muted-foreground gst-text-tabular">
            Val: {formatDate(txn.valueDate)}
          </div>
        )}
      </TableCell>
      <TableCell className="py-3 hidden lg:table-cell">
        <div className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
          {highlightMatch(reference, searchQuery)}
        </div>
      </TableCell>
      <TableCell className="py-3 min-w-[200px]">
        <div className="text-sm font-medium text-foreground truncate max-w-[260px]">
          {highlightMatch(txn.description, searchQuery)}
        </div>
        {(narration !== txn.description || counterparty) && (
          <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
            {counterparty && (
              <span className="text-zinc-400">{highlightMatch(counterparty, searchQuery)}</span>
            )}
            {counterparty && narration !== txn.description && <span className="mx-1 text-white/20">·</span>}
            {narration !== txn.description && (
              <span>{highlightMatch(narration, searchQuery)}</span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="py-3 text-right">
        {isCredit ? (
          <span className="text-sm font-semibold text-blue-400 gst-text-tabular">
            +{formatCurrency(txn.amount)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">—</span>
        )}
      </TableCell>
      <TableCell className="py-3 text-right">
        {isDebit ? (
          <span className="text-sm font-semibold text-red-400 gst-text-tabular">
            −{formatCurrency(txn.amount)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">—</span>
        )}
      </TableCell>
      <TableCell className="py-3 hidden xl:table-cell text-right">
        <span className="text-sm text-muted-foreground tabular-nums">
          {txn.balance !== null && txn.balance !== undefined ? formatCurrency(txn.balance) : '—'}
        </span>
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <TransactionTypePill type={txn.type} />
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <CategoryBadge category={txn.category} />
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <TransactionStatusPill status={txn.status} />
      </TableCell>
      <TableCell className="py-3 hidden lg:table-cell">
        {txn.matched && txn.matchType ? (
          <MatchTypePill matchType={txn.matchType} />
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Transaction actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 bg-zinc-950 border-white/10"
            >
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Transaction
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onAction('view', txn)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 mr-2" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('edit', txn)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('categorize', txn)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5 mr-2" />
                Categorize
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('match', txn)}
                className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground cursor-pointer"
                disabled={txn.matched}
              >
                <Link2 className="h-3.5 w-3.5 mr-2" />
                Match to invoice
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={(e) => handleAction(e, 'delete')}
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

// ─── Memoized Mobile Card ─────────────────────────────────────────────────────

interface MobileCardProps {
  txn: BankingTransaction;
  index: number;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  searchQuery: string;
  onAction: (action: string, txn: BankingTransaction) => void;
}

const MobileCard = memo(function MobileCard({
  txn,
  index,
  isSelected,
  onSelectChange,
  searchQuery,
  onAction,
}: MobileCardProps) {
  const isCredit = txn.type === 'credit';
  const reference = txn.referenceNo ?? txn.reference ?? '';

  return (
    <StaggeredItem index={index}>
      <div
        className={`glass-surface rounded-xl border p-3 transition-all ${
          isSelected
            ? 'border-blue-500/40 bg-blue-500/[0.04]'
            : 'border-white/[0.06] hover:border-white/[0.12]'
        } ${isCredit ? 'border-l-2 border-l-blue-500/50' : 'border-l-2 border-l-red-500/50'}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(v) => onSelectChange(Boolean(v))}
              aria-label={`Select ${txn.description}`}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {highlightMatch(txn.description, searchQuery)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {formatDate(txn.date)}
                {reference && (
                  <span className="ml-1.5 font-mono">· {highlightMatch(reference, searchQuery)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-sm font-bold gst-text-tabular ${
                isCredit ? 'text-blue-400' : 'text-red-400'
              }`}
            >
              {isCredit ? '+' : '−'}
              {formatCurrency(txn.amount)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-7 w-7 rounded-md text-muted-foreground hover:bg-white/[0.06] flex items-center justify-center"
                  aria-label="Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-zinc-950 border-white/10">
                <DropdownMenuItem onClick={() => onAction('view', txn)} className="text-xs cursor-pointer">
                  <Eye className="h-3.5 w-3.5 mr-2" /> View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction('edit', txn)} className="text-xs cursor-pointer">
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction('categorize', txn)} className="text-xs cursor-pointer">
                  <Tag className="h-3.5 w-3.5 mr-2" /> Categorize
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAction('match', txn)}
                  className="text-xs cursor-pointer"
                  disabled={txn.matched}
                >
                  <Link2 className="h-3.5 w-3.5 mr-2" /> Match
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuItem
                  onClick={() => onAction('delete', txn)}
                  className="text-xs text-red-400 focus:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={txn.category} />
          <TransactionStatusPill status={txn.status} />
          {txn.matched && txn.matchType && <MatchTypePill matchType={txn.matchType} />}
          <span className="text-[11px] text-muted-foreground ml-auto truncate max-w-[140px]">
            {txn.bankName} {txn.accountMasked}
          </span>
        </div>
      </div>
    </StaggeredItem>
  );
});

// ─── Bulk Action Bar (floating, portal-rendered) ──────────────────────────────

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkAction: (action: string) => void;
  busy?: boolean;
}

const BulkActionBar = memo(function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkAction,
  busy = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;
  const allSelected = selectedCount === totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
    >
      <div className="glass-surface-strong flex flex-wrap items-center gap-2 rounded-2xl border border-blue-500/30 bg-zinc-950/95 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-blue-500/10">
        <div className="flex items-center gap-2 mr-1">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => (allSelected ? onClearSelection() : onSelectAll())}
            aria-label="Select all"
          />
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {selectedCount} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="h-5 w-px bg-white/[0.08]" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
            onClick={() => onBulkAction('reconcile')}
            disabled={busy}
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            Mark reconciled
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs"
            onClick={() => onBulkAction('export-csv')}
            disabled={busy}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-300 text-xs"
            onClick={() => onBulkAction('delete')}
            disabled={busy}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

// ─── Filter Bar (collapsible) ─────────────────────────────────────────────────

interface FilterState {
  search: string;
  accountId: string; // 'all' or account id
  type: 'all' | 'credit' | 'debit';
  category: 'all' | TransactionCategory;
  status: 'all' | 'posted' | 'pending' | 'reconciled' | 'disputed';
  matched: 'all' | 'matched' | 'unmatched';
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FilterState = {
  search: '',
  accountId: 'all',
  type: 'all',
  category: 'all',
  status: 'all',
  matched: 'all',
  dateFrom: '',
  dateTo: '',
};

interface FilterBarProps {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  accounts: Array<{ id: string; bankName: string; accountMasked: string }>;
  activeCount: number;
  open: boolean;
}

const selectTriggerClass =
  'h-9 bg-white/[0.02] border-white/[0.08] text-foreground text-xs hover:bg-white/[0.04] focus:ring-blue-500/30 w-full';
const selectContentClass = 'bg-zinc-950 border-white/10';

function FilterBar({ filters, onChange, onClear, accounts, activeCount, open }: FilterBarProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="glass-surface rounded-2xl border border-white/[0.06] p-4 space-y-3">
            {/* Search row */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={filters.search}
                onChange={(e) => onChange({ search: e.target.value })}
                placeholder="Search description, counterparty, reference, narration…"
                className="pl-9 h-9 bg-white/[0.02] border-white/[0.08] text-sm placeholder:text-muted-foreground/60 focus:ring-blue-500/30"
              />
            </div>

            {/* Selects row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              <Select
                value={filters.accountId}
                onValueChange={(v) => onChange({ accountId: v })}
              >
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all" className="text-xs cursor-pointer">All accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs cursor-pointer">
                      {a.bankName} {a.accountMasked}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.type} onValueChange={(v) => onChange({ type: v as FilterState['type'] })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all" className="text-xs cursor-pointer">All types</SelectItem>
                  <SelectItem value="credit" className="text-xs cursor-pointer">Credit</SelectItem>
                  <SelectItem value="debit" className="text-xs cursor-pointer">Debit</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.category} onValueChange={(v) => onChange({ category: v as FilterState['category'] })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all" className="text-xs cursor-pointer">All categories</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs cursor-pointer">
                      {CATEGORY_CONFIG[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(v) => onChange({ status: v as FilterState['status'] })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all" className="text-xs cursor-pointer">All statuses</SelectItem>
                  <SelectItem value="posted" className="text-xs cursor-pointer">Posted</SelectItem>
                  <SelectItem value="pending" className="text-xs cursor-pointer">Pending</SelectItem>
                  <SelectItem value="reconciled" className="text-xs cursor-pointer">Reconciled</SelectItem>
                  <SelectItem value="disputed" className="text-xs cursor-pointer">Disputed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.matched} onValueChange={(v) => onChange({ matched: v as FilterState['matched'] })}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Matched" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  <SelectItem value="all" className="text-xs cursor-pointer">All</SelectItem>
                  <SelectItem value="matched" className="text-xs cursor-pointer">Matched</SelectItem>
                  <SelectItem value="unmatched" className="text-xs cursor-pointer">Unmatched</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  From date
                </label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => onChange({ dateFrom: e.target.value })}
                  className="h-9 bg-white/[0.02] border-white/[0.08] text-sm text-foreground focus:ring-blue-500/30 [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  To date
                </label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => onChange({ dateTo: e.target.value })}
                  className="h-9 bg-white/[0.02] border-white/[0.08] text-sm text-foreground focus:ring-blue-500/30 [color-scheme:dark]"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClear}
                  disabled={activeCount === 0}
                  className="h-9 gap-2 border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                  {activeCount > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 h-5 min-w-5 px-1.5 text-[11px] border-blue-500/30 bg-blue-500/10 text-blue-300"
                    >
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('ellipsis');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <div className="text-xs text-muted-foreground">
        Showing <span className="text-foreground font-medium">{from}</span>–
        <span className="text-foreground font-medium">{to}</span> of{' '}
        <span className="text-foreground font-medium">{total}</span>
      </div>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger size="sm" className="h-8 w-[110px] bg-white/[0.03] border-white/[0.08] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            {[10, 25, 50, 100].map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs cursor-pointer">
                {s} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 w-8 p-0 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
            aria-label="Previous page"
          >
            <ChevronUp className="h-3.5 w-3.5 rotate-[-90deg]" />
          </Button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-1.5 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`h-8 min-w-8 px-2 rounded-md text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                  }`}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 w-8 p-0 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
            aria-label="Next page"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

interface SummaryStatsProps {
  totalInflow: number;
  totalOutflow: number;
}

function SummaryStats({ totalInflow, totalOutflow }: SummaryStatsProps) {
  const net = totalInflow - totalOutflow;
  return (
    <div className="hidden md:flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <ArrowDownLeft className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          In
        </span>
        <span className="text-sm font-semibold text-blue-400 gst-text-tabular">
          {formatCurrency(totalInflow)}
        </span>
      </div>
      <div className="h-4 w-px bg-white/[0.08]" />
      <div className="flex items-center gap-1.5">
        <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Out
        </span>
        <span className="text-sm font-semibold text-red-400 tabular-nums">
          {formatCurrency(totalOutflow)}
        </span>
      </div>
      <div className="h-4 w-px bg-white/[0.08]" />
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Net
        </span>
        <span
          className={`text-sm font-semibold gst-text-tabular ${
            net >= 0 ? 'text-blue-400' : 'text-red-400'
          }`}
        >
          {net >= 0 ? '+' : '−'}
          {formatCurrency(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────

function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i} className="border-b border-white/[0.04]">
          <TableCell className="w-10 pl-4">
            <div className="h-4 w-4 rounded bg-white/[0.04] animate-pulse" />
          </TableCell>
          <TableCell className="py-3">
            <div className="h-3 w-20 rounded bg-white/[0.04] animate-pulse" />
          </TableCell>
          <TableCell className="py-3 hidden lg:table-cell">
            <div className="h-3 w-24 rounded bg-white/[0.04] animate-pulse" />
          </TableCell>
          <TableCell className="py-3">
            <div className="h-3 w-44 rounded bg-white/[0.04] animate-pulse mb-1.5" />
            <div className="h-2.5 w-32 rounded bg-white/[0.03] animate-pulse" />
          </TableCell>
          <TableCell className="py-3 text-right">
            <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse ml-auto" />
          </TableCell>
          <TableCell className="py-3 text-right">
            <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse ml-auto" />
          </TableCell>
          <TableCell className="py-3 hidden xl:table-cell text-right">
            <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse ml-auto" />
          </TableCell>
          <TableCell className="py-3 hidden md:table-cell">
            <div className="h-4 w-14 rounded-full bg-white/[0.04] animate-pulse" />
          </TableCell>
          <TableCell className="py-3 hidden md:table-cell">
            <div className="h-4 w-16 rounded bg-white/[0.04] animate-pulse" />
          </TableCell>
          <TableCell className="py-3 hidden md:table-cell">
            <div className="h-4 w-16 rounded-full bg-white/[0.04] animate-pulse" />
          </TableCell>
          <TableCell className="py-3 hidden lg:table-cell">
            <div className="h-4 w-20 rounded-full bg-white/[0.04] animate-pulse" />
          </TableCell>
          <TableCell className="py-3 pr-3 text-right">
            <div className="h-7 w-7 rounded bg-white/[0.04] animate-pulse ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface BankingTransactionsTableProps {
  transactions: BankingTransaction[];
  total: number;
  totalInflow: number;
  totalOutflow: number;
  loading?: boolean;
  accounts?: Array<{ id: string; bankName: string; accountMasked: string }>;
  onPageChange?: (offset: number, limit: number) => void;
  onSortChange?: (sortBy: string, sortDir: 'asc' | 'desc') => void;
  onFilterChange?: (filters: Record<string, unknown>) => void;
  onEdit?: (txn: BankingTransaction) => void;
  onDelete?: (id: string) => Promise<void>;
  onBulkUpdate?: (ids: string[], patch: Partial<BankingTransaction>) => Promise<void>;
  onExport?: () => void;
}

export function BankingTransactionsTable({
  transactions,
  total,
  totalInflow,
  totalOutflow,
  loading = false,
  accounts = [],
  onPageChange,
  onSortChange,
  onFilterChange,
  onEdit,
  onDelete,
  onBulkUpdate,
  onExport,
}: BankingTransactionsTableProps) {
  const api = useBankingApi();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mount flag for portal rendering (avoids SSR mismatch)
  useEffect(() => setMounted(true), []);

  // ── Debounced search ──────────────────────────────────────────────────────
  const debouncedSearch = useDebouncedValue(filters.search, 250);

  // ── Sync filters state with debounced search for downstream pipeline ──────
  const effectiveFilters = useMemo<FilterState>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  // ── Active filter count (for the Clear All badge) ─────────────────────────
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (effectiveFilters.search) n++;
    if (effectiveFilters.accountId !== 'all') n++;
    if (effectiveFilters.type !== 'all') n++;
    if (effectiveFilters.category !== 'all') n++;
    if (effectiveFilters.status !== 'all') n++;
    if (effectiveFilters.matched !== 'all') n++;
    if (effectiveFilters.dateFrom) n++;
    if (effectiveFilters.dateTo) n++;
    return n;
  }, [effectiveFilters]);

  // ── Filter pipeline (client-side) ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!transactions) return [] as BankingTransaction[];
    const search = effectiveFilters.search.trim().toLowerCase();
    const dateFrom = effectiveFilters.dateFrom ? new Date(effectiveFilters.dateFrom) : null;
    const dateTo = effectiveFilters.dateTo ? new Date(effectiveFilters.dateTo) : null;
    if (dateTo) dateTo.setHours(23, 59, 59, 999);

    return transactions.filter((t) => {
      if (search) {
        const haystack = [t.description, t.counterparty, t.referenceNo, t.reference, t.narration]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (effectiveFilters.accountId !== 'all' && t.accountId !== effectiveFilters.accountId) return false;
      if (effectiveFilters.type !== 'all' && t.type !== effectiveFilters.type) return false;
      if (effectiveFilters.category !== 'all' && t.category !== effectiveFilters.category) return false;
      if (effectiveFilters.status !== 'all' && t.status !== effectiveFilters.status) return false;
      if (effectiveFilters.matched === 'matched' && !t.matched) return false;
      if (effectiveFilters.matched === 'unmatched' && t.matched) return false;
      if (dateFrom || dateTo) {
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  }, [transactions, effectiveFilters]);

  // ── Sort pipeline ─────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sort.key) {
        case 'date':
          av = new Date(a.date).getTime();
          bv = new Date(b.date).getTime();
          break;
        case 'reference':
          av = (a.referenceNo ?? a.reference ?? '').toLowerCase();
          bv = (b.referenceNo ?? b.reference ?? '').toLowerCase();
          break;
        case 'description':
          av = (a.description ?? '').toLowerCase();
          bv = (b.description ?? '').toLowerCase();
          break;
        case 'amount':
          av = a.amount;
          bv = b.amount;
          break;
        case 'balance':
          av = a.balance ?? 0;
          bv = b.balance ?? 0;
          break;
        case 'type':
          av = a.type;
          bv = b.type;
          break;
        case 'category':
          av = a.category;
          bv = b.category;
          break;
        case 'status':
          av = a.status;
          bv = b.status;
          break;
        case 'match':
          av = a.matchType ?? '';
          bv = b.matchType ?? '';
          break;
        default:
          av = new Date(a.date).getTime();
          bv = new Date(b.date).getTime();
      }
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const filteredTotal = sorted.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  // Clamp page when filteredTotal shrinks below current page
  const effectivePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (effectivePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, effectivePage, pageSize]);

  // ── Reset page when filter/sort/pageSize changes ──────────────────────────
  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, sort.key, sort.dir, pageSize]);

  // ── Notify parent (optional) ──────────────────────────────────────────────
  // Parents that want to sync URL state or refetch server-side should wrap
  // their callback props in useCallback to avoid re-firing on every render.
  useEffect(() => {
    if (!onFilterChange) return;
    onFilterChange({
      search: effectiveFilters.search || undefined,
      accountId: effectiveFilters.accountId !== 'all' ? effectiveFilters.accountId : undefined,
      type: effectiveFilters.type !== 'all' ? effectiveFilters.type : undefined,
      category: effectiveFilters.category !== 'all' ? effectiveFilters.category : undefined,
      status: effectiveFilters.status !== 'all' ? effectiveFilters.status : undefined,
      matched: effectiveFilters.matched !== 'all' ? effectiveFilters.matched : undefined,
      dateFrom: effectiveFilters.dateFrom || undefined,
      dateTo: effectiveFilters.dateTo || undefined,
    });
  }, [effectiveFilters, onFilterChange]);

  useEffect(() => {
    if (!onSortChange) return;
    onSortChange(sort.key, sort.dir);
  }, [sort, onSortChange]);

  useEffect(() => {
    if (!onPageChange) return;
    onPageChange((effectivePage - 1) * pageSize, pageSize);
  }, [effectivePage, pageSize, onPageChange]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (key: SortKey) => {
      setSort((prev) =>
        prev.key === key
          ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
          : { key, dir: 'asc' },
      );
    },
    [],
  );

  const handleFilterChange = useCallback((patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAll = useCallback(() => {
    if (paginated.length === 0) return;
    setSelectedIds(new Set(paginated.map((t) => t.id)));
  }, [paginated]);

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleRowSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    if (onExport) {
      onExport();
      return;
    }
    exportTransactionsCSV(sorted);
  }, [onExport, sorted]);

  const handleAdd = useCallback(() => {
    if (onEdit) {
      onEdit({} as BankingTransaction);
    } else {
      toast.info('Add transaction form is not configured');
    }
  }, [onEdit]);

  const handleRowAction = useCallback(
    async (action: string, txn: BankingTransaction) => {
      if (action === 'view' || action === 'edit' || action === 'categorize' || action === 'match') {
        if (onEdit) {
          onEdit(txn);
        } else {
          toast.info('Edit handler not configured');
        }
        return;
      }
      if (action === 'delete') {
        try {
          if (onDelete) {
            await onDelete(txn.id);
          } else {
            await api.deleteTransaction(txn.id);
            toast.success('Transaction deleted');
          }
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(txn.id);
            return next;
          });
        } catch (err) {
          toast.error('Failed to delete transaction', {
            description: (err as Error).message,
          });
        }
      }
    },
    [onEdit, onDelete, api],
  );

  const handleBulkAction = useCallback(
    async (action: string) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      if (action === 'export-csv') {
        const selectedTxns = sorted.filter((t) => selectedIds.has(t.id));
        exportTransactionsCSV(selectedTxns);
        return;
      }

      if (action === 'reconcile') {
        setBulkBusy(true);
        try {
          const patch: Partial<BankingTransaction> = {
            status: 'reconciled',
            matched: true,
            reconciledAt: new Date().toISOString(),
          };
          if (onBulkUpdate) {
            await onBulkUpdate(ids, patch);
          } else {
            await api.bulkUpdateTransactions(ids, patch);
          }
          toast.success(`Marked ${ids.length} transaction${ids.length === 1 ? '' : 's'} reconciled`);
          setSelectedIds(new Set());
        } catch (err) {
          toast.error('Failed to update transactions', {
            description: (err as Error).message,
          });
        } finally {
          setBulkBusy(false);
        }
        return;
      }

      if (action === 'delete') {
        setBulkBusy(true);
        try {
          if (onDelete) {
            await Promise.all(ids.map((id) => onDelete(id)));
          } else {
            await Promise.all(ids.map((id) => api.deleteTransaction(id)));
          }
          toast.success(`Deleted ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
          setSelectedIds(new Set());
        } catch (err) {
          toast.error('Failed to delete some transactions', {
            description: (err as Error).message,
          });
        } finally {
          setBulkBusy(false);
        }
      }
    },
    [selectedIds, sorted, onBulkUpdate, onDelete, api],
  );

  // ── Derived display values ────────────────────────────────────────────────
  const hasAnyTransactions = transactions.length > 0;
  const isFilteredEmpty = !loading && hasAnyTransactions && filteredTotal === 0;
  const showEmptyState = !loading && !hasAnyTransactions;

  const allOnPageSelected = paginated.length > 0 && paginated.every((t) => selectedIds.has(t.id));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Receipt className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              Transactions
              <Badge
                variant="outline"
                className="text-[11px] font-medium border-white/[0.08] bg-white/[0.03] text-muted-foreground"
              >
                {total.toLocaleString('en-IN')}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              All inflows & outflows across connected accounts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SummaryStats totalInflow={totalInflow} totalOutflow={totalOutflow} />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2 border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              className="gap-2 bg-blue-600 text-white hover:bg-blue-500 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Transaction
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Filter Toggle Row ─── */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen((v) => !v)}
          className="gap-2 border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] text-xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant="outline"
              className="h-5 min-w-5 px-1.5 text-[11px] border-blue-500/30 bg-blue-500/10 text-blue-300"
            >
              {activeFilterCount}
            </Badge>
          )}
          <Filter className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </Button>
        {activeFilterCount > 0 && !filtersOpen && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {/* ─── Filter Bar ─── */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        accounts={accounts}
        activeCount={activeFilterCount}
        open={filtersOpen}
      />

      {/* ─── Empty: no transactions at all ─── */}
      {showEmptyState && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-surface flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] p-12 text-center"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
            <Receipt className="h-7 w-7 text-blue-400" />
          </div>
          <h3 className="mb-1.5 text-base font-semibold text-foreground">No transactions yet</h3>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            Transactions will appear here once you connect a bank account or import a statement.
          </p>
          <Button
            onClick={handleAdd}
            className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </motion.div>
      )}

      {/* ─── Empty: filters returned nothing ─── */}
      {isFilteredEmpty && <BankingFilteredEmptyState onClearFilters={handleClearFilters} />}

      {/* ─── Table (desktop) ─── */}
      {!showEmptyState && !isFilteredEmpty && (
        <>
          <div className="hidden md:block glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/[0.06] hover:bg-black/80">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={() =>
                          allOnPageSelected ? handleClearSelection() : handleSelectAll()
                        }
                        aria-label="Select all on page"
                      />
                    </TableHead>
                    <TableHead className="py-3">
                      <SortHeader label="Date" sortKey="date" current={sort} onChange={handleSort} />
                    </TableHead>
                    <TableHead className="py-3 hidden lg:table-cell">
                      <SortHeader label="Reference" sortKey="reference" current={sort} onChange={handleSort} />
                    </TableHead>
                    <TableHead className="py-3">
                      <SortHeader label="Narration / Description" sortKey="description" current={sort} onChange={handleSort} />
                    </TableHead>
                    <TableHead className="py-3 text-right">
                      <SortHeader label="Credit" sortKey="amount" current={sort} onChange={handleSort} align="right" />
                    </TableHead>
                    <TableHead className="py-3 text-right">
                      <SortHeader label="Debit" sortKey="amount" current={sort} onChange={handleSort} align="right" />
                    </TableHead>
                    <TableHead className="py-3 hidden xl:table-cell text-right">
                      <SortHeader label="Balance" sortKey="balance" current={sort} onChange={handleSort} align="right" />
                    </TableHead>
                    <TableHead className="py-3 hidden md:table-cell">
                      <SortHeader label="Type" sortKey="type" current={sort} onChange={handleSort} />
                    </TableHead>
                    <TableHead className="py-3 hidden md:table-cell">
                      <SortHeader label="Category" sortKey="category" current={sort} onChange={handleSort} />
                    </TableHead>
                    <TableHead className="py-3 hidden md:table-cell">
                      <SortHeader label="Status" sortKey="status" current={sort} onChange={handleSort} />
                    </TableHead>
                    <TableHead className="py-3 hidden lg:table-cell">
                      <SortHeader label="Match" sortKey="match" current={sort} onChange={handleSort} />
                    </TableHead>
                    <TableHead className="py-3 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <SkeletonRows />
                  ) : (
                    <AnimatePresence>
                      {paginated.map((txn) => (
                        <TransactionRow
                          key={txn.id}
                          txn={txn}
                          isSelected={selectedIds.has(txn.id)}
                          onSelectChange={(c) => handleRowSelect(txn.id, c)}
                          searchQuery={effectiveFilters.search}
                          onAction={handleRowAction}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ─── Mobile cards ─── */}
          <div className="md:hidden space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="glass-surface rounded-xl border border-white/[0.06] p-3 animate-pulse"
                  >
                    <div className="h-4 w-3/4 rounded bg-white/[0.04] mb-2" />
                    <div className="h-3 w-1/2 rounded bg-white/[0.03]" />
                  </div>
                ))}
              </div>
            ) : (
              paginated.map((txn, idx) => (
                <MobileCard
                  key={txn.id}
                  txn={txn}
                  index={idx}
                  isSelected={selectedIds.has(txn.id)}
                  onSelectChange={(c) => handleRowSelect(txn.id, c)}
                  searchQuery={effectiveFilters.search}
                  onAction={handleRowAction}
                />
              ))
            )}
          </div>

          {/* ─── Pagination ─── */}
          {!loading && filteredTotal > 0 && (
            <Pagination
              page={effectivePage}
              pageSize={pageSize}
              total={filteredTotal}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}

      {/* ─── Floating Bulk Action Bar (portal-rendered to body) ─── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <BulkActionBar
                selectedCount={selectedIds.size}
                totalCount={filteredTotal}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
                onBulkAction={handleBulkAction}
                busy={bulkBusy}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

export default BankingTransactionsTable;
