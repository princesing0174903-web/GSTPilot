'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — React API Hook (TASK 12)
//
// The single client-side entry point for all banking data. Mirrors the
// useInvoicesApi pattern: typed fetch wrappers with loading/error states.
//
// All requests go through fetchWithTimeout which auto-injects the
// x-gstpilot-actor header (uid/email) so requireAuth succeeds in sandbox mode.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import type {
  BankingAccount,
  BankingAccountListResult,
  BankingTransaction,
  BankingTransactionListResult,
  BankingDashboardSummary,
  BankReconciliationRecord,
  ReconciliationSummary,
  CashFlowResult,
  BankingOracleInsights,
  StatementImportResult,
  BankingReport,
  ReportPeriod,
  ProviderInfo,
  TransactionQuery,
} from '@/lib/banking-prisma/types';

// ─── fetchWithTimeout ─────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Actor header ─────────────────────────────────────────────────────────────

function useActorHeader() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'local-user';
  const email = user?.email ?? 'local@gstpilot.dev';
  return `{"uid":"${uid}","email":"${email}"}`;
}

// ─── Generic API call helper ──────────────────────────────────────────────────

async function apiCall<T>(
  url: string,
  orgId: string,
  actorHeader: string,
  options?: RequestInit,
): Promise<T> {
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${sep}organizationId=${encodeURIComponent(orgId)}`;
  const res = await fetchWithTimeout(fullUrl, {
    ...options,
    headers: {
      ...options?.headers,
      'x-gstpilot-actor': actorHeader,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseBankingApi {
  // Dashboard
  fetchDashboard: () => Promise<BankingDashboardSummary>;
  // Accounts
  fetchAccounts: () => Promise<BankingAccountListResult>;
  fetchAccount: (id: string) => Promise<BankingAccount | null>;
  createAccount: (input: Partial<BankingAccount> & { bankName: string; accountNumber: string }) => Promise<BankingAccount>;
  updateAccount: (id: string, patch: Partial<BankingAccount>) => Promise<BankingAccount | null>;
  deleteAccount: (id: string) => Promise<void>;
  syncAccount: (id: string) => Promise<{ synced: boolean; newTransactions: number; balance: number }>;
  // Transactions
  fetchTransactions: (query?: Partial<TransactionQuery>) => Promise<BankingTransactionListResult>;
  createTransaction: (input: Partial<BankingTransaction> & { accountId: string; amount: number; type: 'credit' | 'debit'; date: string; description: string }) => Promise<BankingTransaction>;
  updateTransaction: (id: string, patch: Partial<BankingTransaction>) => Promise<BankingTransaction | null>;
  deleteTransaction: (id: string) => Promise<void>;
  bulkUpdateTransactions: (ids: string[], patch: Partial<BankingTransaction>) => Promise<{ updated: number }>;
  // Reconciliation
  fetchReconciliationSummary: () => Promise<{ summary: ReconciliationSummary; records: BankReconciliationRecord[] }>;
  runReconciliation: () => Promise<{ summary: ReconciliationSummary; matched: BankReconciliationRecord[] }>;
  manualMatch: (transactionId: string, invoiceId: string) => Promise<BankReconciliationRecord | null>;
  approveReconciliation: (id: string) => Promise<BankReconciliationRecord | null>;
  rejectReconciliation: (id: string, reason: string) => Promise<BankReconciliationRecord | null>;
  // Cash Flow
  fetchCashFlow: (period?: '7d' | '30d' | '90d' | '1y') => Promise<CashFlowResult>;
  // Oracle
  fetchOracleInsights: () => Promise<BankingOracleInsights>;
  // Import
  importStatement: (file: File, accountId: string, confirm?: boolean) => Promise<StatementImportResult | { preview: unknown }>;
  fetchImports: () => Promise<unknown[]>;
  // Reports
  fetchReport: (period: ReportPeriod) => Promise<BankingReport>;
  // Provider
  fetchProviderInfo: () => Promise<ProviderInfo>;
}

export function useBankingApi(): UseBankingApi {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const actorHeader = useActorHeader();
  const orgId = currentOrg?.id || 'local';

  const call = useCallback(
    <T>(url: string, options?: RequestInit) => apiCall<T>(url, orgId, actorHeader, options),
    [orgId, actorHeader],
  );

  // Memoize the returned API object so consumers can safely use it as a
  // useEffect / useCallback dependency. Previously the hook returned a fresh
  // object literal on every render, which caused dependent effects
  // (e.g. BankingPage's loadDashboard useEffect) to re-fire every render,
  // producing "Maximum update depth exceeded" crashes.
  return useMemo<UseBankingApi>(
    () => ({
      fetchDashboard: () => call<BankingDashboardSummary>('/api/banking/dashboard'),
      fetchAccounts: () => call<BankingAccountListResult>('/api/banking/accounts'),
      fetchAccount: (id) => call<BankingAccount | null>(`/api/banking/accounts/${id}`),
      createAccount: (input) =>
        call<BankingAccount>('/api/banking/accounts', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      updateAccount: (id, patch) =>
        call<BankingAccount | null>(`/api/banking/accounts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      deleteAccount: (id) => call<void>(`/api/banking/accounts/${id}`, { method: 'DELETE' }),
      syncAccount: (id) =>
        call<{ synced: boolean; newTransactions: number; balance: number }>(
          `/api/banking/accounts/${id}/sync`,
          { method: 'POST' },
        ),
      fetchTransactions: (query = {}) => {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
        });
        return call<BankingTransactionListResult>(
          `/api/banking/transactions?${params.toString()}`,
        );
      },
      createTransaction: (input) =>
        call<BankingTransaction>('/api/banking/transactions', {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      updateTransaction: (id, patch) =>
        call<BankingTransaction | null>(`/api/banking/transactions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      deleteTransaction: (id) => call<void>(`/api/banking/transactions/${id}`, { method: 'DELETE' }),
      bulkUpdateTransactions: (ids, patch) =>
        call<{ updated: number }>('/api/banking/transactions/bulk', {
          method: 'POST',
          body: JSON.stringify({ ids, patch }),
        }),
      fetchReconciliationSummary: () =>
        call<{ summary: ReconciliationSummary; records: BankReconciliationRecord[] }>(
          '/api/banking/reconcile',
        ),
      runReconciliation: () =>
        call<{ summary: ReconciliationSummary; matched: BankReconciliationRecord[] }>(
          '/api/banking/reconcile',
          { method: 'POST' },
        ),
      manualMatch: (transactionId, invoiceId) =>
        call<BankReconciliationRecord | null>('/api/banking/reconcile/manual', {
          method: 'POST',
          body: JSON.stringify({ transactionId, invoiceId }),
        }),
      approveReconciliation: (id) =>
        call<BankReconciliationRecord | null>(`/api/banking/reconcile/${id}/approve`, {
          method: 'POST',
        }),
      rejectReconciliation: (id, reason) =>
        call<BankReconciliationRecord | null>(`/api/banking/reconcile/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }),
      fetchCashFlow: (period = '30d') =>
        call<CashFlowResult>(`/api/banking/cashflow?period=${period}`),
      fetchOracleInsights: () => call<BankingOracleInsights>('/api/banking/oracle'),
      importStatement: async (file, accountId, confirm = false) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('accountId', accountId);
        if (confirm) formData.append('confirm', 'true');
        const fullUrl = `/api/banking/import?organizationId=${encodeURIComponent(orgId)}`;
        const res = await fetchWithTimeout(fullUrl, {
          method: 'POST',
          body: formData,
          headers: { 'x-gstpilot-actor': actorHeader },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error || `Import failed (${res.status})`,
          );
        }
        return res.json();
      },
      fetchImports: () => call<unknown[]>('/api/banking/imports'),
      fetchReport: (period) => call<BankingReport>(`/api/banking/reports?period=${period}`),
      fetchProviderInfo: () => call<ProviderInfo>('/api/banking/provider'),
    }),
    [call, orgId, actorHeader],
  );
}

// ─── Async state helper (mirrors useInvoicesApi pattern) ──────────────────────

export function useAsync<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  return { data, loading, error, run, setData, setError };
}

// ─── Debounced value hook ─────────────────────────────────────────────────────

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
