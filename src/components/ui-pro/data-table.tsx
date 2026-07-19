'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
  className?: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  pageSize?: number;
  enablePagination?: boolean;
  enableSorting?: boolean;
  className?: string;
  stickyHeader?: boolean;
  maxHeight?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyState,
  pageSize = 10,
  enablePagination = true,
  enableSorting = true,
  className,
  stickyHeader = false,
  maxHeight,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [page, setPage] = React.useState(0);

  const sortedData = React.useMemo(() => {
    if (!sortKey || !enableSorting) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortAccessor) return data;
    const accessor = col.sortAccessor;
    return [...data].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir, columns, enableSorting]);

  const totalPages = enablePagination ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages - 1);
  const pagedData = enablePagination
    ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedData;

  const handleSort = (key: string) => {
    if (!enableSorting) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full" data-slot="table">
          <thead data-slot="table-header" className={cn(stickyHeader && 'sticky top-0 z-10')}>
            <tr data-slot="table-row">
              {columns.map((col) => (
                <th
                  key={col.key}
                  data-slot="table-head"
                  className={cn(
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.width && `w-[${col.width}]`,
                    col.sortable && enableSorting && 'cursor-pointer select-none',
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className={cn(
                    'inline-flex items-center gap-1',
                    col.align === 'right' && 'flex-row-reverse',
                  )}>
                    {col.header}
                    {col.sortable && enableSorting && (
                      sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-slot="table-body">
            {pagedData.length === 0 ? (
              <tr data-slot="table-row">
                <td data-slot="table-cell" colSpan={columns.length} className="text-center" style={{ height: '120px' }}>
                  {emptyState ?? <span className="text-muted-foreground text-sm">No results found</span>}
                </td>
              </tr>
            ) : (
              pagedData.map((row) => (
                <tr
                  key={rowKey(row)}
                  data-slot="table-row"
                  className={cn(onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      data-slot="table-cell"
                      className={cn(
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1F1F1F]">
          <p className="text-xs text-muted-foreground tabular">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="h-8 gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground tabular px-2">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="h-8 gap-1"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   TableToolbar — filter input + actions bar
   Visual helper that pairs with DataTable. Renders an .input-slot search
   field on the left and arbitrary action nodes on the right.
   ════════════════════════════════════════════════════════════════════════ */

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1F1F1F]">
      <input
        type="search"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="max-w-xs text-sm"
        data-slot="input"
      />
      <div className="flex items-center gap-2">
        {actions}
      </div>
    </div>
  );
}
