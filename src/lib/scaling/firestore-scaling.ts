// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Firestore Scaling Layer (SERVER-ONLY)
//
// A collection of scaling helpers for Firestore:
//   • Deterministic sharding (write-spread for hot documents / counters)
//   • Batched writes with bounded concurrency (500-op Firestore limit)
//   • Bulk reads via getAll() (500-doc chunks)
//   • Distributed sharded counters (increment + sum)
//   • TTL in-memory cache with stale-while-revalidate
//   • Ref-counted onSnapshot listener multiplexer (debounce + throttle)
//
// All helpers use the Admin SDK singleton (`adminDb()` from `@/lib/firebase-admin`).
// NEVER import this module from client code — it bypasses security rules.
// ═══════════════════════════════════════════════════════════════════════════════

import { FieldValue, type DocumentReference, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WriteOpType = 'set' | 'update' | 'delete';

export interface WriteOp {
  type: WriteOpType;
  ref: DocumentReference<DocumentData>;
  data?: Record<string, unknown>;
}

export interface BatchedWriteResult {
  batches: number;
  succeeded: number;
  failed: number;
  errors: Array<{ opIndex: number; error: string }>;
}

export interface BatchedWriteOptions {
  maxBatchSize?: number;
  concurrency?: number;
}

export interface ShardedCounterOpts {
  shards?: number;
  field?: string;
}

// Firestore hard limit per batch.
const FIRESTORE_BATCH_LIMIT = 500;

// ─── Sharding ────────────────────────────────────────────────────────────────

/**
 * Deterministic hash → shard index in [0, shards-1].
 *
 * Uses a 32-bit FNV-1a hash so the same key always lands on the same shard —
 * this lets readers know which shard holds a given entity's data without
 * scanning all shards.
 */
export function shardId(key: string, shards: number = 10): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    // 32-bit multiply with FNV prime.
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned 32-bit then modulo.
  const u32 = hash >>> 0;
  return u32 % Math.max(1, shards);
}

/**
 * Returns the sharded collection name for a given key.
 * Example: shardedCollectionName('counters', 'org_123', 10) → 'counters_shard_3'
 */
export function shardedCollectionName(
  base: string,
  key: string,
  shards: number = 10,
): string {
  return `${base}_shard_${shardId(key, shards)}`;
}

// ─── Batched Writes ──────────────────────────────────────────────────────────

/**
 * Splits a list of WriteOps into 500-op batches and runs them with bounded
 * concurrency. On partial failure, continues and reports errors per-op.
 *
 * Default maxBatchSize=500 (Firestore limit), default concurrency=4.
 */
export async function batchedWrite(
  ops: WriteOp[],
  opts: BatchedWriteOptions = {},
): Promise<BatchedWriteResult> {
  const maxBatchSize = Math.min(opts.maxBatchSize ?? FIRESTORE_BATCH_LIMIT, FIRESTORE_BATCH_LIMIT);
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const errors: Array<{ opIndex: number; error: string }> = [];
  let succeeded = 0;
  let failed = 0;

  // Pre-slice into batches of (maxBatchSize) ops each, tracking original indices.
  const batches: Array<{ ops: WriteOp[]; baseIndex: number }> = [];
  for (let i = 0; i < ops.length; i += maxBatchSize) {
    batches.push({ ops: ops.slice(i, i + maxBatchSize), baseIndex: i });
  }

  // Runner that processes a single batch — each op committed atomically.
  const runBatch = async (batch: { ops: WriteOp[]; baseIndex: number }): Promise<void> => {
    const db = adminDb();
    const writeBatch = db.batch();
    for (const op of batch.ops) {
      if (op.type === 'set') {
        writeBatch.set(op.ref, op.data ?? {});
      } else if (op.type === 'update') {
        writeBatch.update(op.ref, op.data ?? {});
      } else if (op.type === 'delete') {
        writeBatch.delete(op.ref);
      }
    }
    try {
      await writeBatch.commit();
      succeeded += batch.ops.length;
    } catch (err) {
      // Whole batch failed — attribute failure to each op in the batch.
      const msg = err instanceof Error ? err.message : String(err);
      for (let j = 0; j < batch.ops.length; j++) {
        errors.push({ opIndex: batch.baseIndex + j, error: msg });
      }
      failed += batch.ops.length;
    }
  };

  // Bounded-concurrency scheduler.
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        while (cursor < batches.length) {
          const idx = cursor++;
          await runBatch(batches[idx]);
        }
      })(),
    );
  }
  await Promise.all(workers);

  return {
    batches: batches.length,
    succeeded,
    failed,
    errors,
  };
}

// ─── Bulk Reads ──────────────────────────────────────────────────────────────

/**
 * Bulk-read up to N document references via getAll(), chunked at 500 per call
 * (Firestore limit) and run in parallel. Returns `null` for missing docs,
 * aligned to the input array order.
 */
export async function bulkRead<T = DocumentData>(
  refs: DocumentReference<T>[],
): Promise<(T | null)[]> {
  if (refs.length === 0) return [];

  const CHUNK = 500;
  const chunks: DocumentReference<T>[][] = [];
  for (let i = 0; i < refs.length; i += CHUNK) {
    chunks.push(refs.slice(i, i + CHUNK));
  }

  const db = adminDb();
  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const snaps = await db.getAll<T>(...chunk);
      return snaps.map((snap) => (snap.exists ? (snap.data() as T) : null));
    }),
  );

  // Flatten back into the original order.
  return chunkResults.flat();
}

// ─── Distributed Sharded Counters ────────────────────────────────────────────

/**
 * Read a distributed counter (sum across all shards).
 *
 * Layout:
 *   collection `${collection}_shard_${i}` / doc `${docId}` / field `${field}`
 * where i ∈ [0, shards-1] and field defaults to 'count'.
 */
export async function getCounter(
  collection: string,
  docId: string,
  shards: number = 10,
): Promise<number> {
  const db = adminDb();
  const refs: DocumentReference<DocumentData>[] = [];
  for (let i = 0; i < shards; i++) {
    refs.push(db.collection(`${collection}_shard_${i}`).doc(docId));
  }
  const snaps = await db.getAll(...refs);
  let total = 0;
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as Record<string, unknown> | undefined;
    const val = data?.count;
    if (typeof val === 'number') total += val;
  }
  return total;
}

/**
 * Pick a random shard and increment its counter — avoids contention on a
 * single document under heavy write load.
 *
 * Default delta = 1, default shards = 10.
 */
export async function incrementCounter(
  collection: string,
  docId: string,
  shards: number = 10,
  delta: number = 1,
): Promise<void> {
  const shard = Math.floor(Math.random() * shards);
  const db = adminDb();
  const ref = db.collection(`${collection}_shard_${shard}`).doc(docId);
  await ref.set(
    { count: FieldValue.increment(delta) } as DocumentData,
    { merge: true },
  );
}

// ─── Hot Document (sharded aggregate read / increment) ───────────────────────

/**
 * Read a sharded hot document — combines the `field` across all shards by
 * summation. Pair with `hotDocumentIncrement` for contention-free writes.
 */
export async function hotDocumentRead(
  collection: string,
  docId: string,
  opts: ShardedCounterOpts = {},
): Promise<Record<string, number>> {
  const shards = opts.shards ?? 10;
  const field = opts.field ?? 'count';
  const db = adminDb();
  const refs: DocumentReference<DocumentData>[] = [];
  for (let i = 0; i < shards; i++) {
    refs.push(db.collection(`${collection}_shard_${i}`).doc(docId));
  }
  const snaps = await db.getAll(...refs);

  const aggregate: Record<string, number> = { [field]: 0 };
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as Record<string, unknown> | undefined;
    const v = data?.[field];
    if (typeof v === 'number') aggregate[field] += v;
  }
  return aggregate;
}

/**
 * Increment a single (random) shard for a hot document's field.
 * Returns the shard index that was written to.
 */
export async function hotDocumentIncrement(
  collection: string,
  docId: string,
  field: string,
  delta: number,
  shards: number = 10,
): Promise<number> {
  const shard = Math.floor(Math.random() * shards);
  const db = adminDb();
  const ref = db.collection(`${collection}_shard_${shard}`).doc(docId);
  await ref.set(
    { [field]: FieldValue.increment(delta) } as DocumentData,
    { merge: true },
  );
  return shard;
}

// ─── TTL In-Memory Cache (SWR) ───────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // epoch ms
  refreshing?: boolean;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();

/**
 * TTL in-memory cache with stale-while-revalidate semantics.
 *
 *   - Cache hit (fresh)    → return cached value
 *   - Cache hit (stale)    → return cached value AND trigger background refresh
 *   - Cache miss           → call loader, store, return
 *
 * Persisted nowhere — process-local Map. A new serverless instance starts cold.
 */
export async function readCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const now = Date.now();
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (existing) {
    const fresh = existing.expiresAt > now;
    if (fresh) return existing.value;

    // Stale — return immediately but refresh in background (SWR).
    if (!existing.refreshing) {
      existing.refreshing = true;
      void loader()
        .then((value) => {
          cacheStore.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
            refreshing: false,
          });
        })
        .catch(() => {
          existing.refreshing = false;
        });
    }
    return existing.value;
  }

  // Cache miss — load synchronously (caller waits).
  const value = await loader();
  cacheStore.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Invalidate a cache entry by key. */
export function invalidateCache(key: string): void {
  cacheStore.delete(key);
}

/** Clear the entire cache (test/admin helper). */
export function clearCacheStore(): void {
  cacheStore.clear();
}

// ─── Ref-counted onSnapshot Listener Multiplexer ────────────────────────────

interface ListenerEntry {
  refCount: number;
  unsubscribe: () => void;
  lastEmit: number;
  pendingSnapshot: unknown | null;
  callbacks: Set<(snap: unknown) => void>;
  debounceTimer: NodeJS.Timeout | null;
  throttleLastEmit: number;
}

const listenerRegistry = new Map<string, ListenerEntry>();

export interface ListenerOpts {
  debounceMs?: number;
  throttleMs?: number;
}

/**
 * Wrap `onSnapshot` with debounce + throttle and ref-count the underlying
 * subscription so multiple callers for the same query share one socket.
 *
 * `queryFn` receives the admin Firestore instance and returns a Query.
 *
 * Returns an `unsubscribe` function — when the last caller unsubscribes, the
 * underlying listener is torn down.
 */
export function optimizeListener(
  collection: string,
  queryFn: (db: ReturnType<typeof adminDb>) => ReturnType<ReturnType<typeof adminDb>['collection']>,
  callback: (snap: unknown) => void,
  opts: ListenerOpts = {},
): () => void {
  const debounceMs = opts.debounceMs ?? 100;
  const throttleMs = opts.throttleMs ?? 200;
  // Use collection name as the multiplex key. For finer-grained multiplexing,
  // callers can pass an already-unique string (e.g. collection + JSON of where
  // clauses) as the `collection` argument.
  const key = collection;

  let entry = listenerRegistry.get(key);
  if (!entry) {
    entry = {
      refCount: 0,
      unsubscribe: () => {},
      lastEmit: 0,
      pendingSnapshot: null,
      callbacks: new Set(),
      debounceTimer: null,
      throttleLastEmit: 0,
    };
    listenerRegistry.set(key, entry);

    const db = adminDb();
    const q = queryFn(db);
    entry.unsubscribe = q.onSnapshot(
      (snap) => {
        if (!entry) return;
        entry.pendingSnapshot = snap;
        // Debounce: coalesce rapid bursts into one emit.
        if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
        entry.debounceTimer = setTimeout(() => {
          if (!entry) return;
          const now = Date.now();
          // Throttle: enforce minimum spacing between emits.
          if (now - entry.throttleLastEmit < throttleMs) {
            // Re-schedule for after the throttle window.
            entry.debounceTimer = setTimeout(() => {
              if (!entry) return;
              entry.throttleLastEmit = Date.now();
              entry.lastEmit = entry.throttleLastEmit;
              const snapToEmit = entry.pendingSnapshot;
              for (const cb of entry.callbacks) {
                try {
                  cb(snapToEmit);
                } catch {
                  /* swallow callback errors */
                }
              }
            }, throttleMs);
            return;
          }
          entry.throttleLastEmit = now;
          entry.lastEmit = now;
          const snapToEmit = entry.pendingSnapshot;
          for (const cb of entry.callbacks) {
            try {
              cb(snapToEmit);
            } catch {
              /* swallow callback errors */
            }
          }
        }, debounceMs);
      },
      (err) => {
        console.error(`[firestore-scaling] onSnapshot error for "${key}":`, err);
      },
    );
  }

  entry.refCount++;
  entry.callbacks.add(callback);

  // Return unsubscribe fn for this caller.
  return () => {
    const e = listenerRegistry.get(key);
    if (!e) return;
    e.callbacks.delete(callback);
    e.refCount = Math.max(0, e.refCount - 1);
    if (e.refCount === 0) {
      try {
        e.unsubscribe();
      } catch {
        /* already unsubscribed */
      }
      if (e.debounceTimer) clearTimeout(e.debounceTimer);
      listenerRegistry.delete(key);
    }
  };
}

/** Inspect the live listener registry (admin/debug helper). */
export function getListenerRegistryStats(): Array<{ key: string; refCount: number; lastEmit: number }> {
  return Array.from(listenerRegistry.entries()).map(([key, e]) => ({
    key,
    refCount: e.refCount,
    lastEmit: e.lastEmit,
  }));
}
