'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — ZohoLatestRecords
// ═══════════════════════════════════════════════════════════════════════════════
//
// 3-tab compact table — Latest Invoices / Latest Customers / Latest Payments.
//
// RULE 9: Pulls from LOCAL Prisma APIs (invoices, clients, banking
// transactions) but ONLY when `syncedEntities.{invoice|customer|payment} > 0`,
// and labels every row "Synced from Zoho Books".
//
// The parent (ZohoConnected) hides this section entirely when no synced data
// exists, so this component can assume at least one tab is enabled.
//
// Tables: sticky headers, zebra rows, hover, compact (text-sm). Standard
// Table component from src/components/ui/table.tsx.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrgId } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import type { ZohoSyncStatusInfo } from '@/hooks/useZohoBooks';

interface ZohoLatestRecordsProps {
  syncStatus: ZohoSyncStatusInfo | null;
}

interface InvoiceRow {
  id: string;
  label: string;
  date: string | null;
  amount: number;
  status: string;
}

interface CustomerRow {
  id: string;
  label: string;
  date: string | null;
  amount: number;
  status: string;
}

interface PaymentRow {
  id: string;
  label: string;
  date: string | null;
  amount: number;
  status: string;
}

function formatINR(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusPill(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'completed' || s === 'success' || s === 'active') {
    return (
      <Badge variant="outline" className="border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#60A5FA]">
        Paid
      </Badge>
    );
  }
  if (s === 'pending' || s === 'processing' || s === 'partial') {
    return (
      <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-400">
        Pending
      </Badge>
    );
  }
  if (s === 'overdue' || s === 'failed' || s === 'inactive') {
    return (
      <Badge variant="outline" className="border-red-400/30 bg-red-400/10 text-red-400">
        {s === 'overdue' ? 'Overdue' : s === 'failed' ? 'Failed' : 'Inactive'}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-muted-foreground">
      {status || '—'}
    </Badge>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function CompactTable({
  headers,
  rows,
  loading,
}: {
  headers: string[];
  rows: Array<{ id: string; cells: React.ReactNode[] }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 px-2 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No records synced yet. Click &ldquo;Sync Now&rdquo; to pull data from
        Zoho Books.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/[0.06] hover:bg-transparent">
          {headers.map((h, i) => (
            <TableHead
              key={h}
              className={`text-xs font-medium uppercase tracking-wider text-muted-foreground ${
                i === 0 ? 'text-left' : i === headers.length - 1 ? 'text-right' : 'text-left'
              }`}
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow
            key={row.id}
            className={`border-white/[0.04] ${
              idx % 2 === 1 ? 'bg-white/[0.01]' : ''
            } hover:bg-white/[0.03]`}
          >
            {row.cells.map((cell, i) => (
              <TableCell
                key={i}
                className={`py-2.5 text-sm ${
                  i === 0 ? 'text-left font-medium text-foreground' : i === row.cells.length - 1 ? 'text-right' : 'text-left text-muted-foreground'
                }`}
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ZohoLatestRecords({ syncStatus }: ZohoLatestRecordsProps) {
  const orgId = useCurrentOrgId();
  const { user } = useAuth();

  // Decide which tabs are enabled based on synced counts.
  const recordsImported = syncStatus?.recordsImported ?? {};
  const hasInvoices = (recordsImported.invoice ?? 0) > 0;
  const hasCustomers = (recordsImported.customer ?? 0) > 0;
  const hasPayments = (recordsImported.payment ?? 0) > 0;

  // Default tab: first one with data, fallback to invoices.
  const defaultTab = hasInvoices ? 'invoices' : hasCustomers ? 'customers' : hasPayments ? 'payments' : 'invoices';

  const [activeTab, setActiveTab] = useState<'invoices' | 'customers' | 'payments'>(defaultTab);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Actor header (uid/email) — same pattern as useInvoicesApi/useBankingApi.
  const actorHeader = useMemo(
    () =>
      JSON.stringify({
        uid: user?.id ?? 'local-user',
        email: user?.email ?? 'local@gstpilot.dev',
      }),
    [user?.id, user?.email],
  );

  // Fetch invoices
  useEffect(() => {
    if (!orgId || !hasInvoices) {
      setInvoices([]);
      return;
    }
    let cancelled = false;
    setLoadingInvoices(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/invoices?cloud=true&organizationId=${encodeURIComponent(orgId)}`,
          {
            cache: 'no-store',
            headers: {
              'x-gstpilot-actor': actorHeader,
              'x-gstpilot-orgid': orgId,
            },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { invoices?: Array<Record<string, unknown>> };
        if (cancelled) return;
        const rows: InvoiceRow[] = (json.invoices ?? []).slice(0, 5).map((inv) => ({
          id: String(inv.id ?? ''),
          label: String(inv.invoiceNumber ?? inv.buyerName ?? 'Invoice'),
          date: (inv.invoiceDate as string | null) ?? (inv.createdAt as string | null),
          amount: Number(inv.totalAmount ?? 0),
          status: String(inv.paymentStatus ?? inv.status ?? 'sent'),
        }));
        setInvoices(rows);
      } catch {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, hasInvoices, actorHeader]);

  // Fetch customers
  useEffect(() => {
    if (!orgId || !hasCustomers) {
      setCustomers([]);
      return;
    }
    let cancelled = false;
    setLoadingCustomers(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/clients?organizationId=${encodeURIComponent(orgId)}`,
          {
            cache: 'no-store',
            headers: { 'x-gstpilot-actor': actorHeader },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { clients?: Array<Record<string, unknown>> };
        if (cancelled) return;
        const rows: CustomerRow[] = (json.clients ?? []).slice(0, 5).map((c) => ({
          id: String(c.id ?? ''),
          label: String(c.tradeName ?? c.legalName ?? 'Customer'),
          date: (c.createdAt as string | null) ?? null,
          amount: Number(c.healthScore ?? 0),
          status: String(c.status ?? 'active'),
        }));
        setCustomers(rows);
      } catch {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoadingCustomers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, hasCustomers, actorHeader]);

  // Fetch payments (banking transactions)
  useEffect(() => {
    if (!orgId || !hasPayments) {
      setPayments([]);
      return;
    }
    let cancelled = false;
    setLoadingPayments(true);
    (async () => {
      try {
        const params = new URLSearchParams({
          organizationId: orgId,
          limit: '5',
        });
        const res = await fetch(
          `/api/banking/transactions?${params.toString()}`,
          {
            cache: 'no-store',
            headers: { 'x-gstpilot-actor': actorHeader },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { transactions?: Array<Record<string, unknown>> };
        if (cancelled) return;
        const rows: PaymentRow[] = (json.transactions ?? []).slice(0, 5).map((t) => ({
          id: String(t.id ?? ''),
          label: String(t.description ?? t.merchantName ?? 'Payment'),
          date: (t.transactionDate as string | null) ?? (t.date as string | null) ?? null,
          amount: Number(t.amount ?? 0),
          status: String(t.status ?? 'completed'),
        }));
        setPayments(rows);
      } catch {
        if (!cancelled) setPayments([]);
      } finally {
        if (!cancelled) setLoadingPayments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, hasPayments, actorHeader]);

  const invoiceRows = useMemo(
    () =>
      invoices.map((inv) => ({
        id: inv.id,
        cells: [
          inv.label,
          formatDate(inv.date),
          formatINR(inv.amount),
          statusPill(inv.status),
        ],
      })),
    [invoices],
  );

  const customerRows = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        cells: [
          c.label,
          formatDate(c.date),
          c.amount > 0 ? `${c.amount}/100` : '—',
          statusPill(c.status),
        ],
      })),
    [customers],
  );

  const paymentRows = useMemo(
    () =>
      payments.map((p) => ({
        id: p.id,
        cells: [
          p.label,
          formatDate(p.date),
          formatINR(p.amount),
          statusPill(p.status),
        ],
      })),
    [payments],
  );

  return (
    <section
      aria-label="Latest synced records"
      className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
            Latest Synced Records
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pulled from your local VEYRO database · labeled as synced from
            Zoho Books
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as 'invoices' | 'customers' | 'payments')
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="invoices" disabled={!hasInvoices}>
            Latest Invoices
          </TabsTrigger>
          <TabsTrigger value="customers" disabled={!hasCustomers}>
            Latest Customers
          </TabsTrigger>
          <TabsTrigger value="payments" disabled={!hasPayments}>
            Latest Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <CompactTable
            headers={['Invoice', 'Date', 'Amount', 'Status']}
            rows={invoiceRows}
            loading={loadingInvoices}
          />
        </TabsContent>
        <TabsContent value="customers">
          <CompactTable
            headers={['Customer', 'Added', 'Health', 'Status']}
            rows={customerRows}
            loading={loadingCustomers}
          />
        </TabsContent>
        <TabsContent value="payments">
          <CompactTable
            headers={['Description', 'Date', 'Amount', 'Status']}
            rows={paymentRows}
            loading={loadingPayments}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

export default ZohoLatestRecords;
