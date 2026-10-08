// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Vendors Firestore Service
//
// CRUD + real-time subscription for vendor documents at:
//   organizations/{organizationId}/vendors/{vendorId}
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
  VENDORS_SUB,
  STATE_CODES,
} from './config';
import { validateGstin } from './gst';
import type {
  Vendor,
  CreateVendorInput,
  UpdateVendorInput,
  VendorStats,
  VendorCategory,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VENDOR_CATEGORIES: VendorCategory[] = [
  'Supplier',
  'Contractor',
  'Service Provider',
  'Freelancer',
  'Utility',
  'Other',
];

function normalizeCategory(v: unknown): VendorCategory {
  const s = String(v ?? 'Other') as VendorCategory;
  return VENDOR_CATEGORIES.includes(s) ? s : 'Other';
}

function toVendor(id: string, raw: Record<string, unknown>): Vendor {
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
    type: (raw.type as Vendor['type']) ?? 'business',
    gstin: (raw.gstin as string | null) ?? null,
    pan: (raw.pan as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    state: (raw.state as string | null) ?? null,
    stateCode: (raw.stateCode as string | null) ?? null,
    category: normalizeCategory(raw.category),
    contactPerson: (raw.contactPerson as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    totalBilled: Number(raw.totalBilled ?? 0),
    totalPaid: Number(raw.totalPaid ?? 0),
    balance: Number(raw.balance ?? 0),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

function buildPayload(input: CreateVendorInput) {
  const state = input.state?.trim() || null;
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
    category: input.category ?? 'Other',
    contactPerson: input.contactPerson?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

/** No-op unsubscribe — returned when organizationId is null (preview mode). */
const noopUnsubscribe: Unsubscribe = () => {};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL vendors in real-time (onSnapshot) for the given org.
 *
 * If `organizationId` is null/empty (preview mode / no org), calls onData([])
 * immediately and returns a no-op unsubscribe — does NOT touch Firestore.
 */
export function subscribeVendors(
  organizationId: string | null | undefined,
  onData: (vendors: Vendor[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = orgCollectionPath(organizationId, VENDORS_SUB);
  if (!path) {
    onData([]);
    return noopUnsubscribe;
  }

  const q = query(collection(db, path), orderBy('name'));
  return onSnapshot(
    q,
    (snap) => {
      const list: Vendor[] = [];
      snap.forEach((d) => list.push(toVendor(d.id, d.data() as Record<string, unknown>)));
      onData(list);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch a single vendor by id (one-shot). */
export async function getVendor(
  organizationId: string | null | undefined,
  id: string,
): Promise<Vendor | null> {
  const path = orgDocPath(organizationId, VENDORS_SUB, id);
  if (!path) return null;
  const snap = await getDoc(doc(db, path));
  if (!snap.exists()) return null;
  return toVendor(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Fetch ALL vendors in one shot (server-side / API-route friendly).
 * Returns an empty array on permission-denied / unavailable / no org.
 */
export async function getVendorsOnce(
  organizationId: string | null | undefined,
): Promise<Vendor[]> {
  const path = orgCollectionPath(organizationId, VENDORS_SUB);
  if (!path) return [];
  try {
    const q = query(collection(db, path), orderBy('name'));
    const snap = await getDocs(q);
    const list: Vendor[] = [];
    snap.forEach((d) => list.push(toVendor(d.id, d.data() as Record<string, unknown>)));
    return list;
  } catch {
    return [];
  }
}

/**
 * Create a new vendor in the given org's subcollection.
 * Throws on validation errors. Returns the created Vendor.
 *
 * If organizationId is null/empty, throws a friendly error — the caller
 * must resolve the org context before creating.
 */
export async function createVendor(
  organizationId: string | null | undefined,
  input: CreateVendorInput,
): Promise<Vendor> {
  const path = orgCollectionPath(organizationId, VENDORS_SUB);
  if (!path) {
    throw new Error(
      'Unable to save vendor.\n\nReason: No organization is currently selected. ' +
      'Please sign in and select an organization, then try again.',
    );
  }

  const name = input.name?.trim();
  if (!name) throw new Error('Vendor name is required.');

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
  return toVendor(snap.id, snap.data() as Record<string, unknown>);
}

/** Update an existing vendor. Merges the patch; re-validates GSTIN. */
export async function updateVendor(
  organizationId: string | null | undefined,
  id: string,
  patch: UpdateVendorInput,
): Promise<Vendor> {
  const path = orgDocPath(organizationId, VENDORS_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to update vendor.\n\nReason: No organization is currently selected.',
    );
  }

  const gstinError = validateGstin(patch.gstin ?? null);
  if (gstinError) throw new Error(gstinError);

  const update: Record<string, unknown> = {};
  const built = buildPayload({
    name: patch.name ?? '__NOOP__',
    ...patch,
  } as CreateVendorInput);
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
  if (patch.category !== undefined) update.category = built.category;
  if (patch.contactPerson !== undefined) update.contactPerson = built.contactPerson;
  if (patch.notes !== undefined) update.notes = built.notes;
  update.updatedAt = serverTimestamp();

  await updateDoc(doc(db, path), update);
  const snap = await getDoc(doc(db, path));
  return toVendor(snap.id, snap.data() as Record<string, unknown>);
}

/** Permanently delete a vendor. */
export async function deleteVendor(
  organizationId: string | null | undefined,
  id: string,
): Promise<void> {
  const path = orgDocPath(organizationId, VENDORS_SUB, id);
  if (!path) {
    throw new Error(
      'Unable to delete vendor.\n\nReason: No organization is currently selected.',
    );
  }
  await deleteDoc(doc(db, path));
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function searchVendors(vendors: Vendor[], queryText: string): Vendor[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return vendors;
  return vendors.filter((v) =>
    [v.name, v.gstin, v.email, v.phone, v.state, v.pan, v.category, v.contactPerson]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}
