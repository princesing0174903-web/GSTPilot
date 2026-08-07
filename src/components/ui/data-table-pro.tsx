'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Premium Enterprise DataTable
// ═══════════════════════════════════════════════════════════════════════════════
//
// Enterprise-grade table inspired by Stripe / Linear / Notion data tables.
//
// Features:
//   • Sticky header with backdrop blur
//   • Column sorting (click header → asc/desc/none cycle)
//   • Row hover highlight (gst-table-row)
//   • Keyboard navigation (arrow up/down to move selection, Enter to activate)
//   • Loading skeleton rows
//   • Empty state with illustration + CTA
//   • Smooth scroll
//   • Colored confidence bars / badges via renderCell
//   • Selection state (checkbox column optional)
//   • Responsive (horizontal scroll on overflow)
//
// Usage:
//   <DataTable
//     columns={[{ key: 'name', header: 'Name', sortable: true, render: (row) => row.name }]}
//     data={items}
//     loading={isLoading}
//     onRowClick={(row) => openDetail(row)}
//     emptyState={<EmptyState ... />}
//   />
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  headerClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  className?: string;
  maxHeight?: string;
  stickyHeader?: boolean;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 8,
  onRowClick,
  emptyState,
  className,
  maxHeight = '60vh',
  stickyHeader = true,
  initialSort,
}: DataTableProps<T>) {
  const [sortState, setSortState] = React.useState<
    { key: string; dir: 'asc' | 'desc' } | null
  >(initialSort ?? null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  // Sorted data (memoized)
  const sortedData = React.useMemo(() => {
    if (!sortState) return data;
    const col = columns.find((c) => c.key === sortState.key);
    if (!col?.sortValue) return data;
    const dir = sortState.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, sortState, columns]);

  // Sort toggle handler
  const handleSort = React.useCallback(
    (col: DataTableColumn<T>) => {
      if (!col.sortable) return;
      setSortState((prev) => {
        if (prev?.key !== col.key) return { key: col.key, dir: 'asc' };
        if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
        return null; // third click clears sort
      });
    },
    []
  );

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, sortedData.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && onRowClick) {
        e.preventDefault();
        onRowClick(sortedData[focusedIndex]);
      }
    },
    [sortedData, focusedIndex, onRowClick]
  );

  const alignClass = (align?: string) =>
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left';

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn('overflow-hidden rounded-lg border', className)}>
        <div className="overflow-x-auto" style={{ maxHeight }}>
          <table className="w-full border-collapse text-sm">
            <thead className={cn(stickyHeader && 'gst-table-sticky-header')}>
              <tr className="border-b">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 gst-text-label',
                      alignClass(col.align)
                    )}
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="gst-shimmer-premium h-3.5 w-3/4 rounded" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (!loading && sortedData.length === 0) {
    return (
      <div className={cn('overflow-hidden rounded-lg border', className)}>
        {emptyState ?? (
          <div className="gst-empty-state">
            <div className="gst-empty-state-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 3v18" />
              </svg>
            </div>
            <p className="gst-empty-state-title">No data yet</p>
            <p className="gst-empty-state-desc">
              There are no records to display right now.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      <div
        className="overflow-x-auto custom-scrollbar"
        style={{ maxHeight }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="grid"
      >
        <table className="w-full border-collapse text-sm">
          <thead className={cn(stickyHeader && 'gst-table-sticky-header')}>
            <tr className="border-b">
              {columns.map((col) => {
                const isSorted = sortState?.key === col.key;
                const SortIcon = !col.sortable
                  ? null
                  : isSorted
                    ? sortState?.dir === 'asc'
                      ? ChevronUp
                      : ChevronDown
                    : ChevronsUpDown;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 gst-text-label select-none',
                      alignClass(col.align),
                      col.sortable && 'cursor-pointer hover:text-foreground',
                      col.headerClassName
                    )}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col)}
                    aria-sort={
                      isSorted
                        ? sortState?.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        col.align === 'right' && 'flex-row-reverse'
                      )}
                    >
                      {col.header}
                      {SortIcon && (
                        <SortIcon
                          className={cn(
                            'h-3 w-3',
                            isSorted ? 'text-primary' : 'text-muted-foreground/50'
                          )}
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => {
              const key = rowKey(row, index);
              const isFocused = index === focusedIndex;
              return (
                <tr
                  key={key}
                  className={cn(
                    'gst-table-row border-b border-border/40',
                    onRowClick && 'cursor-pointer',
                    isFocused && 'gst-table-row-selected'
                  )}
                  onClick={() => onRowClick?.(row)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 align-middle',
                        alignClass(col.align),
                        col.className
                      )}
                      style={{ width: col.width }}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
