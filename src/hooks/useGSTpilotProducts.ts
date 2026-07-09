'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — useGSTpilotProducts() Hook
//
// Real-time products list (onSnapshot) + CRUD + search.
// Firestore is the ONLY source of truth: organizations/GSTpilot_SAAS/products
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeProducts(
      (list) => {
        setProducts(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const code = (err as { code?: string }).code;
        const msg =
          code === 'permission-denied'
            ? 'Permission denied. Check Firestore security rules for organizations/GSTpilot_SAAS/products.'
            : code === 'unavailable'
              ? 'You appear to be offline. Showing cached products.'
              : err.message || 'Could not load products.';
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

  const create = useCallback(async (input: CreateProductInput) => {
    setSaving(true);
    try {
      const product = await svcCreate(input);
      setProducts((prev) =>
        [product, ...prev].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return product;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, patch: UpdateProductInput) => {
    setSaving(true);
    try {
      const updated = await svcUpdate(id, patch);
      setProducts((prev) =>
        prev
          .map((p) => (p.id === id ? updated : p))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product.');
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
        await svcDelete(id);
        return true;
      } catch (err) {
        setProducts(prev);
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product.');
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
