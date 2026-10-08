'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — useGSTpilotCustomers() Hook
//
// Real-time customers list (onSnapshot) + CRUD + search.
//
// ORG-SCOPED (MULTI-TENANT):
//   Reads the current organizationId from OrgContext and passes it to every
//   gstpilot-data service call. The Firestore path is:
//     organizations/{organizationId}/customers/{customerId}
//
//   If no org is resolved (preview mode), the subscription returns an empty
//   list — NO Firestore read, NO permission error.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribeCustomers,
  createCustomer as svcCreate,
  updateCustomer as svcUpdate,
  deleteCustomer as svcDelete,
  searchCustomers,
  shouldSkipFirestore,
  type Customer,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerStats,
} from '@/lib/gstpilot-data';
import { useOrg } from '@/contexts/OrgContext';

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
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const customersRef = useRef<Customer[]>([]);
  customersRef.current = customers;

  // Keep orgId in a ref so the subscription effect doesn't re-run on every
  // orgId identity change (it should only re-run when the ID actually changes).
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  useEffect(() => {
    const currentOrgId = orgIdRef.current;
    // Local workspace, preview mode, or no org → NO Firestore read.
    // The service layer also guards against synthetic ids, but we
    // short-circuit here too so the empty state appears instantly without
    // a doomed round-trip that would log a permission-denied error.
    if (shouldSkipFirestore(currentOrgId, isPreviewMode)) {
      setCustomers([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);

    // Watchdog: if Firestore never sends the first snapshot within 10s
    // (rare cold-start / offline scenario), clear loading so the UI doesn't
    // hang on a spinner forever. The subscription stays open — when the
    // snapshot eventually arrives it'll still update state.
    let firstSnapshotReceived = false;
    const watchdog = setTimeout(() => {
      if (!firstSnapshotReceived) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(false);
      }
    }, 10_000);

    const unsubscribe = subscribeCustomers(
      currentOrgId,
      (list) => {
        firstSnapshotReceived = true;
        setCustomers(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        firstSnapshotReceived = true;
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Unable to load customers.\n\nReason: You don\'t currently have permission to read this organization\'s data. Please sign in and ensure you are a member of the organization.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached customers.'
              : err.message || 'Could not load customers.';
        setError(msg);
        setLoading(false);
        // Detailed error in console only — never show raw FirebaseError to user.
        console.error('[useGSTpilotCustomers] subscription error:', {
          orgId: currentOrgId,
          path: currentOrgId ? `organizations/${currentOrgId}/customers` : '(no org)',
          code,
          message: err.message,
        });
      },
    );
    return () => {
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, [orgId, isPreviewMode, retryTick]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryTick((t) => t + 1);
  }, []);

  const create = useCallback(async (input: CreateCustomerInput) => {
    setSaving(true);
    try {
      const customer = await svcCreate(orgIdRef.current, input);
      // Optimistic insert; onSnapshot will confirm.
      setCustomers((prev) =>
        [customer, ...prev].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return customer;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create customer.';
      setError(msg);
      console.error('[useGSTpilotCustomers] create error:', {
        orgId: orgIdRef.current,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateCustomerInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(orgIdRef.current, id, patch);
      setCustomers((prev) =>
        prev
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update customer.';
      setError(msg);
      console.error('[useGSTpilotCustomers] update error:', {
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
      const prev = customersRef.current;
      setCustomers((cur) => cur.filter((c) => c.id !== id));
      try {
        await svcDelete(orgIdRef.current, id);
        return true;
      } catch (err) {
        setCustomers(prev); // rollback
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete customer.';
      setError(msg);
      console.error('[useGSTpilotCustomers] delete error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
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
