// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Products Firestore Service
//
// CRUD + real-time subscription for product documents at:
//   organizations/{organizationId}/products/{productId}
//
// ORG-SCOPED (MULTI-TENANT):
//   Every function accepts an `organizationId` parameter (from OrgContext).
//   The Firestore path is built dynamically — NEVER hardcoded.
//   If organizationId is null/empty, functions return empty results
//   (honest empty state) instead of writing to a fallback path.
//
// Firestore is the ONLY source of truth. No mock data, no localStorage.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  orgCollectionPath,
  orgDocPath,
  PRODUCTS_SUB,
  DEFAULT_GST_RATE,
} from './config';
import { sanitizeGstRate } from './gst';
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductStats,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toProduct(id: string, raw: Record<string, unknown>): Product {
  const ts = (v: unknown): string | null => {
    if (v && typeof v === 'object' && 'toDate' in v) {
      return (v as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id,
    name: String(raw.name ?? ''),
    sku: (raw.sku as string | null) ?? null,
    description: (raw.description as string | null) ?? null,
    hsnSac: String(raw.hsnSac ?? ''),
    gstRate: sanitizeGstRate(Number(raw.gstRate ?? DEFAULT_GST_RATE)),
    unit: (raw.unit as Product['unit']) ?? 'NOS',
    price: Number(raw.price ?? 0),
    costPrice: raw.costPrice == null ? null : Number(raw.costPrice),
    stock: raw.stock == null ? null : Number(raw.stock),
    reorderLevel: raw.reorderLevel == null ? null : Number(raw.reorderLevel),
    isService: Boolean(raw.isService ?? false),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

function buildPayload(input: CreateProductInput) {
  return {
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    description: input.description?.trim() || null,
    hsnSac: (input.hsnSac ?? '').trim(),
    gstRate: sanitizeGstRate(input.gstRate ?? DEFAULT_GST_RATE),
    unit: input.unit ?? 'NOS',
    price: Number(input.price) || 0,
    costPrice: input.costPrice == null ? null : Number(input.costPrice),
    stock: input.isService ? null : (input.stock == null ? 0 : Number(input.stock)),
    reorderLevel: input.reorderLevel == null ? null : Number(input.reorderLevel),
    isService: Boolean(input.isService ?? false),
  };
}

/** No-op unsubscribe — returned when organizationId is null (preview mode). */
const noopUnsubscribe: Unsubscribe = () => {};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL products in real-time (onSnapshot) for the given org.
 *
 * If `organizationId` is null/empty (preview mode / no org), calls onData([])
 * immediately and returns a no-op unsubscribe — does NOT touch Firestore.
 */
export function subscribeProducts(
  organizationId: string | null | undefined,
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = orgCollectionPath(organizationId, PRODUCTS_SUB);
  if (!path) {
    onData([]);
    return noopUnsubscribe;
  }

  const q = query(
    collection(db, path),
    orderBy('name'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push(toProduct(d.id, d.data() as Record<string, unknown>)));
      onData(list);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch a single product by id (one-shot). */
export async function getProduct(
  organizationId: string | null | undefined,
  id: string,
): Promise<Product | null> {
  const path = orgDocPath(organizationId, PRODUCTS_SUB, id);
  if (!path) return null;
  const snap = await getDoc(doc(db, path));
  if (!snap.exists()) return null;
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Fetch ALL products in one shot (server-side / API-route friendly).
 * Returns an empty array on permission-denied / unavailable / no org.
 */
export async function getProductsOnce(
  organizationId: string | null | undefined,
): Promise<Product[]> {
  const path = orgCollectionPath(organizationId, PRODUCTS_SUB);
  if (!path) return [];
  try {
    const q = query(collection(db, path), orderBy('name'));
    const snap = await getDocs(q);
    const list: Product[] = [];
    snap.forEach((d) => list.push(toProduct(d.id, d.data() as Record<string, unknown>)));
    return list;
  } catch {
    return [];
  }
}

/**
 * Create a new product in the given org's subcollection.
 * Throws on validation errors. Returns the created Product.
 *
 * If organizationId is null/empty, throws a friendly error — the caller
 * must resolve the org context before creating.
 */
export async function createProduct(
  organizationId: string | null | undefined,
  input: CreateProductInput,
): Promise<Product> {
  const path = orgCollectionPath(organizationId, PRODUCTS_SUB);
  if (!path) {
    throw new Error(
      'Unable to save product.\n\nReason: No organization is currently selected. ' +
      'Please sign in and select an organization, then try again.',
    );
  }

  const name = input.name?.trim();
  if (!name) throw new Error('Product name is required.');
  if (input.price == null || Number.isNaN(Number(input.price))) {
    throw new Error('Product price is required.');
  }

  const payload = buildPayload(input);
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, path), {
    ...payload,
    createdAt: now,
    updatedAt: now,
  });
  const snap = await getDoc(ref);
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

/** Update an existing product. */
export async function updateProduct(
  organizationId: string | null | undefined,
  id: string,
  patch: UpdateProductInput,
): Promise<Product> {
  const path = orgDocPath(organizationId, PRODUCTS_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to update product.\n\nReason: No organization is currently selected.',
    );
  }

  const update: Record<string, unknown> = {};
  const built = buildPayload({
    name: patch.name ?? '__NOOP__',
    price: patch.price ?? 0,
    ...patch,
  } as CreateProductInput);
  if (patch.name !== undefined) update.name = built.name;
  if (patch.sku !== undefined) update.sku = built.sku;
  if (patch.description !== undefined) update.description = built.description;
  if (patch.hsnSac !== undefined) update.hsnSac = built.hsnSac;
  if (patch.gstRate !== undefined) update.gstRate = built.gstRate;
  if (patch.unit !== undefined) update.unit = built.unit;
  if (patch.price !== undefined) update.price = built.price;
  if (patch.costPrice !== undefined) update.costPrice = built.costPrice;
  if (patch.stock !== undefined) update.stock = built.stock;
  if (patch.reorderLevel !== undefined) update.reorderLevel = built.reorderLevel;
  if (patch.isService !== undefined) {
    update.isService = built.isService;
    // Services don't track stock.
    if (built.isService) update.stock = null;
  }
  update.updatedAt = serverTimestamp();

  await updateDoc(doc(db, path), update);
  const snap = await getDoc(doc(db, path));
  return toProduct(snap.id, snap.data() as Record<string, unknown>);
}

/** Delete a product permanently. */
export async function deleteProduct(
  organizationId: string | null | undefined,
  id: string,
): Promise<void> {
  const path = orgDocPath(organizationId, PRODUCTS_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to delete product.\n\nReason: No organization is currently selected.',
    );
  }
  await deleteDoc(doc(db, path));
}

// ─── Search + stats ──────────────────────────────────────────────────────────

/** Free-text filter over name / sku / hsnSac / description. */
export function searchProducts(
  products: Product[],
  queryText: string,
): Product[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) =>
    [p.name, p.sku, p.hsnSac, p.description]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}

/** Aggregate product list into stats. */
export function computeProductStats(products: Product[]): ProductStats {
  const stats: ProductStats = {
    count: products.length,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  };
  for (const p of products) {
    if (p.isService || p.stock == null) continue;
    stats.totalStockValue += p.stock * (p.costPrice ?? p.price);
    if (p.stock <= 0) stats.outOfStockCount++;
    else if (p.reorderLevel != null && p.stock <= p.reorderLevel) {
      stats.lowStockCount++;
    }
  }
  stats.totalStockValue = Math.round(stats.totalStockValue * 100) / 100;
  return stats;
}
