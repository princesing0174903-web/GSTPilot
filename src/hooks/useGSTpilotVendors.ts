'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotVendors() Hook
//
// Real-time vendors list (onSnapshot) + CRUD + search.
//
// ORG-SCOPED (MULTI-TENANT):
//   Reads the current organizationId from OrgContext and passes it to every
//   gstpilot-data service call. The Firestore path is:
//     organizations/{organizationId}/vendors/{vendorId}
//
//   If no org is resolved (preview mode), the subscription returns an empty
//   list — NO Firestore read, NO permission error.
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
import { useOrg } from '@/contexts/OrgContext';

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
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const vendorsRef = useRef<Vendor[]>([]);
  vendorsRef.current = vendors;

  // Keep orgId in a ref so the subscription effect doesn't re-run on every
  // orgId identity change (it should only re-run when the ID actually changes).
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  useEffect(() => {
    const currentOrgId = orgIdRef.current;
    // Preview mode (synthetic preview-org) or no org → NO Firestore read.
    if (isPreviewMode || !currentOrgId || currentOrgId === 'preview-org') {
      setVendors([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeVendors(
      currentOrgId,
      (list) => {
        setVendors(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Unable to load vendors.\n\nReason: You don\'t currently have permission to read this organization\'s data. Please sign in and ensure you are a member of the organization.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached vendors.'
              : err.message || 'Could not load vendors.';
        setError(msg);
        setLoading(false);
        console.error('[useGSTpilotVendors] subscription error:', {
          orgId: currentOrgId,
          path: currentOrgId ? `organizations/${currentOrgId}/vendors` : '(no org)',
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

  const create = useCallback(async (input: CreateVendorInput) => {
    setSaving(true);
    try {
      const vendor = await svcCreate(orgIdRef.current, input);
      setVendors((prev) =>
        [vendor, ...prev].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return vendor;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create vendor.';
      setError(msg);
      console.error('[useGSTpilotVendors] create error:', {
        orgId: orgIdRef.current,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateVendorInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(orgIdRef.current, id, patch);
      setVendors((prev) =>
        prev
          .map((v) => (v.id === id ? updated : v))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update vendor.';
      setError(msg);
      console.error('[useGSTpilotVendors] update error:', {
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
      const prev = vendorsRef.current;
      setVendors((cur) => cur.filter((v) => v.id !== id));
      try {
        await svcDelete(orgIdRef.current, id);
        return true;
      } catch (err) {
        setVendors(prev);
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete vendor.';
      setError(msg);
      console.error('[useGSTpilotVendors] delete error:', {
        orgId: orgIdRef.current,
        id,
        error: err,
      });
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
