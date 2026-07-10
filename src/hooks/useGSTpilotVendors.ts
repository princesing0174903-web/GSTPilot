'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotVendors() Hook
//
// Real-time vendors list (onSnapshot) + CRUD + search.
// Firestore is the ONLY source of truth: organizations/GSTpilot_SAAS/vendors
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribeVendors,
  createVendor as svcCreate,
  updateVendor as svcUpdate,
  deleteVendor as svcDelete,
  searchVendors,
  type Vendor,
  type CreateVendorInput,
  type UpdateVendorInput,
  type VendorStats,
} from '@/lib/gstpilot-data';

export interface UseGSTpilotVendorsResult {
  vendors: Vendor[];
  filtered: Vendor[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  search: string;
  setSearch: (q: string) => void;
  stats: VendorStats;
  create: (input: CreateVendorInput) => Promise<Vendor | null>;
  update: (id: string, patch: UpdateVendorInput) => Promise<Vendor | null>;
  remove: (id: string) => Promise<boolean>;
  retry: () => void;
}

export function useGSTpilotVendors(): UseGSTpilotVendorsResult {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const vendorsRef = useRef<Vendor[]>([]);
  vendorsRef.current = vendors;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeVendors(
      (list) => {
        setVendors(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Permission denied. Check Firestore security rules for organizations/GSTpilot_SAAS/vendors.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached vendors.'
              : err.message || 'Could not load vendors.';
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

  const create = useCallback(async (input: CreateVendorInput) => {
    setSaving(true);
    try {
      const vendor = await svcCreate(input);
      setVendors((prev) =>
        [vendor, ...prev].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return vendor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateVendorInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(id, patch);
      setVendors((prev) =>
        prev
          .map((v) => (v.id === id ? updated : v))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update vendor.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const prev = vendorsRef.current;
      setVendors((cur) => cur.filter((v) => v.id !== id));
      try {
        await svcDelete(id);
        return true;
      } catch (err) {
        setVendors(prev);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vendor.');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const filtered = useMemo(() => searchVendors(vendors, search), [vendors, search]);

  const stats = useMemo<VendorStats>(
    () => ({
      count: vendors.length,
      totalPayable: Math.round(vendors.reduce((s, v) => s + (v.balance || 0), 0) * 100) / 100,
      withGstin: vendors.filter((v) => !!v.gstin).length,
    }),
    [vendors],
  );

  return {
    vendors,
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
