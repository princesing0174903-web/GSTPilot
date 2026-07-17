'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotProducts() Hook
//
// Real-time products list (onSnapshot) + CRUD + search.
//
// ORG-SCOPED (MULTI-TENANT):
//   Reads the current organizationId from OrgContext and passes it to every
//   gstpilot-data service call. The Firestore path is:
//     organizations/{organizationId}/products/{productId}
//
//   If no org is resolved (preview mode), the subscription returns an empty
//   list — NO Firestore read, NO permission error.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribeProducts,
  createProduct as svcCreate,
  updateProduct as svcUpdate,
  deleteProduct as svcDelete,
  searchProducts,
  computeProductStats,
  type Product,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductStats,
} from '@/lib/gstpilot-data';
import { useOrg } from '@/contexts/OrgContext';

export interface UseGSTpilotProductsResult {
  products: Product[];
  filtered: Product[];
  loading: boolean;
  error: string | null;
  saving: boolean;
  search: string;
  setSearch: (q: string) => void;
  stats: ProductStats;
  create: (input: CreateProductInput) => Promise<Product | null>;
  update: (id: string, patch: UpdateProductInput) => Promise<Product | null>;
  remove: (id: string) => Promise<boolean>;
  retry: () => void;
}

export function useGSTpilotProducts(): UseGSTpilotProductsResult {
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;

  // Keep orgId in a ref so the subscription effect doesn't re-run on every
  // orgId identity change (it should only re-run when the ID actually changes).
  const orgIdRef = useRef<string | null>(null);
  orgIdRef.current = orgId;

  useEffect(() => {
    const currentOrgId = orgIdRef.current;
    // Preview mode (synthetic preview-org) or no org → NO Firestore read.
    if (isPreviewMode || !currentOrgId || currentOrgId === 'preview-org') {
      setProducts([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeProducts(
      currentOrgId,
      (list) => {
        setProducts(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Unable to load products.\n\nReason: You don\'t currently have permission to read this organization\'s data. Please sign in and ensure you are a member of the organization.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached products.'
              : err.message || 'Could not load products.';
        setError(msg);
        setLoading(false);
        console.error('[useGSTpilotProducts] subscription error:', {
          orgId: currentOrgId,
          path: currentOrgId ? `organizations/${currentOrgId}/products` : '(no org)',
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

  const create = useCallback(async (input: CreateProductInput) => {
    setSaving(true);
    try {
      const product = await svcCreate(orgIdRef.current, input);
      setProducts((prev) =>
        [product, ...prev].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return product;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create product.';
      setError(msg);
      console.error('[useGSTpilotProducts] create error:', {
        orgId: orgIdRef.current,
        error: err,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateProductInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(orgIdRef.current, id, patch);
      setProducts((prev) =>
        prev
          .map((p) => (p.id === id ? updated : p))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update product.';
      setError(msg);
      console.error('[useGSTpilotProducts] update error:', {
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
      const prev = productsRef.current;
      setProducts((cur) => cur.filter((p) => p.id !== id));
      try {
        await svcDelete(orgIdRef.current, id);
        return true;
      } catch (err) {
        setProducts(prev);
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete product.';
      setError(msg);
      console.error('[useGSTpilotProducts] delete error:', {
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
    () => searchProducts(products, search),
    [products, search],
  );

  const stats = useMemo(() => computeProductStats(products), [products]);

  return {
    products,
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
