// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Customers Firestore Service
//
// CRUD + real-time subscription for customer documents at:
//   organizations/{organizationId}/customers/{customerId}
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
  setDoc,
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
  CUSTOMERS_SUB,
  STATE_CODES,
} from './config';
import { validateGstin } from './gst';
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Firestore snapshot into a typed Customer. */
function toCustomer(id: string, raw: Record<string, unknown>): Customer {
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
    type: (raw.type as Customer['type']) ?? 'business',
    gstin: (raw.gstin as string | null) ?? null,
    pan: (raw.pan as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    state: (raw.state as string | null) ?? null,
    stateCode: (raw.stateCode as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    totalBilled: Number(raw.totalBilled ?? 0),
    totalPaid: Number(raw.totalPaid ?? 0),
    balance: Number(raw.balance ?? 0),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

/** Build the Firestore payload for a create/update. */
function buildPayload(input: CreateCustomerInput) {
  const state = input.state?.trim() || null;
  // Auto-derive stateCode from state if not provided.
  let stateCode = input.stateCode?.trim() || null;
  if (state && !stateCode && state in STATE_CODES) {
    stateCode = STATE_CODES[state];
  }
  const gstin = input.gstin?.trim().toUpperCase() || null;
  return {
    name: input.name.trim(),
    type: input.type ?? 'business',
    gstin,
    pan: input.pan?.trim().toUpperCase() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    state,
    stateCode,
    notes: input.notes?.trim() || null,
  };
}

/** No-op unsubscribe — returned when organizationId is null (preview mode). */
const noopUnsubscribe: Unsubscribe = () => {};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL customers in real-time (onSnapshot) for the given org.
 * Calls `onData` with a fresh sorted array whenever anything changes.
 * Returns an unsubscribe function.
 *
 * If `organizationId` is null/empty (preview mode / no org), calls onData([])
 * immediately and returns a no-op unsubscribe — does NOT touch Firestore.
 */
export function subscribeCustomers(
  organizationId: string | null | undefined,
  onData: (customers: Customer[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = orgCollectionPath(organizationId, CUSTOMERS_SUB);
  if (!path) {
    // No org → honest empty state, no Firestore read, no permission error.
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
      const list: Customer[] = [];
      snap.forEach((d) => list.push(toCustomer(d.id, d.data() as Record<string, unknown>)));
      onData(list);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch a single customer by id (one-shot). */
export async function getCustomer(
  organizationId: string | null | undefined,
  id: string,
): Promise<Customer | null> {
  const path = orgDocPath(organizationId, CUSTOMERS_SUB, id);
  if (!path) return null;
  const snap = await getDoc(doc(db, path));
  if (!snap.exists()) return null;
  return toCustomer(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Fetch ALL customers in one shot (server-side / API-route friendly).
 * Use this when you need a snapshot without a real-time listener (e.g. Oracle).
 * Returns an empty array on permission-denied / unavailable / no org.
 */
export async function getCustomersOnce(
  organizationId: string | null | undefined,
): Promise<Customer[]> {
  const path = orgCollectionPath(organizationId, CUSTOMERS_SUB);
  if (!path) return [];
  try {
    const q = query(collection(db, path), orderBy('name'));
    const snap = await getDocs(q);
    const list: Customer[] = [];
    snap.forEach((d) => list.push(toCustomer(d.id, d.data() as Record<string, unknown>)));
    return list;
  } catch {
    return [];
  }
}

/**
 * Create a new customer document in the given org's subcollection.
 * Throws on validation errors. Returns the created Customer.
 *
 * If organizationId is null/empty, throws a friendly error — the caller
 * must resolve the org context before creating.
 */
export async function createCustomer(
  organizationId: string | null | undefined,
  input: CreateCustomerInput,
): Promise<Customer> {
  const path = orgCollectionPath(organizationId, CUSTOMERS_SUB);
  if (!path) {
    throw new Error(
      'Unable to save customer.\n\nReason: No organization is currently selected. ' +
      'Please sign in and select an organization, then try again.',
    );
  }

  const name = input.name?.trim();
  if (!name) throw new Error('Customer name is required.');

  const gstinError = validateGstin(input.gstin ?? null);
  if (gstinError) throw new Error(gstinError);

  const payload = buildPayload(input);
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, path), {
    ...payload,
    totalBilled: 0,
    totalPaid: 0,
    balance: 0,
    createdAt: now,
    updatedAt: now,
  });

  const snap = await getDoc(ref);
  return toCustomer(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Update an existing customer. Merges the patch; re-validates GSTIN.
 */
export async function updateCustomer(
  organizationId: string | null | undefined,
  id: string,
  patch: UpdateCustomerInput,
): Promise<Customer> {
  const path = orgDocPath(organizationId, CUSTOMERS_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to update customer.\n\nReason: No organization is currently selected.',
    );
  }

  const gstinError = validateGstin(patch.gstin ?? null);
  if (gstinError) throw new Error(gstinError);

  const update: Record<string, unknown> = {};
  const built = buildPayload({
    name: patch.name ?? '__NOOP__',
    ...patch,
  } as CreateCustomerInput);
  // Only include fields that were explicitly provided in the patch.
  if (patch.name !== undefined) update.name = built.name;
  if (patch.type !== undefined) update.type = built.type;
  if (patch.gstin !== undefined) update.gstin = built.gstin;
  if (patch.pan !== undefined) update.pan = built.pan;
  if (patch.email !== undefined) update.email = built.email;
  if (patch.phone !== undefined) update.phone = built.phone;
  if (patch.address !== undefined) update.address = built.address;
  if (patch.state !== undefined) {
    update.state = built.state;
    update.stateCode = built.stateCode;
  }
  if (patch.stateCode !== undefined) update.stateCode = built.stateCode;
  if (patch.notes !== undefined) update.notes = built.notes;
  update.updatedAt = serverTimestamp();

  await updateDoc(doc(db, path), update);
  const snap = await getDoc(doc(db, path));
  return toCustomer(snap.id, snap.data() as Record<string, unknown>);
}

/** Permanently delete a customer. */
export async function deleteCustomer(
  organizationId: string | null | undefined,
  id: string,
): Promise<void> {
  const path = orgDocPath(organizationId, CUSTOMERS_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to delete customer.\n\nReason: No organization is currently selected.',
    );
  }
  await deleteDoc(doc(db, path));
}

// ─── Search (client-side filter — keeps it simple + offline-friendly) ────────

/**
 * Filter a customer list by a free-text query. Matches name / email / phone /
 * gstin / state. Case-insensitive.
 */
export function searchCustomers(
  customers: Customer[],
  queryText: string,
): Customer[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return customers;
  return customers.filter((c) =>
    [c.name, c.email, c.phone, c.gstin, c.state, c.pan]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}
