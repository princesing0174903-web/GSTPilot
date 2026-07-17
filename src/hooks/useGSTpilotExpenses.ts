'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotExpenses() Hook
//
// Real-time expenses list (onSnapshot) + CRUD + search.
//
// ORG-SCOPED (MULTI-TENANT):
//   Reads the current organizationId from OrgContext and passes it to every
//   gstpilot-data service call. The Firestore path is:
//     organizations/{organizationId}/expenses/{expenseId}
//
//   If no org is resolved (preview mode), the subscription returns an empty
//   list — NO Firestore read, NO permission error.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribeExpenses,
  createExpense as svcCreate,
  updateExpense as svcUpdate,
  deleteExpense as svcDelete,
  searchExpenses,
  computeExpenseStatsLocal,
  type Expense,
  type CreateExpenseInput,
  type UpdateExpenseInput,
  type ExpenseStats,
} from '@/lib/gstpilot-data';
import { useOrg } from '@/contexts/OrgContext';

export interface UseGSTpilotExpensesResult {
  expenses: Expense[];
  filtered: Expense[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  search: string;
  setSearch: (q: string) => void;
  stats: ExpenseStats;
  create: (input: CreateExpenseInput) => Promise<Expense | null>;
  update: (id: string, patch: UpdateExpenseInput) => Promise<Expense | null>;
  remove: (id: string) => Promise<boolean>;
  retry: () => void;
}

export function useGSTpilotExpenses(): UseGSTpilotExpensesResult {
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const expensesRef = useRef<Expense[]>([]);
  expensesRef.current = expenses;

  // Keep orgId in a ref so the subscription effect doesn't re-run on every
  // orgId identity change (it should only re-run when the ID actually changes).
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  useEffect(() => {
    const currentOrgId = orgIdRef.current;
    // Preview mode (synthetic preview-org) or no org → NO Firestore read.
    if (isPreviewMode || !currentOrgId || currentOrgId === 'preview-org') {
      setExpenses([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeExpenses(
      currentOrgId,
      (list) => {
        setExpenses(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Unable to load expenses.\n\nReason: You don\'t currently have permission to read this organization\'s data. Please sign in and ensure you are a member of the organization.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached expenses.'
              : err.message || 'Could not load expenses.';
        setError(msg);
        setLoading(false);
        console.error('[useGSTpilotExpenses] subscription error:', {
          orgId: currentOrgId,
          path: currentOrgId ? `organizations/${currentOrgId}/expenses` : '(no org)',
          code,
          message: err.message,
        });
      },
    );
    return () => unsubscribe();
  }, [orgId, isPreviewMode, retryTick]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTick((t) => t + 1);
  }, []);

  const create = useCallback(async (input: CreateExpenseInput) => {
    setSaving(true);
    try {
      const expense = await svcCreate(orgIdRef.current, input);
      setExpenses((prev) => [expense, ...prev]);
      return expense;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create expense.';
      setError(msg);
      console.error('[useGSTpilotExpenses] create error:', {
        orgId: orgIdRef.current,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateExpenseInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(orgIdRef.current, id, patch);
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update expense.';
      setError(msg);
      console.error('[useGSTpilotExpenses] update error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const prev = expensesRef.current;
      setExpenses((cur) => cur.filter((e) => e.id !== id));
      try {
        await svcDelete(orgIdRef.current, id);
        return true;
      } catch (err) {
        setExpenses(prev);
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete expense.';
      setError(msg);
      console.error('[useGSTpilotExpenses] delete error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const filtered = useMemo(() => searchExpenses(expenses, search), [expenses, search]);

  const stats = useMemo(() => computeExpenseStatsLocal(expenses), [expenses]);

  return {
    expenses,
    filtered,
    loading,
    error,
    saving,
    search,
    setSearch,
    stats,
    create,
    update,
    remove,
    retry,
  };
}
