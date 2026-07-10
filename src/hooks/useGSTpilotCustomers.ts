'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotCustomers() Hook
//
// Real-time customers list (onSnapshot) + CRUD + search.
// Firestore is the ONLY source of truth: organizations/GSTpilot_SAAS/customers
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribeCustomers,
  createCustomer as svcCreate,
  updateCustomer as svcUpdate,
  deleteCustomer as svcDelete,
  searchCustomers,
  type Customer,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerStats,
} from '@/lib/gstpilot-data';

export interface UseGSTpilotCustomersResult {
  customers: Customer[];
  filtered: Customer[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  search: string;
  setSearch: (q: string) => void;
  stats: CustomerStats;
  create: (input: CreateCustomerInput) => Promise<Customer | null>;
  update: (id: string, patch: UpdateCustomerInput) => Promise<Customer | null>;
  remove: (id: string) => Promise<boolean>;
  retry: () => void;
}

export function useGSTpilotCustomers(): UseGSTpilotCustomersResult {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const customersRef = useRef<Customer[]>([]);
  customersRef.current = customers;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeCustomers(
      (list) => {
        setCustomers(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Permission denied. Check Firestore security rules for organizations/GSTpilot_SAAS/customers.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached customers.'
              : err.message || 'Could not load customers.';
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

  const create = useCallback(async (input: CreateCustomerInput) => {
    setSaving(true);
    try {
      const customer = await svcCreate(input);
      // Optimistic insert; onSnapshot will confirm.
      setCustomers((prev) =>
        [customer, ...prev].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return customer;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateCustomerInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(id, patch);
      setCustomers((prev) =>
        prev
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const prev = customersRef.current;
      setCustomers((cur) => cur.filter((c) => c.id !== id));
      try {
        await svcDelete(id);
        return true;
      } catch (err) {
        setCustomers(prev); // rollback
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const filtered = useMemo(
    () => searchCustomers(customers, search),
    [customers, search],
  );

  const stats = useMemo<CustomerStats>(
    () => ({
      count: customers.length,
      totalOutstanding: Math.round(
        customers.reduce((s, c) => s + (c.balance || 0), 0) * 100,
      ) / 100,
      withGstin: customers.filter((c) => !!c.gstin).length,
    }),
    [customers],
  );

  return {
    customers,
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
