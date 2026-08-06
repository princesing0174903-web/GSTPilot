'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Virtualized Reconciliation Table
// ═══════════════════════════════════════════════════════════════════════════════
// Uses react-window v2 List for virtualization — supports 50,000+ rows without lag.
// Only the visible rows (~20-30) are rendered at any time.
//
// Features:
//   • Checkbox selection per row + select-all
//   • Confidence color bar (green/yellow/red)
//   • Status badge with icon
//   • ITC at risk highlighted in red
//   • Resolved rows dimmed
//   • Sticky header
//   • Smooth hover interactions
//   • Click row to open Oracle drawer
//   • Explain/View/Resolve quick actions per row
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useCallback, useState } from 'react';
import { List, type ListImperativeAPI } from 'react-window';
import {
  CheckCircle2, Sparkles, Zap, Loader2, Download, FileCheck2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type MatchRow, type MatchStatus, STATUS_META, fmtINR,
  confidenceColor, confidenceLabel,
} from './parts';

const ROW_HEIGHT = 56; // px

interface RowProps {
  matches: MatchRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onOpenMatch: (m: MatchRow) => void;
  onResolve: (id: string, resolved: boolean) => void;
  busyId: string | null;
}

const Row = function Row({
  index, style, matches, selectedIds, onToggleRow, onOpenMatch, onResolve, busyId,
}: RowProps & { index: number; style: React.CSSProperties }) {
  const m = matches[index];
  if (!m) return null;
  const meta = STATUS_META[m.status as MatchStatus];
  const Icon = meta.icon;
  const isSelected = selectedIds.has(m.id);
  const confColor = confidenceColor(m.confidence);
  const isBusy = busyId === m.id;

  return (
    <div
      style={style}
      className={`gst-table-row flex items-center border-b border-[#1F1F1F] px-2 ${
        isSelected ? 'gst-table-row-selected' : ''
      } ${m.resolved ? 'opacity-50' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleRow(m.id); }}
        className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
        style={{
          borderColor: isSelected ? '#2563EB' : '#3A3E46',
          backgroundColor: isSelected ? '#2563EB' : 'transparent',
        }}
        aria-label={isSelected ? 'Deselect row' : 'Select row'}
      >
        {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
      </button>

      {/* Status badge */}
      <div className="w-32 shrink-0">
        <span className={`gst-status gst-status-${meta.color}`}>
          <Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      {/* Invoice # + confidence */}
      <button
        onClick={() => onOpenMatch(m)}
        className="flex w-28 shrink-0 flex-col items-start text-left hover:text-[#60A5FA]"
      >
        <span className="truncate font-mono text-xs text-foreground">{m.booksInvoiceNo || m.gstr2bInvoiceNo || '—'}</span>
        {m.confidence > 0 && (
          <div className="flex items-center gap-1">
            <div className="h-1 w-8 overflow-hidden rounded-full bg-[#1F1F1F]">
              <div className="h-full rounded-full" style={{ width: `${Math.round(m.confidence * 100)}%`, backgroundColor: confColor }} />
            </div>
            <span className="text-[9px] font-medium" style={{ color: confColor }}>{confidenceLabel(m.confidence)}</span>
          </div>
        )}
      </button>

      {/* Supplier GSTIN */}
      <div className="hidden w-36 shrink-0 truncate font-mono text-xs text-muted-foreground md:block">
        {m.booksSupplierGSTIN || m.gstr2bSupplierGSTIN || '—'}
      </div>

      {/* Books taxable */}
      <div className="w-24 shrink-0 text-right gst-text-tabular text-xs text-foreground">
        {fmtINR(m.booksTaxableValue)}
      </div>

      {/* 2B taxable */}
      <div className="hidden w-24 shrink-0 text-right gst-text-tabular text-xs text-muted-foreground sm:block">
        {fmtINR(m.gstr2bTaxableValue)}
      </div>

      {/* ITC at risk */}
      <div className="w-24 shrink-0 text-right gst-text-tabular">
        {m.itcAtRisk > 0 ? (
          <span className="text-xs font-semibold text-[#F87171]">{fmtINR(m.itcAtRisk)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Quick actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
        {m.fixApplied && (
          <span title="Auto-fix applied" className="text-[#3B82F6]">
            <Zap className="h-3 w-3" />
          </span>
        )}
        <button
          onClick={() => onOpenMatch(m)}
          className="gst-btn gst-btn-ghost gst-btn-sm !h-7 !px-2"
          title="Oracle AI analysis"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#60A5FA]" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onResolve(m.id, !m.resolved); }}
          disabled={isBusy}
          className={`gst-btn gst-btn-sm !h-7 !px-2 ${m.resolved ? 'gst-btn-ghost' : 'gst-btn-outline'}`}
        >
          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : m.resolved ? 'Reopen' : 'Resolve'}
        </button>
      </div>
    </div>
  );
};

interface VirtualizedTableProps {
  matches: MatchRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpenMatch: (m: MatchRow) => void;
  onResolve: (id: string, resolved: boolean) => void;
  busyId: string | null;
  loading: boolean;
  total: number;
  onLoadMore: () => void;
}

export function VirtualizedReconciliationTable({
  matches, selectedIds, onToggleRow, onToggleAll, onOpenMatch, onResolve, busyId, loading, total, onLoadMore,
}: VirtualizedTableProps) {
  const [, setListRef] = useState<ListImperativeAPI | null>(null);
  const [showAll, setShowAll] = useState(false);

  const rowCount = showAll ? matches.length : Math.min(matches.length, 500);
  const hasMore = matches.length < total;

  const rowProps = useMemo(() => ({
    matches,
    selectedIds,
    onToggleRow,
    onOpenMatch,
    onResolve,
    busyId,
  }), [matches, selectedIds, onToggleRow, onOpenMatch, onResolve, busyId]);

  const handleRowsRendered = useCallback(({ stopIndex }: { startIndex: number; stopIndex: number }) => {
    // Load more when user scrolls near the bottom
    if (hasMore && stopIndex >= matches.length - 10 && !loading) {
      onLoadMore();
    }
  }, [hasMore, matches.length, loading, onLoadMore]);

  const allSelected = matches.length > 0 && matches.every((m) => selectedIds.has(m.id));
  const someSelected = matches.some((m) => selectedIds.has(m.id)) && !allSelected;

  if (loading && matches.length === 0) {
    return (
      <div className="gst-table-wrap">
        <table className="gst-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Status</th>
              <th>Invoice No</th>
              <th className="hidden md:table-cell">Supplier GSTIN</th>
              <th className="text-right">Books Taxable</th>
              <th className="hidden text-right sm:table-cell">2B Taxable</th>
              <th className="text-right">ITC at Risk</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j}><Skeleton className="h-5 w-full" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="gst-table-wrap">
        <div className="gst-empty-state !py-12">
          <div className="gst-empty-state-icon">
            <FileCheck2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="gst-empty-state-title">No matches for this filter</h3>
          <p className="gst-empty-state-desc">Try changing the status filter, clearing the search, or expanding the date range.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gst-card !p-0 overflow-hidden">
      {/* Sticky header */}
      <div className="gst-table-sticky-header flex items-center border-b border-[#2A2E36] bg-[#171A21] px-2 py-2.5">
        <button
          onClick={onToggleAll}
          className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
          style={{
            borderColor: allSelected ? '#2563EB' : '#3A3E46',
            backgroundColor: allSelected ? '#2563EB' : someSelected ? 'rgba(37,99,235,0.4)' : 'transparent',
          }}
          aria-label={allSelected ? 'Deselect all' : 'Select all'}
        >
          {allSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
          {someSelected && !allSelected && <span className="h-0.5 w-2 rounded bg-white" />}
        </button>
        <div className="gst-label w-32 shrink-0">Status</div>
        <div className="gst-label w-28 shrink-0">Invoice / Confidence</div>
        <div className="gst-label hidden w-36 shrink-0 md:block">Supplier GSTIN</div>
        <div className="gst-label w-24 shrink-0 text-right">Books Taxable</div>
        <div className="gst-label hidden w-24 shrink-0 text-right sm:block">2B Taxable</div>
        <div className="gst-label w-24 shrink-0 text-right">ITC at Risk</div>
        <div className="gst-label ml-auto pl-2">Actions</div>
      </div>

      {/* Virtualized list */}
      <div style={{ height: Math.max(rowCount * ROW_HEIGHT, 280), maxHeight: 600 }}>
        <List
          rowComponent={Row}
          rowCount={rowCount}
          rowHeight={ROW_HEIGHT}
          rowProps={rowProps}
          overscanCount={8}
          onRowsRendered={handleRowsRendered}
          listRef={setListRef as never}
          style={{ height: '100%' }}
        />
      </div>

      {/* Footer: count + load more */}
      <div className="flex items-center justify-between border-t border-[#2A2E36] bg-[#171A21] px-3 py-2 text-xs text-muted-foreground">
        <span>
          Showing <span className="font-semibold text-foreground">{rowCount}</span> of{' '}
          <span className="font-semibold text-foreground">{total}</span> matches
          {selectedIds.size > 0 && (
            <span className="ml-2 text-[#60A5FA]">· {selectedIds.size} selected</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {hasMore && (
            <button
              onClick={() => { setShowAll(true); onLoadMore(); }}
              disabled={loading}
              className="gst-btn gst-btn-ghost gst-btn-sm"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Load more
            </button>
          )}
          {matches.length > 500 && !showAll && (
            <button onClick={() => setShowAll(true)} className="gst-btn gst-btn-ghost gst-btn-sm">
              Show all {matches.length}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
