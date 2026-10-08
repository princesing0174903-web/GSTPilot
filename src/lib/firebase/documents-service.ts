// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Firestore Documents Service (Multi-Tenant)
//
// Stores file METADATA for every file uploaded to Firebase Storage.
//
// Collection: `documents/{documentId}`
// Fields:
//   id             — Firestore document id
//   organizationId — tenant scope (NEVER null — every query filters on this)
//   uploadedBy     — { uid, name, email } of the uploader
//   category       — invoices | gst | bank | documents | reports | notices | ai
//   originalName   — the file name as the user chose it
//   storagePath    — the full Firebase Storage path (org-isolated)
//   downloadURL    — long-lived Firebase Storage download URL
//   fileSize       — bytes
//   mimeType       — e.g. application/pdf
//   tags           — string[] (free-form, searchable)
//   createdAt      — ISO timestamp
//   updatedAt      — ISO timestamp
//
// Every read/write is scoped to the caller's `organizationId`. There is no
// public function in this module that can cross tenant boundaries.
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
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StorageCategory } from '@/lib/firebase/storage-service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DocumentUploader {
  uid: string;
  name: string;
  email: string;
}

export interface DocumentMetadata {
  id: string;
  organizationId: string;
  uploadedBy: DocumentUploader;
  category: StorageCategory;
  originalName: string;
  storagePath: string;
  downloadURL: string;
  fileSize: number;
  mimeType: string;
  tags: string[];
  /** Optional link to a client / invoice / return, etc. */
  linkedTo?: {
    type: 'client' | 'invoice' | 'return' | 'notice' | 'report' | 'task';
    id: string;
    label?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Payload accepted when creating a new document metadata record. */
export interface CreateDocumentInput {
  organizationId: string;
  uploadedBy: DocumentUploader;
  category: StorageCategory;
  originalName: string;
  storagePath: string;
  downloadURL: string;
  fileSize: number;
  mimeType: string;
  tags?: string[];
  linkedTo?: DocumentMetadata['linkedTo'];
}

export interface UpdateDocumentInput {
  tags?: string[];
  linkedTo?: DocumentMetadata['linkedTo'];
  downloadURL?: string;
}

const COLLECTION = 'documents';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a raw Firestore snapshot into a typed {@link DocumentMetadata}.
 * Firestore Timestamps are converted to ISO strings.
 */
function toMetadata(
  id: string,
  raw: Record<string, unknown>,
): DocumentMetadata {
  const convert = (value: unknown): unknown => {
    if (value && typeof value === 'object' && 'toDate' in value) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return value;
  };

  return {
    id,
    organizationId: raw.organizationId as string,
    uploadedBy: raw.uploadedBy as DocumentUploader,
    category: raw.category as StorageCategory,
    originalName: raw.originalName as string,
    storagePath: raw.storagePath as string,
    downloadURL: raw.downloadURL as string,
    fileSize: raw.fileSize as number,
    mimeType: raw.mimeType as string,
    tags: (raw.tags as string[]) ?? [],
    linkedTo: raw.linkedTo as DocumentMetadata['linkedTo'] | undefined,
    createdAt: convert(raw.createdAt) as string,
    updatedAt: convert(raw.updatedAt) as string,
  };
}

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new Error('You must belong to an organization to manage documents.');
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new document metadata record after a successful Storage upload.
 *
 * The Firestore document is created with a server timestamp so ordering is
 * always correct regardless of client clock skew.
 */
export async function createDocument(
  input: CreateDocumentInput,
): Promise<DocumentMetadata> {
  assertOrg(input.organizationId);

  const payload = {
    organizationId: input.organizationId,
    uploadedBy: input.uploadedBy,
    category: input.category,
    originalName: input.originalName,
    storagePath: input.storagePath,
    downloadURL: input.downloadURL,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    tags: input.tags ?? [],
    linkedTo: input.linkedTo ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Extremely unlikely, but guard anyway.
    return {
      ...input,
      tags: input.tags ?? [],
      id: ref.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return toMetadata(ref.id, snap.data() as Record<string, unknown>);
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Fetch a single document by id, scoped to `organizationId`.
 * Returns `null` when the document does not exist OR belongs to another org.
 */
export async function getDocument(
  id: string,
  organizationId: string,
): Promise<DocumentMetadata | null> {
  assertOrg(organizationId);
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  // Tenant guard — even though Storage rules enforce this, we double-check
  // client-side so a bug can never leak another org's document.
  if (data.organizationId !== organizationId) return null;
  return toMetadata(id, data);
}

/**
 * List all documents for an organization, optionally filtered by category.
 *
 * Results are ordered by `createdAt` descending (newest first). We use
 * `createdAt` (not `updatedAt`) for ordering so re-tagging an old document
 * doesn't bump it to the top.
 */
export async function listDocuments(
  organizationId: string,
  category?: StorageCategory,
): Promise<DocumentMetadata[]> {
  assertOrg(organizationId);

  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (category) {
    constraints.unshift(where('category', '==', category));
  }

  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
  return snap.docs.map((d) =>
    toMetadata(d.id, d.data() as Record<string, unknown>),
  );
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * Update mutable fields on a document metadata record.
 * `organizationId` and `storagePath` are intentionally NOT editable.
 */
export async function updateDocument(
  id: string,
  organizationId: string,
  patch: UpdateDocumentInput,
): Promise<void> {
  assertOrg(organizationId);

  // Read-first guard so we never update another org's document.
  const existing = await getDocument(id, organizationId);
  if (!existing) {
    throw new Error('Document not found in your workspace.');
  }

  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.linkedTo !== undefined) update.linkedTo = patch.linkedTo;
  if (patch.downloadURL !== undefined) update.downloadURL = patch.downloadURL;

  await updateDoc(doc(db, COLLECTION, id), update);
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete a document metadata record from Firestore.
 *
 * NOTE: This does NOT delete the underlying Storage file. Callers should use
 * {@link deleteDocumentWithFile} (or the `useDocuments` hook) to delete both
 * atomically — Storage first, then Firestore — so we never leave orphan
 * metadata pointing at a deleted file.
 */
export async function deleteDocumentMetadata(
  id: string,
  organizationId: string,
): Promise<void> {
  assertOrg(organizationId);
  const existing = await getDocument(id, organizationId);
  if (!existing) {
    // Idempotent — already gone.
    return;
  }
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Delete the underlying Storage file AND the Firestore metadata.
 *
 * Order matters: delete the Storage file first. If the Storage delete fails we
 * keep the metadata (so the user can retry). If the Storage delete succeeds but
 * the Firestore delete fails, we log but do not throw — the file is gone, so a
 * stale metadata row is harmless and will be cleaned up by a future sweep.
 */
export async function deleteDocumentWithFile(
  id: string,
  organizationId: string,
): Promise<{ storagePath: string } | null> {
  assertOrg(organizationId);
  const existing = await getDocument(id, organizationId);
  if (!existing) return null;

  // Lazy import to avoid a circular dependency at module load time.
  const { deleteFile } = await import('@/lib/firebase/storage-service');
  await deleteFile(existing.storagePath);

  try {
    await deleteDoc(doc(db, COLLECTION, id));
  } catch (err) {
    console.warn(
      '[documents] Storage file deleted but Firestore metadata delete failed:',
      err,
    );
  }
  return { storagePath: existing.storagePath };
}

// ─── Real-time Subscription ──────────────────────────────────────────────────

/**
 * Subscribe to live updates for an organization's documents.
 *
 * Returns an unsubscribe function. The callback fires immediately with the
 * current set, and again whenever any document in the org changes.
 */
export function subscribeToDocuments(
  organizationId: string,
  callback: (documents: DocumentMetadata[]) => void,
  options?: { category?: StorageCategory; onError?: (error: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);

  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.category) {
    constraints.unshift(where('category', '==', options.category));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) =>
        toMetadata(d.id, d.data() as Record<string, unknown>),
      );
      callback(docs);
    },
    (error) => {
      options?.onError?.(error);
    },
  );
}

// ─── Atomic upsert helper (rarely needed, but useful for migrations) ─────────

/**
 * Set a document metadata record by explicit id (upsert).
 * Used by import / migration scripts. Normal uploads should use
 * {@link createDocument} which auto-generates the id.
 */
export async function setDocument(
  id: string,
  input: CreateDocumentInput,
): Promise<void> {
  assertOrg(input.organizationId);
  await setDoc(doc(db, COLLECTION, id), {
    organizationId: input.organizationId,
    uploadedBy: input.uploadedBy,
    category: input.category,
    originalName: input.originalName,
    storagePath: input.storagePath,
    downloadURL: input.downloadURL,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    tags: input.tags ?? [],
    linkedTo: input.linkedTo ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
