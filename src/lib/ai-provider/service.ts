// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — AI Memory Firestore Service (CLIENT-SAFE)
//
// The client-safe service layer for the `ai_memory` Firestore collection.
// Mirrors the banking-provider/gstn-provider service pattern:
//   • All queries are scoped by `organizationId` (the Firestore rules enforce
//     this — the legacy `firmId` field is NOT used here).
//   • Real-time onSnapshot subscriptions for live insight/recommendation feeds.
//   • Pure snapshot converters (Timestamp → ISO string).
//   • `assertOrg` guard on every write.
//
// This service is CLIENT-SAFE — it uses the Firebase client SDK which works in
// both browser and Node (server). It is imported by hooks (client) AND by the
// orchestrator (server) for persistence. The provider implementations live in
// `server/` and never import this file directly — the orchestrator does.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as limitFn,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AIMemoryError } from './errors';
import type { AIMemory, AIMemorySource, AIMemoryType } from './types';

// ─── Collection ───────────────────────────────────────────────────────────────

export const AI_COLLECTIONS = {
  MEMORY: 'ai_memory',
} as const;

// ─── Org guard ────────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new AIMemoryError(
      'You must belong to an organization to use AI memory.',
    );
  }
}

// ─── Snapshot converter ───────────────────────────────────────────────────────

/**
 * Convert a raw Firestore snapshot into an AIMemory object.
 * Handles Timestamp → ISO string conversion and null-safe coercion.
 */
export function toMemory(id: string, raw: Record<string, unknown>): AIMemory {
  const created = raw.createdAt;
  const updated = raw.updatedAt;
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    type: (raw.type as AIMemoryType) ?? 'fact',
    source: (raw.source as AIMemorySource) ?? 'system',
    summary: String(raw.summary ?? ''),
    embeddingPlaceholder: String(raw.embeddingPlaceholder ?? ''),
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    createdAt: toISO(created),
    updatedAt: toISO(updated),
  };
}

function toISO(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  try {
    return new Date(value as string).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Subscribe to all AI memory for an organization, newest first.
 * Real-time — the callback fires on every change.
 */
export function subscribeToMemories(
  organizationId: string,
  callback: (memories: AIMemory[]) => void,
  options?: { type?: AIMemoryType; limitCount?: number },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.type) {
    constraints.unshift(where('type', '==', options.type));
  }
  if (options?.limitCount) {
    constraints.push(limitFn(options.limitCount));
  }
  const q = query(collection(db, AI_COLLECTIONS.MEMORY), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const memories = snap.docs.map((d) => toMemory(d.id, d.data() as Record<string, unknown>));
      callback(memories);
    },
    (err) => {
      console.error('[ai-provider] subscribeToMemories error:', err);
      callback([]);
    },
  );
}

/**
 * Subscribe to memory of a specific type (e.g. 'insight', 'recommendation').
 */
export function subscribeToMemoriesByType(
  organizationId: string,
  type: AIMemoryType,
  callback: (memories: AIMemory[]) => void,
  limitCount = 50,
): Unsubscribe {
  return subscribeToMemories(organizationId, callback, { type, limitCount });
}

/**
 * One-shot read of all AI memory for an organization.
 */
export async function getMemories(
  organizationId: string,
  options?: { type?: AIMemoryType; limitCount?: number; source?: AIMemorySource },
): Promise<AIMemory[]> {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.source) {
    constraints.unshift(where('source', '==', options.source));
  }
  if (options?.type) {
    constraints.unshift(where('type', '==', options.type));
  }
  if (options?.limitCount) {
    constraints.push(limitFn(options.limitCount));
  }
  const q = query(collection(db, AI_COLLECTIONS.MEMORY), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMemory(d.id, d.data() as Record<string, unknown>));
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Create a new AI memory entry. Returns the new doc id.
 */
export async function saveMemory(
  organizationId: string,
  data: Omit<AIMemory, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Promise<string> {
  assertOrg(organizationId);
  const now = new Date().toISOString();
  const payload = {
    organizationId,
    type: data.type,
    source: data.source,
    summary: data.summary,
    embeddingPlaceholder: data.embeddingPlaceholder || hashSummary(data.summary),
    metadata: data.metadata ?? {},
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
  };
  const ref = await addDoc(collection(db, AI_COLLECTIONS.MEMORY), payload);
  return ref.id;
}

/**
 * Update an existing AI memory entry.
 */
export async function updateMemory(
  organizationId: string,
  memoryId: string,
  patch: Partial<Omit<AIMemory, 'id' | 'organizationId' | 'createdAt'>>,
): Promise<void> {
  assertOrg(organizationId);
  const cleanPatch: Record<string, unknown> = { ...patch, updatedAt: new Date().toISOString() };
  // Never allow orgId to change.
  delete (cleanPatch as { organizationId?: unknown }).organizationId;
  delete (cleanPatch as { id?: unknown }).id;
  delete (cleanPatch as { createdAt?: unknown }).createdAt;
  await updateDoc(doc(db, AI_COLLECTIONS.MEMORY, memoryId), cleanPatch);
}

/**
 * Delete an AI memory entry. Idempotent.
 */
export async function deleteMemory(organizationId: string, memoryId: string): Promise<void> {
  assertOrg(organizationId);
  await deleteDoc(doc(db, AI_COLLECTIONS.MEMORY, memoryId));
}

/**
 * Upsert a memory by a natural key (type + a key field in metadata).
 * Used by the orchestrator to de-duplicate insights/recommendations across
 * re-analysis runs — if the same insight already exists, update it; else create.
 */
export async function upsertMemory(
  organizationId: string,
  naturalKey: string,
  data: Omit<AIMemory, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(organizationId);
  // Look for an existing memory with the same organizationId + embeddingPlaceholder.
  const q = query(
    collection(db, AI_COLLECTIONS.MEMORY),
    where('organizationId', '==', organizationId),
    where('embeddingPlaceholder', '==', naturalKey),
    limitFn(1),
  );
  const existing = await getDocs(q);
  const now = new Date().toISOString();
  if (!existing.empty) {
    const ref = existing.docs[0];
    await updateDoc(ref.ref, {
      type: data.type,
      source: data.source,
      summary: data.summary,
      metadata: data.metadata ?? {},
      updatedAt: now,
    });
    return ref.id;
  }
  const payload = {
    organizationId,
    type: data.type,
    source: data.source,
    summary: data.summary,
    embeddingPlaceholder: naturalKey,
    metadata: data.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, AI_COLLECTIONS.MEMORY), payload);
  return ref.id;
}

/**
 * Delete all memory of a given type for an organization. Used by the
 * orchestrator to refresh insights/recommendations (clear stale, write fresh).
 */
export async function clearMemoriesByType(
  organizationId: string,
  type: AIMemoryType,
): Promise<number> {
  assertOrg(organizationId);
  const q = query(
    collection(db, AI_COLLECTIONS.MEMORY),
    where('organizationId', '==', organizationId),
    where('type', '==', type),
  );
  const snap = await getDocs(q);
  const batch: Promise<void>[] = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(batch);
  return snap.size;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deterministic hash of a summary string — used as the embeddingPlaceholder
 * for de-duplication. FNV-1a 32-bit.
 */
export function hashSummary(summary: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < summary.length; i++) {
    hash ^= summary.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
