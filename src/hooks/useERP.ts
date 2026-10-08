'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — useERP() Hook
//
// The SINGLE hook every VEYRO component uses to interact with ERP data.
// Mirrors the useBanking() pattern:
//
//   • READ — real-time subscriptions to connections + all 8 entity collections
//     (customers, vendors, invoices, inventory, ledgers, payments, bank
//     transactions, taxes) + sync jobs (org-scoped via onSnapshot)
//   • CONNECT — connect → complete → persist encrypted connection
//   • DISCONNECT — invalidate connection + cascade-delete all ERP data
//   • SYNC — full manual sync (provider returns records, hook persists them)
//   • RETRY — re-subscribe on error
//
// All tenant scoping is automatic — components never touch `organizationId`.
// If the user has no organization yet, every operation no-ops safely.
//
// Architecture:
//   1. Mutations call the API route (/api/erp/*) for provider work (connect,
//      sync, etc.). The API route returns plain data + the encrypted connection.
//      The server-side scheduler persists synced records to Firestore.
//   2. The hook persists the connection doc via the service layer.
//   3. Real-time onSnapshot subscriptions surface the change to every
//      connected client instantly.
//
// Security: the encrypted connection blob is stored in Firestore but can ONLY
// be decrypted by the server (AES-256-GCM with a server-only master key). The
// client passes it opaquely to /api/erp/* routes.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToConnections,
  saveConnection,
  updateConnection,
  cascadeDisconnect,
  subscribeToSyncJobs,
  subscribeToCustomers,
  subscribeToVendors,
  subscribeToInvoices,
  subscribeToInventory,
  subscribeToLedgers,
  subscribeToPayments,
  subscribeToBankTransactions,
  subscribeToTaxes,
  computeERPSummary,
  type ERPConnection,
  type ERPProviderName,
  type ERPSyncJob,
  type ERPSummary,
  type ERPCustomer,
  type ERPVendor,
  type ERPInvoice,
  type ERPInventoryItem,
  type ERPLedger,
  type ERPPayment,
  type ERPBankTransaction,
  type ERPTax,
} from '@/lib/erp-provider';

// ─── Hook return type ────────────────────────────────────────────────────────

export interface UseERPResult {
  /** All of the current org's ERP connections. */
  connections: ERPConnection[];
  /** Recent sync jobs (newest first). */
  syncJobs: ERPSyncJob[];
  /** ERP-synced customers. */
  customers: ERPCustomer[];
  /** ERP-synced vendors. */
  vendors: ERPVendor[];
  /** ERP-synced invoices (sales + purchase). */
  invoices: ERPInvoice[];
  /** ERP-synced inventory items. */
  inventory: ERPInventoryItem[];
  /** ERP-synced ledgers (chart of accounts). */
  ledgers: ERPLedger[];
  /** ERP-synced payments / receipts. */
  payments: ERPPayment[];
  /** ERP-synced bank transactions. */
  bankTransactions: ERPBankTransaction[];
  /** ERP-synced tax summaries. */
  taxes: ERPTax[];
  /** Memoized summary — recomputed when any entity changes. */
  summary: ERPSummary;

  /** Convenience: is there at least one connected ERP? */
  isConnected: boolean;
  /** Convenience: are any sync jobs currently running? */
  isSyncing: boolean;

  loading: boolean;
  error: string | null;
  /** True while any mutation is in-flight. */
  saving: boolean;

  // ─── Mutations ────────────────────────────────────────────────────────────

  /** Connect an ERP. Initiates the provider connect flow + completes it. */
  connect: (input: {
    provider: ERPProviderName;
    companyName: string;
    companyId?: string;
    companyGstin?: string;
    credentials: Record<string, string>;
  }) => Promise<boolean>;
  /** Disconnect an ERP — invalidate + cascade-delete all data. */
  disconnect: (connectionId: string) => Promise<boolean>;
  /** Sync data from the ERP (full manual sync). */
  sync: (connectionId: string) => Promise<boolean>;
  /** Retry the last failed subscription. */
  retry: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useERP(): UseERPResult {
  const { organization, isPreviewMode } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? null;

  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [syncJobs, setSyncJobs] = useState<ERPSyncJob[]>([]);
  const [customers, setCustomers] = useState<ERPCustomer[]>([]);
  const [vendors, setVendors] = useState<ERPVendor[]>([]);
  const [invoices, setInvoices] = useState<ERPInvoice[]>([]);
  const [inventory, setInventory] = useState<ERPInventoryItem[]>([]);
  const [ledgers, setLedgers] = useState<ERPLedger[]>([]);
  const [payments, setPayments] = useState<ERPPayment[]>([]);
  const [bankTransactions, setBankTransactions] = useState<ERPBankTransaction[]>([]);
  const [taxes, setTaxes] = useState<ERPTax[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // Subscription refs (for cleanup)
  const unsubs = useRef<Array<(() => void) | null>>([null, null, null, null, null, null, null, null, null, null]);

  // ─── Real-time subscriptions ──────────────────────────────────────────────

  useEffect(() => {
    unsubs.current.forEach((u) => u?.());
    unsubs.current = unsubs.current.map(() => null);

    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setConnections([]); setSyncJobs([]); setCustomers([]); setVendors([]);
      setInvoices([]); setInventory([]); setLedgers([]); setPayments([]);
      setBankTransactions([]); setTaxes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const onSubError = (err: Error) => {
      console.warn('[useERP] subscription error:', err.message);
      setError(err.message);
      setLoading(false);
    };

    unsubs.current[0] = subscribeToConnections(orgId, (c) => { setConnections(c); setLoading(false); setError(null); }, { onError: onSubError });
    unsubs.current[1] = subscribeToSyncJobs(orgId, (j) => setSyncJobs(j), { onError: onSubError, limitCount: 30 });
    unsubs.current[2] = subscribeToCustomers(orgId, (c) => setCustomers(c), { onError: onSubError, limitCount: 200 });
    unsubs.current[3] = subscribeToVendors(orgId, (v) => setVendors(v), { onError: onSubError, limitCount: 200 });
    unsubs.current[4] = subscribeToInvoices(orgId, (i) => setInvoices(i), { onError: onSubError, limitCount: 500 });
    unsubs.current[5] = subscribeToInventory(orgId, (i) => setInventory(i), { onError: onSubError, limitCount: 300 });
    unsubs.current[6] = subscribeToLedgers(orgId, (l) => setLedgers(l), { onError: onSubError, limitCount: 200 });
    unsubs.current[7] = subscribeToPayments(orgId, (p) => setPayments(p), { onError: onSubError, limitCount: 200 });
    unsubs.current[8] = subscribeToBankTransactions(orgId, (b) => setBankTransactions(b), { onError: onSubError, limitCount: 200 });
    unsubs.current[9] = subscribeToTaxes(orgId, (t) => setTaxes(t), { onError: onSubError, limitCount: 100 });

    return () => {
      unsubs.current.forEach((u) => u?.());
    };
  }, [orgId, isPreviewMode, retryTick]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // Memoized so the `connect` callback (which depends on `createdBy`) keeps
  // its `useCallback` identity across renders.
  const createdBy = useMemo(
    () => ({
      uid: user?.id ?? '',
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
    }),
    [user?.id, user?.name, user?.email],
  );

  // ─── Mutation: connect ─────────────────────────────────────────────────────

  const connect = useCallback(
    async (input: {
      provider: ERPProviderName;
      companyName: string;
      companyId?: string;
      companyGstin?: string;
      credentials: Record<string, string>;
    }): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/erp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            provider: input.provider,
            companyName: input.companyName,
            companyId: input.companyId ?? '',
            companyGstin: input.companyGstin,
            credentials: input.credentials,
            createdBy,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to connect ERP.');
        }

        const { result, complete } = data;
        if (!complete) {
          throw new Error('ERP connection could not be completed. Please try again.');
        }

        // Persist a connection doc with status='connected'.
        await saveConnection(orgId, {
          organizationId: orgId,
          provider: input.provider,
          companyName: result.companyInfo.companyName,
          companyId: result.companyInfo.companyId,
          companyGstin: result.companyInfo.gstin ?? input.companyGstin ?? null,
          connectionStatus: 'connected',
          lastSync: null,
          syncProgress: 0,
          encryptedConnection: complete.encryptedConnection,
          tokenExpiry: complete.tokenExpiry,
          lastError: null,
          lastSyncSummary: null,
          createdBy,
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, createdBy],
  );

  // ─── Mutation: disconnect ──────────────────────────────────────────────────

  const disconnect = useCallback(
    async (connectionId: string): Promise<boolean> => {
      if (!orgId) return false;
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) return false;
      setSaving(true);
      setError(null);
      try {
        await fetch('/api/erp/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId,
            encryptedConnection: conn.encryptedConnection,
          }),
        });
        // cascadeDisconnect is called server-side, but also call client-side
        // for immediate UI feedback (the server may time out on Firestore).
        await cascadeDisconnect(orgId, connectionId).catch(() => {});
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, connections],
  );

  // ─── Mutation: sync ─────────────────────────────────────────────────────────

  const sync = useCallback(
    async (connectionId: string): Promise<boolean> => {
      if (!orgId) return false;
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) return false;
      setSaving(true);
      setError(null);
      try {
        // Mark the connection as syncing (progress 0).
        await updateConnection(orgId, connectionId, {
          syncProgress: 0,
          lastError: null,
        }).catch(() => {});

        const res = await fetch('/api/erp/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId,
            provider: conn.provider,
            jobType: 'full',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Sync failed.');
        }
        // The server-side scheduler persists records + updates the connection's
        // lastSync + lastSyncSummary. Real-time subscriptions surface the data.
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        await updateConnection(orgId, connectionId, {
          lastError: msg,
        }).catch(() => {});
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, connections],
  );

  // ─── Mutation: retry ────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isConnected = connections.some((c) => c.connectionStatus === 'connected');
  const isSyncing = syncJobs.some((j) => j.status === 'running' || j.status === 'pending');

  const summary = useMemo(
    () => computeERPSummary(connections, customers, vendors, invoices, inventory, ledgers, taxes),
    [connections, customers, vendors, invoices, inventory, ledgers, taxes],
  );

  return {
    connections,
    syncJobs,
    customers,
    vendors,
    invoices,
    inventory,
    ledgers,
    payments,
    bankTransactions,
    taxes,
    summary,
    isConnected,
    isSyncing,
    loading,
    error,
    saving,
    connect,
    disconnect,
    sync,
    retry,
  };
}

// ─── Convenience re-exports ───────────────────────────────────────────────────

export type {
  ERPConnection,
  ERPProviderName,
  ERPSyncJob,
  ERPSummary,
  ERPCustomer,
  ERPVendor,
  ERPInvoice,
  ERPInventoryItem,
  ERPLedger,
  ERPPayment,
  ERPBankTransaction,
  ERPTax,
} from '@/lib/erp-provider';
