'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Universal Enterprise DataTable
// ═══════════════════════════════════════════════════════════════════════════════
//
// A premium, production-grade table component with:
//   • Sticky header
//   • Hover states
//   • Built-in search
//   • Column sorting (asc/desc/none)
//   • Pagination (page size + page nav)
//   • Skeleton loading rows
//   • Premium empty state
//   • Proper alignment + spacing
//   • No overflow (horizontal scroll for wide tables)
//
// Inspired by Stripe Dashboard / Linear / Vercel tables.
//
// Usage:
//   <DataTable
//     columns={[
//       { key: 'invoiceNumber', header: 'Invoice #', sortable: true, render: (row) => <span className="font-medium">{row.invoiceNumber}</span> },
//       { key: 'client', header: 'Client', sortable: true },
//       { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatINR(row.amount) },
//       { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
//     ]}
//     data={invoices}
//     searchable={true}
//     searchPlaceholder="Search invoices..."
//     pageSize={10}
//     loading={isLoading}
//     emptyTitle="No invoices yet"
//     emptyDescription="Create your first invoice to get started."
//     emptyAction={<Button>Create Invoice</Button>}
//   />
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, type ReactNode } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  /** Unique key for this column. Used as React key + sort field. */
  key: string;
  /** Header label. */
  header: string;
  /** Whether this column is sortable. Default: false. */
  sortable?: boolean;
  /** Alignment: 'left' (default), 'center', 'right'. */
  align?: 'left' | 'center' | 'right';
  /** Optional width, e.g. '120px' or '20%'. */
  width?: string;
  /**
   * Custom cell renderer. Receives the full row.
   * If omitted, renders `row[key]` as plain text.
   */
  render?: (row: T) => ReactNode;
  /**
   * Sort accessor — extracts a comparable value from the row.
   * Defaults to `row[key]`.
   */
  sortAccessor?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Row key accessor — must return a unique string per row. */
  getRowId: (row: T) => string;
  /** Enable the search input. Default: true. */
  searchable?: boolean;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Which fields to search. If omitted, searches all string fields. */
  searchKeys?: (keyof T)[];
  /** Page size for pagination. Default: 10. Set to 0 to disable pagination. */
  pageSize?: number;
  /** Show loading skeleton rows. */
  loading?: boolean;
  /** Number of skeleton rows to show. Default: 5. */
  loadingRows?: number;
  /** Empty state configuration. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  /** Optional toolbar actions (e.g. filters, export button). */
  toolbarActions?: ReactNode;
  /** Optional onRowClick handler. */
  onRowClick?: (row: T) => void;
  /** Optional className for the wrapper. */
  className?: string;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowId,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchKeys,
  pageSize = 10,
  loading = false,
  loadingRows = 5,
  emptyTitle = 'No data found',
  emptyDescription = 'Try adjusting your search or filters.',
  emptyIcon,
  emptyAction,
  toolbarActions,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  // ── Filter ──
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase().trim();
    return data.filter((row) => {
      const keys = searchKeys ?? (Object.keys(row) as (keyof T)[]);
      return keys.some((k) => {
        const v = row[k];
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
  }, [data, search, searchKeys]);

  // ── Sort ──
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const accessor = col.sortAccessor ?? ((row: T) => row[sort.key] as string | number);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, columns]);

  // ── Paginate ──
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages - 1);
  const paged = pageSize > 0 ? sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : sorted;

  // ── Sort toggle ──
  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null; // third click clears sort
    });
  };

  // ── Alignment helper ──
  const alignClass = (align?: string) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div className={`w-full ${className}`}>
      {/* ── Toolbar: Search + Actions ── */}
      {(searchable || toolbarActions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="h-9 pl-9 pr-3 text-sm"
              />
            </div>
          )}
          {toolbarActions && (
            <div className="flex items-center gap-2">{toolbarActions}</div>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div className="gst-table-wrap">
        <table className="gst-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${alignClass(col.align)} ${col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {col.header}
                    {col.sortable && (
                      <span className="ml-0.5 inline-flex">
                        {sort?.key === col.key ? (
                          sort.dir === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5 text-[#3B82F6]" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-[#3B82F6]" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {loading ? (
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} className={alignClass(col.align)}>
                      <Skeleton className="h-5 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={columns.length} className="!border-b-0 !p-0">
                  <div className="gst-empty-state">
                    <div className="gst-empty-state-icon">
                      {emptyIcon ?? <Inbox className="h-7 w-7 text-muted-foreground" />}
                    </div>
                    <h3 className="gst-empty-state-title">{emptyTitle}</h3>
                    <p className="gst-empty-state-desc">{emptyDescription}</p>
                    {emptyAction && <div className="flex items-center gap-2">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              /* Data rows */
              paged.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={alignClass(col.align)}>
                      {col.render ? col.render(row) : (row[col.key] as ReactNode) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pageSize > 0 && !loading && sorted.length > pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <p className="gst-caption">
            Showing{' '}
            <span className="font-medium text-foreground tabular-nums">
              {currentPage * pageSize + 1}
            </span>
            {'–'}
            <span className="font-medium text-foreground tabular-nums">
              {Math.min((currentPage + 1) * pageSize, sorted.length)}
            </span>{' '}
            of <span className="font-medium text-foreground tabular-nums">{sorted.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
