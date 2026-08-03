'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Invoice Workspace (Billion-Dollar Enterprise Edition)
//
// A production-grade invoicing surface comparable to Zoho Books / TallyPrime /
// QuickBooks. Composed entirely from premium sub-components:
//
//   • InvoiceKpiCards        — 7 KPI cards with sparklines + trends
//   • InvoiceFilters         — debounced search + filter presets + advanced
//   • InvoiceTable           — sortable sticky table with bulk + per-row actions
//   • InvoicePagination      — 10/25/50/100 paging
//   • InvoiceBuilder         — premium Create/Edit dialog with smart GST items
//   • InvoiceA4Preview       — A4 paper preview (used inside the details Sheet)
//   • InvoiceDetailsSheet    — slide-over with Overview/Items/GST/Payments/Preview/History
//   • InvoiceOraclePanel     — Oracle AI insights (payment prediction, risk, fixes)
//   • InvoiceSkeletons       — premium shimmer
//   • InvoiceEmptyState      — beautiful onboarding empty state
//   • InvoiceErrorState      — never exposes raw backend errors
//
// All data flows through `useInvoicesApi()` + `useClientsApi()` (Prisma REST).
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Sparkles,
  RefreshCw,
  FileText,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useOrg } from '@/contexts/OrgContext';
import {
  useInvoicesApi,
  type ApiInvoice,
} from '@/hooks/useInvoicesApi';
import { useClientsApi } from '@/hooks/useClientsApi';
import { AskOracleButton } from '@/components/oracle/AskOracleButton';
import { formatCurrency } from '@/lib/gst-utils';

// Sub-components
import { InvoiceKpiCards, computeInvoiceKpis } from './InvoiceKpiCards';
import {
  InvoiceFilters,
  DEFAULT_FILTERS,
  type InvoiceFiltersState,
} from './InvoiceFilters';
import {
  InvoiceTable,
  InvoicePagination,
  type SortState,
} from './InvoiceTable';
import { InvoiceBuilder } from './InvoiceBuilder';
import { InvoiceDetailsSheet } from './InvoiceDetailsSheet';
import { InvoiceOraclePanel } from './InvoiceOraclePanel';
import {
  InvoiceWorkspaceSkeleton,
  OraclePanelSkeleton,
} from './InvoiceSkeletons';
import { InvoiceEmptyState, InvoiceErrorState } from './InvoiceEmptyErrorStates';

// ─── Animation ────────────────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyFilters(
  invoices: ApiInvoice[],
  filters: InvoiceFiltersState,
  clientMap: Map<string, { tradeName: string; gstin: string }>,
): ApiInvoice[] {
  const q = filters.search.trim().toLowerCase();
  return invoices.filter((inv) => {
    // Search across invoice #, client, GSTIN, amount, date, notes
    if (q) {
      const client = clientMap.get(inv.clientId);
      const haystack = [
        inv.invoiceNumber,
        inv.buyerName,
        inv.buyerGstin,
        inv.sellerGstin,
        client?.tradeName,
        client?.gstin,
        inv.invoiceDate,
        inv.dueDate,
        inv.status,
        inv.paymentStatus,
        String(inv.totalAmount ?? ''),
        String(inv.taxableValue ?? ''),
        String(inv.gstAmount ?? ''),
        inv.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.status !== 'all') {
      if (inv.status !== filters.status) return false;
    }
    if (filters.paymentStatus !== 'all') {
      if (inv.paymentStatus !== filters.paymentStatus) return false;
    }
    if (filters.clientId !== 'all') {
      if (inv.clientId !== filters.clientId) return false;
    }
    if (filters.gstRate !== 'all') {
      // We don't have a direct gstRate on the invoice, so derive from amounts.
      // taxRate ≈ gstAmount / taxableValue * 100
      const taxable = inv.taxableValue ?? 0;
      const gst = inv.gstAmount ?? 0;
      const rate = taxable > 0 ? Math.round((gst / taxable) * 100) : 0;
      if (String(rate) !== filters.gstRate) return false;
    }
    if (filters.risk !== 'all') {
      if (inv.riskLevel !== filters.risk) return false;
    }
    if (filters.dateFrom) {
      const d = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date(inv.createdAt);
      if (d < new Date(filters.dateFrom)) return false;
    }
    if (filters.dateTo) {
      const d = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date(inv.createdAt);
      if (d > new Date(filters.dateTo + 'T23:59:59')) return false;
    }
    if (filters.amountMin) {
      if ((inv.totalAmount ?? 0) < Number(filters.amountMin)) return false;
    }
    if (filters.amountMax) {
      if ((inv.totalAmount ?? 0) > Number(filters.amountMax)) return false;
    }
    return true;
  });
}

function sortInvoices(
  invoices: ApiInvoice[],
  sort: SortState,
  clientMap: Map<string, { tradeName: string; gstin: string }>,
): ApiInvoice[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const sorted = [...invoices].sort((a, b) => {
    switch (sort.key) {
      case 'invoiceNumber':
        return (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '', undefined, { numeric: true }) * dir;
      case 'client': {
        const na = clientMap.get(a.clientId)?.tradeName ?? a.buyerName ?? '';
        const nb = clientMap.get(b.clientId)?.tradeName ?? b.buyerName ?? '';
        return na.localeCompare(nb) * dir;
      }
      case 'buyerGstin':
        return (a.buyerGstin ?? '').localeCompare(b.buyerGstin ?? '') * dir;
      case 'invoiceDate': {
        const da = a.invoiceDate ? new Date(a.invoiceDate).getTime() : new Date(a.createdAt).getTime();
        const db = b.invoiceDate ? new Date(b.invoiceDate).getTime() : new Date(b.createdAt).getTime();
        return (da - db) * dir;
      }
      case 'dueDate': {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return (da - db) * dir;
      }
      case 'taxableValue':
        return ((a.taxableValue ?? 0) - (b.taxableValue ?? 0)) * dir;
      case 'gstAmount':
        return ((a.gstAmount ?? 0) - (b.gstAmount ?? 0)) * dir;
      case 'totalAmount':
        return ((a.totalAmount ?? 0) - (b.totalAmount ?? 0)) * dir;
      case 'status':
        return (a.status ?? '').localeCompare(b.status ?? '') * dir;
      case 'paymentStatus':
        return (a.paymentStatus ?? '').localeCompare(b.paymentStatus ?? '') * dir;
      case 'riskLevel':
        return (a.riskLevel ?? '').localeCompare(b.riskLevel ?? '') * dir;
      default:
        return 0;
    }
  });
  return sorted;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceWorkspacePage() {
  const { setCurrentView } = useApp();
  const { organization } = useOrg();

  // ── Data hooks ──
  const {
    invoices,
    loading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markPaid,
    duplicateInvoice,
    fetchInsights,
    sendInvoice,
    generatePdf,
    saving,
  } = useInvoicesApi();

  const {
    clients,
    loading: clientsLoading,
    refetch: refetchClients,
  } = useClientsApi();

  // ── Client map ──
  const clientMap = useMemo(() => {
    const m = new Map<string, { tradeName: string; gstin: string }>();
    for (const c of clients) {
      m.set(c.id, { tradeName: c.tradeName, gstin: c.gstin });
    }
    return m;
  }, [clients]);

  // ── Filters + sort + search (debounced) ──
  const [filters, setFilters] = useState<InvoiceFiltersState>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'invoiceDate', dir: 'desc' });

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 250);
    return () => clearTimeout(t);
  }, [filters.search]);

  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  // ── Filtered + sorted invoices ──
  const filteredInvoices = useMemo(
    () => applyFilters(invoices, effectiveFilters, clientMap),
    [invoices, effectiveFilters, clientMap],
  );

  const sortedInvoices = useMemo(
    () => sortInvoices(filteredInvoices, sort, clientMap),
    [filteredInvoices, sort, clientMap],
  );

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [effectiveFilters]);

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, page, pageSize]);

  // ── KPIs ──
  const kpis = useMemo(() => computeInvoiceKpis(invoices), [invoices]);

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [effectiveFilters]);

  // ── Details Sheet ──
  const [detailsInvoice, setDetailsInvoice] = useState<ApiInvoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleRowClick = useCallback((inv: ApiInvoice) => {
    setDetailsInvoice(inv);
    setDetailsOpen(true);
  }, []);

  // ── Builder Dialog ──
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<ApiInvoice | null>(null);

  const handleOpenCreate = useCallback(() => {
    setEditInvoice(null);
    setBuilderOpen(true);
  }, []);

  const handleOpenEdit = useCallback((inv: ApiInvoice) => {
    setEditInvoice(inv);
    setBuilderOpen(true);
    setDetailsOpen(false);
  }, []);

  // ── Builder submit ──
  const handleBuilderSubmit = useCallback(
    async (payload: Record<string, unknown>) => {
      const isEdit = Boolean(editInvoice);
      const status = (payload.status as 'draft' | 'sent') ?? 'draft';
      try {
        if (isEdit && editInvoice) {
          // Edit: PATCH
          await updateInvoice(editInvoice.id, {
            clientId: payload.clientId,
            buyerGstin: payload.buyerGstin,
            buyerName: payload.customerName,
            invoiceDate: payload.date,
            dueDate: payload.dueDate,
            invoiceNumber: payload.invoiceNumber,
            invoiceType: payload.invoiceType,
            notes: payload.notes,
            notesFinance: payload.notesFinance,
            items: payload.items,
            status: status === 'sent' ? 'sent' : undefined,
          });
          toast.success('Invoice updated');
        } else {
          // Create: POST
          await createInvoice({
            cloud: true,
            clientId: payload.clientId as string | undefined,
            customerName: payload.customerName as string,
            buyerGstin: payload.buyerGstin as string | undefined,
            sellerGstin: payload.sellerGstin as string | undefined,
            date: payload.date as string | undefined,
            dueDate: payload.dueDate as string | undefined,
            items: (payload.items as Array<Record<string, unknown>>)?.map((it) => ({
              description: (it.description as string) ?? '',
              hsnCode: (it.hsnCode as string) ?? undefined,
              quantity: Number(it.quantity ?? 1),
              unitPrice: Number(it.unitPrice ?? 0),
              gstRate: Number(it.gstRate ?? 0),
            })),
            notes: payload.notes as string | undefined,
          });
          toast.success(status === 'sent' ? 'Invoice created & sent' : 'Invoice created');
        }
        setBuilderOpen(false);
        setEditInvoice(null);
        refetchInvoices();
      } catch (err) {
        console.error('[InvoiceWorkspacePage] builder submit failed:', err);
        toast.error('Unable to save this invoice. Please try again.');
      }
    },
    [editInvoice, createInvoice, updateInvoice, refetchInvoices],
  );

  // ── Per-row actions ──
  const handleAction = useCallback(
    async (action: string, inv: ApiInvoice) => {
      switch (action) {
        case 'view':
          setDetailsInvoice(inv);
          setDetailsOpen(true);
          break;
        case 'edit':
          handleOpenEdit(inv);
          break;
        case 'send': {
          const ok = await sendInvoice(inv.id, 'email');
          if (ok) {
            toast.success(`Invoice ${inv.invoiceNumber} sent via email`);
            refetchInvoices();
          } else {
            toast.error('Unable to send invoice');
          }
          break;
        }
        case 'send-whatsapp': {
          const ok = await sendInvoice(inv.id, 'whatsapp');
          if (ok) {
            toast.success(`Invoice ${inv.invoiceNumber} sent via WhatsApp`);
            refetchInvoices();
          } else {
            toast.error('Unable to send invoice');
          }
          break;
        }
        case 'mark-paid': {
          const ok = await markPaid(inv.id);
          if (ok) {
            toast.success(`Invoice ${inv.invoiceNumber} marked as paid`);
            refetchInvoices();
          } else {
            toast.error('Unable to mark invoice as paid');
          }
          break;
        }
        case 'duplicate': {
          const ok = await duplicateInvoice(inv.id);
          if (ok) {
            toast.success('Invoice duplicated');
            refetchInvoices();
          } else {
            toast.error('Unable to duplicate invoice');
          }
          break;
        }
        case 'pdf': {
          const result = await generatePdf(inv.id);
          if (result?.html) {
            // Open the HTML in a new window for print/save as PDF.
            const w = window.open('', '_blank', 'width=800,height=900');
            if (w) {
              w.document.write(result.html);
              w.document.close();
              setTimeout(() => w.print(), 500);
            }
            toast.success('PDF generated');
          } else {
            toast.error('Unable to generate PDF');
          }
          break;
        }
        case 'print': {
          // Use the same PDF HTML generation for print.
          const result = await generatePdf(inv.id);
          if (result?.html) {
            const w = window.open('', '_blank', 'width=800,height=900');
            if (w) {
              w.document.write(result.html);
              w.document.close();
              setTimeout(() => w.print(), 500);
            }
          } else {
            toast.error('Unable to print invoice');
          }
          break;
        }
        case 'archive': {
          const ok = await updateInvoice(inv.id, { status: 'archived' });
          if (ok) {
            toast.success('Invoice archived');
            refetchInvoices();
          }
          break;
        }
        case 'delete': {
          if (!window.confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) {
            break;
          }
          const ok = await deleteInvoice(inv.id);
          if (ok) {
            toast.success('Invoice deleted');
            if (detailsInvoice?.id === inv.id) {
              setDetailsOpen(false);
            }
            refetchInvoices();
          } else {
            toast.error('Unable to delete invoice');
          }
          break;
        }
        default:
          console.warn('[InvoiceWorkspacePage] unknown action:', action);
      }
    },
    [sendInvoice, markPaid, duplicateInvoice, generatePdf, updateInvoice, deleteInvoice, refetchInvoices, detailsInvoice, handleOpenEdit],
  );

  // ── Bulk actions ──
  const handleBulkAction = useCallback(
    async (action: string) => {
      if (selectedIds.size === 0) return;
      const ids = Array.from(selectedIds);
      let successCount = 0;
      let failCount = 0;

      for (const id of ids) {
        try {
          if (action === 'send') {
            const ok = await sendInvoice(id, 'email');
            if (ok) successCount++;
            else failCount++;
          } else if (action === 'mark-paid') {
            const ok = await markPaid(id);
            if (ok) successCount++;
            else failCount++;
          } else if (action === 'archive') {
            const ok = await updateInvoice(id, { status: 'archived' });
            if (ok) successCount++;
            else failCount++;
          } else if (action === 'delete') {
            const ok = await deleteInvoice(id);
            if (ok) successCount++;
            else failCount++;
          } else if (action === 'pdf') {
            const inv = invoices.find((i) => i.id === id);
            if (inv) {
              const result = await generatePdf(id);
              if (result?.html) {
                const w = window.open('', '_blank');
                if (w) {
                  w.document.write(result.html);
                  w.document.close();
                }
                successCount++;
              } else {
                failCount++;
              }
            }
          }
        } catch {
          failCount++;
        }
      }

      if (action === 'export-csv') {
        handleExportCsv(invoices.filter((i) => selectedIds.has(i.id)));
        return;
      }

      toast.success(
        `${successCount} invoice${successCount !== 1 ? 's' : ''} ${action === 'delete' ? 'deleted' : 'updated'}${
          failCount > 0 ? `, ${failCount} failed` : ''
        }`,
      );
      setSelectedIds(new Set());
      refetchInvoices();
    },
    [selectedIds, sendInvoice, markPaid, updateInvoice, deleteInvoice, generatePdf, invoices, refetchInvoices],
  );

  // ── Export CSV ──
  const handleExportCsv = useCallback((invList: ApiInvoice[]) => {
    const headers = [
      'Invoice #',
      'Client',
      'GSTIN',
      'Date',
      'Due Date',
      'Taxable',
      'CGST',
      'SGST',
      'IGST',
      'CESS',
      'Total',
      'Status',
      'Payment',
      'Risk',
    ];
    const rows = invList.map((inv) => [
      inv.invoiceNumber,
      clientMap.get(inv.clientId)?.tradeName ?? inv.buyerName ?? '',
      inv.buyerGstin ?? '',
      inv.invoiceDate ?? '',
      inv.dueDate ?? '',
      inv.taxableValue ?? 0,
      inv.cgst ?? 0,
      inv.sgst ?? 0,
      inv.igst ?? 0,
      inv.cess ?? 0,
      inv.totalAmount ?? 0,
      inv.status,
      inv.paymentStatus,
      inv.riskLevel,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gstpilot-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${invList.length} invoice${invList.length !== 1 ? 's' : ''} to CSV`);
  }, [clientMap]);

  // ── Oracle one-click fix handler ──
  const handleOracleFix = useCallback(
    async (
      _fixId: string,
      endpoint: string,
      method: 'POST' | 'PATCH',
      body: Record<string, unknown>,
    ) => {
      try {
        const url = endpoint.startsWith('/api/')
          ? endpoint
          : `/api/invoices/${endpoint}`;
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        toast.success('Oracle fix applied successfully');
        refetchInvoices();
      } catch (err) {
        console.error('[Oracle fix] failed:', err);
        toast.error('Unable to apply this fix. Please try again.');
      }
    },
    [refetchInvoices],
  );

  // ── Loading state ──
  const isLoading = invoicesLoading || clientsLoading;

  // ── Determine the selected invoice for the Oracle panel ──
  const oracleInvoiceId = detailsInvoice?.id ?? null;

  // ── Selected client for the details sheet ──
  const detailsClient = detailsInvoice
    ? clients.find((c) => c.id === detailsInvoice.clientId) ?? null
    : null;

  // ── Organization info ──
  const orgInfo = organization
    ? { name: organization.name, gstin: organization.gstin ?? '', address: undefined as string | undefined }
    : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col bg-black text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/[0.06]">
        <div className="px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 ring-1 ring-emerald-400/20">
              <FileText className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-semibold tracking-tight text-foreground truncate">
                Invoices
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                {invoices.length} total · {kpis.paid} paid · {kpis.outstanding > 0 ? `${formatCurrency(kpis.outstanding)} outstanding` : 'all settled'}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <AskOracleButton context="invoices" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchInvoices();
                refetchClients();
              }}
              className="h-9 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-foreground"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden md:inline ml-1.5">Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="h-9 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20 font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">New Invoice</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* Left column: KPIs + Filters + Table */}
          <div className="space-y-4 md:space-y-6 min-w-0">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div key="loading" {...fadeInUp}>
                  <InvoiceWorkspaceSkeleton />
                </motion.div>
              ) : invoicesError ? (
                <motion.div key="error" {...fadeInUp}>
                  <InvoiceErrorState
                    message={invoicesError}
                    onRetry={() => {
                      refetchInvoices();
                      refetchClients();
                    }}
                    onGoBack={() => setCurrentView('dashboard')}
                  />
                </motion.div>
              ) : invoices.length === 0 ? (
                <motion.div key="empty" {...fadeInUp}>
                  <InvoiceEmptyState
                    onCreate={handleOpenCreate}
                    onImport={() => toast.info('Import coming soon — use the Create dialog for now.')}
                    onConnectZoho={() => toast.info('Zoho Books sync is available in Settings → Integrations.')}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  {...fadeInUp}
                  className="space-y-4 md:space-y-6 min-w-0"
                >
                  {/* KPI Cards */}
                  <InvoiceKpiCards kpis={kpis} />

                  {/* Filters */}
                  <InvoiceFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    clients={clients}
                    totalInvoices={invoices.length}
                    filteredCount={filteredInvoices.length}
                    selectedCount={selectedIds.size}
                  />

                  {/* Table or Filtered Empty State */}
                  {filteredInvoices.length === 0 ? (
                    <InvoiceEmptyState
                      onCreate={handleOpenCreate}
                      hasFilters
                      onClearFilters={() => setFilters({ ...DEFAULT_FILTERS })}
                    />
                  ) : (
                    <>
                      <InvoiceTable
                        invoices={paginatedInvoices}
                        clients={clients}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        onRowClick={handleRowClick}
                        onAction={handleAction}
                        onBulkAction={handleBulkAction}
                        sort={sort}
                        onSortChange={setSort}
                        searchQuery={debouncedSearch}
                        saving={saving}
                      />

                      <InvoicePagination
                        page={page}
                        pageSize={pageSize}
                        total={sortedInvoices.length}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                      />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column: Oracle AI panel (sticky on desktop) */}
          <aside className="hidden xl:block">
            <div className="sticky top-20 space-y-4">
              {isLoading ? (
                <OraclePanelSkeleton />
              ) : invoices.length === 0 ? null : (
                <InvoiceOraclePanel
                  invoiceId={oracleInvoiceId}
                  fetchInsights={fetchInsights}
                  onOneClickFix={handleOracleFix}
                />
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-emerald-400" />
            <span>Powered by GSTPilot Infinity™ · Oracle AI™ insights</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="hover:text-foreground transition-colors"
            >
              Dashboard
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button
              onClick={() => setCurrentView('returns')}
              className="hover:text-foreground transition-colors"
            >
              Returns
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button
              onClick={() => setCurrentView('settings')}
              className="hover:text-foreground transition-colors"
            >
              Settings
            </button>
          </div>
        </div>
      </footer>

      {/* ── Details Sheet (slide-over) ── */}
      <InvoiceDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        invoice={detailsInvoice}
        client={detailsClient}
        organization={orgInfo}
        onEdit={() => detailsInvoice && handleOpenEdit(detailsInvoice)}
        onSendEmail={() => detailsInvoice && handleAction('send', detailsInvoice)}
        onMarkPaid={() => detailsInvoice && handleAction('mark-paid', detailsInvoice)}
        onDuplicate={() => detailsInvoice && handleAction('duplicate', detailsInvoice)}
        onPrint={() => detailsInvoice && handleAction('print', detailsInvoice)}
        onDownloadPdf={() => detailsInvoice && handleAction('pdf', detailsInvoice)}
        onShare={() => {
          if (!detailsInvoice) return;
          const url = `${window.location.origin}/api/invoices/${detailsInvoice.id}/insights`;
          if (navigator.share) {
            navigator.share({ title: `Invoice ${detailsInvoice.invoiceNumber}`, url }).catch(() => {});
          } else {
            navigator.clipboard?.writeText(url);
            toast.success('Invoice link copied to clipboard');
          }
        }}
        onArchive={() => detailsInvoice && handleAction('archive', detailsInvoice)}
        onDelete={() => detailsInvoice && handleAction('delete', detailsInvoice)}
        fetchInsights={fetchInsights}
        saving={saving}
      />

      {/* ── Builder Dialog ── */}
      <InvoiceBuilder
        open={builderOpen}
        onOpenChange={(open) => {
          setBuilderOpen(open);
          if (!open) setEditInvoice(null);
        }}
        clients={clients}
        initialInvoice={editInvoice}
        organization={orgInfo ? { name: orgInfo.name, gstin: orgInfo.gstin } : null}
        onSubmit={handleBuilderSubmit}
        saving={saving}
        onCreateClient={() => {
          toast.info('Open the Customers module to add a new client.');
          setCurrentView('clients');
        }}
      />
    </div>
  );
}
