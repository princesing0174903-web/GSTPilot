'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotExpenses() Hook
//
// Real-time expenses list (onSnapshot) + CRUD + search.
// Firestore is the ONLY source of truth: organizations/GSTpilot_SAAS/expenses
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const expensesRef = useRef<Expense[]>([]);
  expensesRef.current = expenses;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeExpenses(
      (list) => {
        setExpenses(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Permission denied. Check Firestore security rules for organizations/GSTpilot_SAAS/expenses.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached expenses.'
              : err.message || 'Could not load expenses.';
        setError(msg);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [retryTick]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTick((t) => t + 1);
  }, []);

  const create = useCallback(async (input: CreateExpenseInput) => {
    setSaving(true);
    try {
      const expense = await svcCreate(input);
      setExpenses((prev) => [expense, ...prev]);
      return expense;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateExpenseInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(id, patch);
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expense.');
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
        await svcDelete(id);
        return true;
      } catch (err) {
        setExpenses(prev);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense.');
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
