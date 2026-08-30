'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — Zoho Books Integration Page
// ═══════════════════════════════════════════════════════════════════════════════
// Full Zoho Books integration UI:
//
//   • Status banner — connected (live) / stale / disconnected / error.
//   • When disconnected: Connect button (disabled until contextReady).
//   • When connected: shows the connected email, last sync, org, scopes, and
//     Disconnect + Refresh Token buttons.
//   • When connected + no org selected: shows an organization picker.
//   • When connected + org selected: shows Customers / Invoices / Bills /
//     Payments tabs backed by REAL Zoho API responses (no mock data).
//   • Uses the existing dark theme (bg-black + text-white + white/[0.04]
//     surfaces) consistent with every other GSTPilot page.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LogOut,
  Receipt,
  RefreshCw,
  Unplug,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useZohoBooks } from '@/hooks/useZohoBooks';
import type {
  ZohoBill,
  ZohoContact,
  ZohoInvoice,
  ZohoOrganization,
  ZohoPayment,
} from '@/hooks/useZohoBooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatMoney(amount: number | undefined, currency: string | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency ?? 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency ?? ''} ${amount.toFixed(2)}`;
  }
}

function formatScope(scope: string | null): string[] {
  if (!scope) return [];
  return scope
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({
  state,
}: {
  state: 'live' | 'stale' | 'disconnected' | 'unknown';
}) {
  const map: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    live: {
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
      label: 'Live',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    stale: {
      icon: <Clock className="h-3.5 w-3.5 text-amber-400" />,
      label: 'Stale',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    },
    disconnected: {
      icon: <Unplug className="h-3.5 w-3.5 text-white/40" />,
      label: 'Disconnected',
      className: 'border-white/10 bg-white/[0.04] text-white/50',
    },
    unknown: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />,
      label: 'Checking…',
      className: 'border-white/10 bg-white/[0.04] text-white/50',
    },
  };
  const s = map[state] ?? map.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${s.className}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ZohoBooksPage() {
  const {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    contextReady,
    connect,
    disconnect,
    refresh,
    pending,
    listOrganizations,
    selectOrganization,
    listCustomers,
    listInvoices,
    listBills,
    listPayments,
  } = useZohoBooks();

  const [connectError, setConnectError] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    const { authUrl, error, notConfigured } = await connect();
    if (authUrl) {
      window.location.href = authUrl;
      return;
    }
    setConnectError(
      error ??
        (notConfigured
          ? 'Zoho Books OAuth is not configured on this server.'
          : 'Could not start the Zoho connect flow.')
    );
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Disconnect Zoho Books? You will need to re-connect to view customers, invoices, bills, and payments again.'
      )
    ) {
      return;
    }
    setDisconnectError(null);
    const { error } = await disconnect();
    if (error) setDisconnectError(error);
  }, [disconnect]);

  const handleRefresh = useCallback(async () => {
    setRefreshError(null);
    const { error } = await refresh();
    if (error) setRefreshError(error);
  }, [refresh]);

  // Detect ?zoho_connected=1 / ?zoho_error= on mount and refresh status.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('zoho_connected');
    const err = url.searchParams.get('zoho_error');
    if (connected === '1' || err) {
      void refreshStatus();
      // Clean the URL so the flag doesn't linger on refresh.
      url.searchParams.delete('zoho_connected');
      url.searchParams.delete('zoho_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [refreshStatus]);

  const isConnected = status?.connected === true && status.state !== 'disconnected';
  const isStale = status?.state === 'stale';
  const hasOrgSelected = Boolean(status?.zohoOrgId);

  // ── Loading shell ─────────────────────────────────────────────────────────
  if (statusLoading && !status) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-black px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          <p className="text-sm text-white/50">Loading Zoho Books…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <BookIcon className="h-5 w-5 text-white/70" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Zoho Books
              </h1>
              <p className="mt-0.5 text-sm text-white/50">
                Connect Zoho Books to sync customers, invoices, bills &amp; payments.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshStatus()}
              disabled={statusLoading || !contextReady}
              className="text-white/60 hover:bg-white/[0.06] hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isConnected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={pending}
                className="text-white/60 hover:bg-white/[0.06] hover:text-white"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh Token
              </Button>
            )}
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={pending}
                className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={!contextReady || pending}
                className="bg-white text-black hover:bg-white/90"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {contextReady ? 'Connect Zoho' : 'Loading workspace…'}
              </Button>
            )}
          </div>
        </header>

        {/* ── Context-not-ready banner ────────────────────────────────────── */}
        {!contextReady && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            Resolving your workspace context — the Connect button is disabled
            until your organization is loaded.
          </div>
        )}

        {/* ── Connect error ───────────────────────────────────────────────── */}
        {connectError && (
          <Banner
            tone="error"
            message={connectError}
            onDismiss={() => setConnectError(null)}
          />
        )}

        {/* ── Disconnect error ────────────────────────────────────────────── */}
        {disconnectError && (
          <Banner
            tone="error"
            message={disconnectError}
            onDismiss={() => setDisconnectError(null)}
          />
        )}

        {/* ── Refresh error ───────────────────────────────────────────────── */}
        {refreshError && (
          <Banner
            tone="error"
            message={refreshError}
            onDismiss={() => setRefreshError(null)}
          />
        )}

        {/* ── Status load error ──────────────────────────────────────────── */}
        {statusError && !status && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{statusError}</div>
          </div>
        )}

        {/* ── Disconnected card ──────────────────────────────────────────── */}
        {!isConnected && (
          <DisconnectedCard
            contextReady={contextReady}
            pending={pending}
            onConnect={handleConnect}
          />
        )}

        {/* ── Connected: status + (org picker | tabs) ───────────────────── */}
        {isConnected && status && (
          <ConnectedPanel
            status={status}
            isStale={isStale}
            hasOrgSelected={hasOrgSelected}
            listOrganizations={listOrganizations}
            selectOrganization={selectOrganization}
            listCustomers={listCustomers}
            listInvoices={listInvoices}
            listBills={listBills}
            listPayments={listPayments}
          />
        )}
      </div>
    </div>
  );
}

// ── Book icon (lucide has BookOpen, but we want a closed book for Books) ──────

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

// ── Banner ──────────────────────────────────────────────────────────────────

function Banner({
  tone,
  message,
  onDismiss,
}: {
  tone: 'error' | 'warning';
  message: string;
  onDismiss?: () => void;
}) {
  const palette =
    tone === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${palette}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ── Disconnected card ──────────────────────────────────────────────────────────

function DisconnectedCard({
  contextReady,
  pending,
  onConnect,
}: {
  contextReady: boolean;
  pending: boolean;
  onConnect: () => void;
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <BookIcon className="h-8 w-8 text-white/40" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-semibold">Connect to Zoho Books</h2>
        <p className="max-w-md text-sm text-white/50">
          Authorize GSTPilot to read your Zoho Books customers, invoices, vendor
          bills, and customer payments. You can disconnect at any time — tokens
          are encrypted and stored server-side only.
        </p>
      </div>
      <Button
        size="lg"
        onClick={onConnect}
        disabled={!contextReady || pending}
        className="bg-white text-black hover:bg-white/90"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {contextReady ? 'Connect Zoho Books' : 'Loading workspace…'}
      </Button>
      <p className="text-xs text-white/30">
        Scope requested: <span className="font-mono">ZohoBooks.fullaccess.all</span>
        {' '}· data center from <span className="font-mono">ZOHO_DC</span> env var.
      </p>
    </section>
  );
}

// ── Connected panel ────────────────────────────────────────────────────────────

function ConnectedPanel({
  status,
  isStale,
  hasOrgSelected,
  listOrganizations,
  selectOrganization,
  listCustomers,
  listInvoices,
  listBills,
  listPayments,
}: {
  status: ReturnType<typeof useZohoBooks>['status'] & {};
  isStale: boolean;
  hasOrgSelected: boolean;
  listOrganizations: () => Promise<{
    data: ZohoOrganization[] | null;
    selectedOrgId: string | null;
    error: string | null;
  }>;
  selectOrganization: (
    orgId: string,
    orgName?: string
  ) => Promise<{ error: string | null }>;
  listCustomers: (max?: number) => Promise<{
    data: ZohoContact[] | null;
    error: string | null;
  }>;
  listInvoices: (max?: number) => Promise<{
    data: ZohoInvoice[] | null;
    error: string | null;
  }>;
  listBills: (max?: number) => Promise<{
    data: ZohoBill[] | null;
    error: string | null;
  }>;
  listPayments: (max?: number) => Promise<{
    data: ZohoPayment[] | null;
    error: string | null;
  }>;
}) {
  const scopes = formatScope(status.scope);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Status card ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill state={status.state} />
          {isStale && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Temporary issue reaching Zoho — try refreshing.
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Connected email" value={status.email ?? '—'} mono />
          <Field label="Zoho org" value={status.zohoOrgName ?? '—'} />
          <Field label="Data center" value={(status.dataCenter ?? '—').toUpperCase()} />
          <Field label="Last sync" value={formatDate(status.updatedAt)} />
          <Field label="Connected since" value={formatDate(status.connectedAt)} />
          <Field label="Token expires" value={formatDate(status.expiryDate)} />
        </div>

        {scopes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-white/40">
              Authorized scopes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {scopes.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-white/60"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Org picker OR tabs ────────────────────────────────────────────── */}
      {!hasOrgSelected ? (
        <OrganizationPicker
          listOrganizations={listOrganizations}
          selectOrganization={selectOrganization}
        />
      ) : (
        <Tabs defaultValue="customers" className="gap-4">
          <TabsList className="bg-white/[0.04] text-white/60">
            <TabsTrigger
              value="customers"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              <Users className="h-3.5 w-3.5" />
              Customers
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              <FileText className="h-3.5 w-3.5" />
              Invoices
            </TabsTrigger>
            <TabsTrigger
              value="bills"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              <Receipt className="h-3.5 w-3.5" />
              Bills
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              <Wallet className="h-3.5 w-3.5" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <CustomersTab listCustomers={listCustomers} />
          </TabsContent>
          <TabsContent value="invoices">
            <InvoicesTab listInvoices={listInvoices} />
          </TabsContent>
          <TabsContent value="bills">
            <BillsTab listBills={listBills} />
          </TabsContent>
          <TabsContent value="payments">
            <PaymentsTab listPayments={listPayments} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-white/40">
        {label}
      </span>
      <span className={`text-sm text-white/80 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ── Organization picker ──────────────────────────────────────────────────────

function OrganizationPicker({
  listOrganizations,
  selectOrganization,
}: {
  listOrganizations: () => Promise<{
    data: ZohoOrganization[] | null;
    selectedOrgId: string | null;
    error: string | null;
  }>;
  selectOrganization: (
    orgId: string,
    orgName?: string
  ) => Promise<{ error: string | null }>;
}) {
  const [organizations, setOrganizations] = useState<ZohoOrganization[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, selectedOrgId, error } = await listOrganizations();
      if (error) setError(error);
      setOrganizations(data);
      setSelectedId(selectedOrgId);
    } finally {
      setLoading(false);
    }
  }, [listOrganizations]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = useCallback(async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const org = organizations?.find((o) => o.organization_id === selectedId);
      const { error } = await selectOrganization(selectedId, org?.name);
      if (error) setError(error);
      // Status refresh on success is handled by the parent (the page calls
      // refreshStatus when the status changes — but here we rely on the
      // hook's internal status update via selectOrganization's status echo).
      // To make sure the parent re-renders with the new org, force a reload
      // of the page state by calling load() again.
      if (!error) {
        // Trigger a window-level reload so the new selected org is reflected
        // in the page header + tab visibility.
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    } finally {
      setSaving(false);
    }
  }, [selectedId, organizations, selectOrganization, load]);

  if (loading && !organizations) return <TabLoading label="Loading organizations…" />;
  if (error && !organizations) return <TabError message={error} onRetry={load} />;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-white/60" />
          <h3 className="text-sm font-semibold text-white/80">
            Select a Zoho Books organization
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-white/50">
        Your Zoho account has access to multiple Books organizations. Pick the
        one you want to sync with GSTPilot. You can change this later.
      </p>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {organizations && organizations.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No Zoho Books organizations found on your account.
        </p>
      )}

      {organizations && organizations.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
            {organizations.map((org) => {
              const isSelected = selectedId === org.organization_id;
              return (
                <li key={org.organization_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(org.organization_id)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${
                      isSelected ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-white/80">
                        {org.name}
                      </span>
                      <span className="truncate text-xs text-white/40">
                        {org.country_name ?? 'Country —'}
                        {org.gst_no ? ` · GST ${org.gst_no}` : ''}
                        {org.currency_code ? ` · ${org.currency_code}` : ''}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {org.is_default_org && (
                        <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
                          Default
                        </span>
                      )}
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-white bg-white'
                            : 'border-white/30 bg-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-black" />
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={handleSelect}
              disabled={!selectedId || saving}
              className="bg-white text-black hover:bg-white/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Use this organization
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Customers tab ────────────────────────────────────────────────────────────

function CustomersTab({
  listCustomers,
}: {
  listCustomers: (max?: number) => Promise<{
    data: ZohoContact[] | null;
    error: string | null;
  }>;
}) {
  const [customers, setCustomers] = useState<ZohoContact[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await listCustomers(50);
      if (error) setError(error);
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, [listCustomers]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !customers) return <TabLoading label="Loading customers…" />;
  if (error && !customers) return <TabError message={error} onRetry={load} />;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Recent customers</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {customers && customers.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No customers found in this Zoho Books organization.
        </p>
      )}

      {customers && customers.length > 0 && (
        <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
          {customers.map((c) => (
            <li
              key={c.contact_id}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-white/80">
                  {c.contact_name}
                </span>
                {c.status && (
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                      c.status === 'active'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/[0.04] text-white/40'
                    }`}
                  >
                    {c.status}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
                {c.email && <span className="truncate">{c.email}</span>}
                {c.currency_code && <span>· {c.currency_code}</span>}
                {c.outstanding_receivable_amount != null &&
                  c.outstanding_receivable_amount > 0 && (
                    <span>
                      · Receivable:{' '}
                      {formatMoney(
                        c.outstanding_receivable_amount,
                        c.currency_code
                      )}
                    </span>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Invoices tab ─────────────────────────────────────────────────────────────

function InvoicesTab({
  listInvoices,
}: {
  listInvoices: (max?: number) => Promise<{
    data: ZohoInvoice[] | null;
    error: string | null;
  }>;
}) {
  const [invoices, setInvoices] = useState<ZohoInvoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await listInvoices(50);
      if (error) setError(error);
      setInvoices(data);
    } finally {
      setLoading(false);
    }
  }, [listInvoices]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !invoices) return <TabLoading label="Loading invoices…" />;
  if (error && !invoices) return <TabError message={error} onRetry={load} />;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Recent invoices</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {invoices && invoices.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No invoices found in this Zoho Books organization.
        </p>
      )}

      {invoices && invoices.length > 0 && (
        <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
          {invoices.map((inv) => (
            <li
              key={inv.invoice_id}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-sm text-white/80">
                  {inv.invoice_number}
                </span>
                <span className="shrink-0 text-xs text-white/40">
                  {formatDateShort(inv.date)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
                <span className="truncate text-white/60">
                  {inv.customer_name ?? '—'}
                </span>
                {inv.status && (
                  <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
                    {inv.status}
                  </span>
                )}
                <span>
                  · {formatMoney(inv.total, inv.currency_code)}
                  {inv.balance != null && inv.balance > 0 && inv.balance !== inv.total
                    ? ` (due ${formatMoney(inv.balance, inv.currency_code)})`
                    : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Bills tab ────────────────────────────────────────────────────────────────

function BillsTab({
  listBills,
}: {
  listBills: (max?: number) => Promise<{
    data: ZohoBill[] | null;
    error: string | null;
  }>;
}) {
  const [bills, setBills] = useState<ZohoBill[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await listBills(50);
      if (error) setError(error);
      setBills(data);
    } finally {
      setLoading(false);
    }
  }, [listBills]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !bills) return <TabLoading label="Loading bills…" />;
  if (error && !bills) return <TabError message={error} onRetry={load} />;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Recent vendor bills</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {bills && bills.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No vendor bills found in this Zoho Books organization.
        </p>
      )}

      {bills && bills.length > 0 && (
        <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
          {bills.map((b) => (
            <li
              key={b.bill_id}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-sm text-white/80">
                  {b.bill_number}
                </span>
                <span className="shrink-0 text-xs text-white/40">
                  {formatDateShort(b.date)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
                <span className="truncate text-white/60">
                  {b.vendor_name ?? '—'}
                </span>
                {b.status && (
                  <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
                    {b.status}
                  </span>
                )}
                <span>
                  · {formatMoney(b.total, b.currency_code)}
                  {b.balance != null && b.balance > 0 && b.balance !== b.total
                    ? ` (due ${formatMoney(b.balance, b.currency_code)})`
                    : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Payments tab ─────────────────────────────────────────────────────────────

function PaymentsTab({
  listPayments,
}: {
  listPayments: (max?: number) => Promise<{
    data: ZohoPayment[] | null;
    error: string | null;
  }>;
}) {
  const [payments, setPayments] = useState<ZohoPayment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await listPayments(50);
      if (error) setError(error);
      setPayments(data);
    } finally {
      setLoading(false);
    }
  }, [listPayments]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalAmount = useMemo(() => {
    if (!payments || payments.length === 0) return null;
    const first = payments[0];
    const currency = first?.currency_code ?? null;
    const sum = payments.reduce(
      (acc, p) => acc + (p.amount ?? 0),
      0
    );
    return { sum, currency };
  }, [payments]);

  if (loading && !payments) return <TabLoading label="Loading payments…" />;
  if (error && !payments) return <TabError message={error} onRetry={load} />;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Recent customer payments</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="text-white/60 hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {totalAmount && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-xs text-white/60">
          Total of {payments?.length ?? 0} recent payments:{' '}
          <span className="font-mono text-white/80">
            {formatMoney(totalAmount.sum, totalAmount.currency ?? undefined)}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {error}
        </div>
      )}

      {payments && payments.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
          No customer payments found in this Zoho Books organization.
        </p>
      )}

      {payments && payments.length > 0 && (
        <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] [scrollbar-width:thin]">
          {payments.map((p) => (
            <li
              key={p.payment_id}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-white/80">
                  {p.customer_name ?? '—'}
                </span>
                <span className="shrink-0 font-mono text-sm text-white/80">
                  {formatMoney(p.amount, p.currency_code)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
                {p.payment_number && (
                  <span className="font-mono">{p.payment_number}</span>
                )}
                {p.payment_mode && <span>· {p.payment_mode}</span>}
                <span>· {formatDateShort(p.date)}</span>
                {p.reference_number && (
                  <span className="truncate">· ref {p.reference_number}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Shared tab states ──────────────────────────────────────────────────────────

function TabLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-sm text-white/50">
      <Loader2 className="h-4 w-4 animate-spin text-white/40" />
      {label}
    </div>
  );
}

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-10 text-center">
      <AlertTriangle className="h-5 w-5 text-red-400" />
      <p className="text-sm text-red-300">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="border-white/10 bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

export default ZohoBooksPage;
