'use client';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — useBanking() Hook
//
// The SINGLE hook every GSTPilot component uses to interact with banking data.
// Mirrors the useGSTConnection() + useInvoices() pattern:
//
//   • READ — real-time subscriptions to connections + transactions (org-scoped
//     via onSnapshot)
//   • CONNECT — connect → complete → persist encrypted connection
//   • DISCONNECT — invalidate connection + cascade-delete all banking data
//   • REFRESH — renew an expired connection
//   • SYNC — full or incremental sync (balances / transactions / both)
//   • RECONCILE — match transactions against invoices
//
// All tenant scoping is automatic — components never touch `organizationId`.
// If the user has no organization yet, every operation no-ops safely.
//
// Architecture:
//   1. Mutations call the API route (/api/banking/*) for provider work
//      (connect, sync, refresh). The API returns plain data + the encrypted
//      connection.
//   2. The hook then persists the result to Firestore via the service layer.
//   3. Real-time onSnapshot subscriptions surface the change to every
//      connected client instantly.
//
// Security: the encrypted connection blob is stored in Firestore but can ONLY
// be decrypted by the server (AES-256-GCM with a server-only master key). The
// client passes it opaquely to /api/banking/* routes.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToConnections,
  saveConnection,
  updateConnection,
  cascadeDisconnect,
  subscribeToTransactions,
  saveTransactions,
  updateTransaction,
  subscribeToSyncJobs,
  createSyncJob,
  updateSyncJob,
  computeBankingSummary,
  type BankConnection,
  type BankConnectionStatus,
  type BankProviderName,
  type BankTransaction,
  type BankingSummary,
  type BankSyncJob,
} from '@/lib/banking-provider';

// ─── Hook return type ────────────────────────────────────────────────────────

export interface UseBankingResult {
  /** All of the current org's bank connections. */
  connections: BankConnection[];
  /** Bank transactions (newest date first). */
  transactions: BankTransaction[];
  /** Recent sync jobs (newest first). */
  syncJobs: BankSyncJob[];
  /** Memoized summary — recomputed when connections/transactions change. */
  summary: BankingSummary;

  /** Convenience: is there at least one connected account? */
  isConnected: boolean;
  /** Convenience: are any sync jobs currently running? */
  isSyncing: boolean;

  loading: boolean;
  error: string | null;
  /** True while any mutation is in-flight. */
  saving: boolean;

  // ─── Mutations ────────────────────────────────────────────────────────────

  /** Connect a bank account. Initiates the provider connect flow. */
  connect: (input: {
    provider?: BankProviderName;
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountType: BankConnection['accountType'];
  }) => Promise<boolean>;
  /** Disconnect a bank connection — invalidate + cascade-delete all data. */
  disconnect: (connectionId: string) => Promise<boolean>;
  /** Refresh an expired connection. */
  refreshConnection: (connectionId: string) => Promise<boolean>;
  /** Sync data from the bank. scope: 'full' | 'balances' | 'transactions'. */
  sync: (connectionId: string, scope?: 'full' | 'balances' | 'transactions') => Promise<boolean>;
  /** Manually recategorize + reconcile all transactions (re-run engines). */
  reconcile: (invoices: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    grandTotal: number;
    balanceDue: number;
    invoiceType: 'sales' | 'purchase';
  }>) => Promise<boolean>;
  /** Retry the last failed subscription. */
  retry: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBanking(): UseBankingResult {
  const { organization, isPreviewMode } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? null;

  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [syncJobs, setSyncJobs] = useState<BankSyncJob[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  // Subscription refs (for cleanup)
  const unsubConnRef = useRef<(() => void) | null>(null);
  const unsubTxRef = useRef<(() => void) | null>(null);
  const unsubJobsRef = useRef<(() => void) | null>(null);

  // ─── Real-time subscriptions ──────────────────────────────────────────────

  useEffect(() => {
    unsubConnRef.current?.();
    unsubTxRef.current?.();
    unsubJobsRef.current?.();

    if (!orgId || isPreviewMode || isLocalOrgId(orgId)) {
      setConnections([]);
      setTransactions([]);
      setSyncJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const onSubError = (err: Error) => {
      // Firestore backend unreachable (e.g. sandbox preview). Don't crash —
      // just surface a friendly error. The UI will show an empty state.
      console.warn('[useBanking] subscription error:', err.message);
      setError(err.message);
      setLoading(false);
    };

    unsubConnRef.current = subscribeToConnections(
      orgId,
      (conns) => {
        setConnections(conns);
        setLoading(false);
        setError(null);
      },
      { onError: onSubError },
    );

    unsubTxRef.current = subscribeToTransactions(
      orgId,
      (txs) => {
        setTransactions(txs);
        setError(null);
      },
      { onError: onSubError, limitCount: 500 },
    );

    unsubJobsRef.current = subscribeToSyncJobs(
      orgId,
      (jobs) => {
        setSyncJobs(jobs);
      },
      { onError: onSubError, limitCount: 20 },
    );

    return () => {
      unsubConnRef.current?.();
      unsubTxRef.current?.();
      unsubJobsRef.current?.();
    };
  }, [orgId, isPreviewMode, retryTick]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const createdBy = {
    uid: user?.id ?? '',
    name: user?.name ?? 'Unknown',
    email: user?.email ?? '',
  };

  // ─── Mutation: connect ─────────────────────────────────────────────────────

  const connect = useCallback(
    async (input: {
      provider?: BankProviderName;
      accountHolder: string;
      bankName: string;
      accountNumber: string;
      ifsc: string;
      accountType: BankConnection['accountType'];
    }): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/banking/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            provider: input.provider ?? 'mock',
            accountHolder: input.accountHolder,
            bankName: input.bankName,
            accountNumber: input.accountNumber,
            ifsc: input.ifsc,
            accountType: input.accountType,
            createdBy,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to connect bank account.');
        }

        const { connectionRef, accountNumberMasked, accountSnapshot } = data.result;
        const { encryptedConnection, consentExpiry, accountSnapshot: completedSnapshot } = data.complete;

        // Persist a connection doc with status='connected'.
        await saveConnection(orgId, {
          organizationId: orgId,
          provider: input.provider ?? 'mock',
          accountHolder: input.accountHolder,
          bankName: input.bankName,
          accountNumberMasked,
          ifsc: input.ifsc.toUpperCase(),
          accountType: input.accountType,
          status: 'connected',
          lastSync: new Date().toISOString(),
          consentExpiry,
          encryptedConnection,
          lastSnapshot: completedSnapshot ?? accountSnapshot ?? null,
          lastError: null,
          createdBy,
        });
        // connectionRef is the provider's internal id — kept for debugging.
        void connectionRef;
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
        await fetch('/api/banking/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedConnection: conn.encryptedConnection }),
        });
        await cascadeDisconnect(orgId, connectionId);
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

  // ─── Mutation: refreshConnection ───────────────────────────────────────────

  const refreshConnection = useCallback(
    async (connectionId: string): Promise<boolean> => {
      if (!orgId) return false;
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn?.encryptedConnection) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/banking/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedConnection: conn.encryptedConnection }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Connection refresh failed. Please reconnect.');
        }
        const { encryptedConnection, consentExpiry } = data.result;
        await updateConnection(orgId, connectionId, {
          encryptedConnection,
          consentExpiry,
          status: 'connected',
          lastError: null,
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        if (conn) {
          await updateConnection(orgId, connectionId, {
            status: 'expired',
            lastError: msg,
          }).catch(() => {});
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, connections],
  );

  // ─── Mutation: sync ─────────────────────────────────────────────────────────

  const sync = useCallback(
    async (connectionId: string, scope: 'full' | 'balances' | 'transactions' = 'full'): Promise<boolean> => {
      if (!orgId) return false;
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn?.encryptedConnection) return false;
      setSaving(true);
      setError(null);

      const syncJobId = await createSyncJob(orgId, {
        connectionId,
        type: scope === 'full' ? 'full' : scope === 'balances' ? 'balances' : 'transactions',
        trigger: 'manual',
        maxRetries: 3,
      }).catch(() => null);

      try {
        const res = await fetch('/api/banking/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId,
            encryptedConnection: conn.encryptedConnection,
            scope,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Sync failed.');
        }

        const { snapshot, transactions: syncedTxs } = data.result;

        // Persist transactions to Firestore.
        if (syncedTxs && Array.isArray(syncedTxs)) {
          await saveTransactions(orgId, syncedTxs);
        }

        // Update the connection's lastSync + lastSnapshot.
        await updateConnection(orgId, connectionId, {
          status: 'connected',
          lastSync: new Date().toISOString(),
          lastSnapshot: snapshot ?? conn.lastSnapshot,
          lastError: null,
        });

        if (syncJobId) {
          await updateSyncJob(orgId, syncJobId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: {
              accountsSynced: snapshot ? 1 : 0,
              transactionsSynced: syncedTxs?.length ?? 0,
              balancesSynced: !!snapshot,
            },
          }).catch(() => {});
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        if (syncJobId) {
          await updateSyncJob(orgId, syncJobId, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            error: msg,
          }).catch(() => {});
        }
        if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('connection')) {
          await updateConnection(orgId, connectionId, {
            status: 'expired',
            lastError: msg,
          }).catch(() => {});
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, connections],
  );

  // ─── Mutation: reconcile ────────────────────────────────────────────────────

  const reconcile = useCallback(
    async (invoices: Array<{
      id: string;
      invoiceNumber: string;
      clientName: string;
      grandTotal: number;
      balanceDue: number;
      invoiceType: 'sales' | 'purchase';
    }>): Promise<boolean> => {
      if (!orgId || transactions.length === 0) return false;
      setSaving(true);
      setError(null);
      try {
        // Run the reconciliation engine client-side (pure function).
        const { reconcileTransactions } = await import('@/lib/banking/reconcile');
        const reconciled = reconcileTransactions(transactions, invoices);
        // Persist only the changed fields.
        await Promise.all(
          reconciled.map((tx) =>
            updateTransaction(orgId, tx.id, {
              invoiceId: tx.invoiceId,
              reconciled: tx.reconciled,
              matchConfidence: tx.matchConfidence,
            }),
          ),
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, transactions],
  );

  // ─── Mutation: retry ────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isConnected = connections.some((c) => c.status === 'connected');
  const isSyncing = syncJobs.some((j) => j.status === 'running' || j.status === 'pending');

  const summary = useMemo(
    () => computeBankingSummary(connections, transactions),
    [connections, transactions],
  );

  return {
    connections,
    transactions,
    syncJobs,
    summary,
    isConnected,
    isSyncing,
    loading,
    error,
    saving,
    connect,
    disconnect,
    refreshConnection,
    sync,
    reconcile,
    retry,
  };
}

// ─── Convenience re-exports ───────────────────────────────────────────────────

export type {
  BankConnection,
  BankConnectionStatus,
  BankProviderName,
  BankTransaction,
  BankingSummary,
  BankSyncJob,
} from '@/lib/banking-provider';
