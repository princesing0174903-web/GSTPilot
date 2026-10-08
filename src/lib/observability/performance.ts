// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Performance Monitoring
//
// Records metrics in an in-memory ring buffer (last 10 000 entries) for
// near-zero-cost instrumentation of API calls, Firestore reads/writes, and
// arbitrary function durations. The buffer is queryable for p50/p95/p99
// aggregation.
//
// Optionally, the buffer is flushed to the Firestore `performance_metrics`
// collection once per minute (batched) so that long-term trends can be
// analyzed offline.
//
// Resilience: every metric-recording path is wrapped in try/catch —
// performance monitoring must NEVER crash the request it's measuring.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricUnit = 'ms' | 'count' | 'bytes' | 'percent';

export interface PerformanceMetric {
  /** Metric name (e.g. 'api.call.duration', 'firestore.read.count'). */
  name: string;
  /** Numeric value. */
  value: number;
  /** Unit of the value. */
  unit: MetricUnit;
  /** Optional tags for grouping/filtering in the aggregator. */
  tags?: Record<string, string>;
  /** ISO-8601 timestamp (UTC). */
  timestamp: string;
}

// ─── In-memory ring buffer ────────────────────────────────────────────────────

const MAX_BUFFER_SIZE = 10_000;

const buffer: PerformanceMetric[] = [];

function pushMetric(metric: PerformanceMetric): void {
  try {
    buffer.push(metric);
    if (buffer.length > MAX_BUFFER_SIZE) {
      // Splice in chunks to amortize the cost of frequent overflows.
      buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
    }
  } catch {
    // ignore — buffer ops must never throw
  }
}

// ─── Firestore writer (batched, 1/min) ────────────────────────────────────────

const METRICS_COLLECTION = 'performance_metrics';
const FLUSH_INTERVAL_MS = 60_000; // 1 minute

interface FirestoreLike {
  collection(path: string): {
    doc(): { set: (d: unknown) => void };
  };
  batch(): {
    set(ref: unknown, data: unknown): unknown;
    commit(): Promise<unknown>;
  };
}

let adminDbCache: FirestoreLike | null = null;
let adminDbInitFailed = false;

async function getAdminDb(): Promise<FirestoreLike | null> {
  if (adminDbCache) return adminDbCache;
  if (adminDbInitFailed) return null;
  try {
    const adminModule = await import('@/lib/firebase-admin');
    const db = adminModule.adminDb();
    adminDbCache = db as unknown as FirestoreLike;
    return adminDbCache;
  } catch (err) {
    adminDbInitFailed = true;
     
    console.error('[observability/performance] firebase-admin unavailable — metrics will stay in-memory only:', err);
    return null;
  }
}

let flushTimer: ReturnType<typeof setInterval> | null = null;
let pendingFlushBatch: PerformanceMetric[] = [];

async function flushMetricsToFirestore(): Promise<void> {
  if (pendingFlushBatch.length === 0) return;
  const batch = pendingFlushBatch;
  pendingFlushBatch = [];

  const db = await getAdminDb();
  if (!db) return; // silently drop — in-memory buffer is still useful

  try {
    const writeBatch = db.batch();
    for (const metric of batch) {
      const ref = (db.collection(METRICS_COLLECTION) as unknown as { doc(): { set: (d: unknown) => void } }).doc();
      writeBatch.set(ref, metric);
    }
    await writeBatch.commit();
  } catch (err) {
     
    console.error('[observability/performance] flush failed:', err);
  }
}

/**
 * Start the periodic flush interval that drains pending metrics to
 * Firestore. Idempotent — calling twice is a no-op.
 */
export function startMetricFlushInterval(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushMetricsToFirestore().catch(() => { /* swallow */ });
  }, FLUSH_INTERVAL_MS);
  // Don't keep the Node event loop alive solely for metric flushing.
  if (flushTimer && typeof flushTimer.unref === 'function') {
    flushTimer.unref();
  }
}

/** Stop the flush interval. Test/shutdown-only. */
export function stopMetricFlushInterval(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/** Force a flush of all pending metrics. Test/shutdown-only. */
export async function flushMetrics(): Promise<void> {
  await flushMetricsToFirestore();
}

// ─── recordMetric ─────────────────────────────────────────────────────────────

/**
 * Record a single performance metric.
 *
 * Stored in the in-memory ring buffer (last 10 000 entries) and queued for
 * the next batched Firestore flush (1/min).
 *
 * Use the typed helpers (trackApiCall, trackFirestoreRead, …) for common
 * cases — they stamp the right name/unit/tags.
 */
export function recordMetric(
  name: string,
  value: number,
  unit: MetricUnit,
  tags?: Record<string, string>,
): void {
  if (!Number.isFinite(value)) return;

  const metric: PerformanceMetric = {
    name,
    value,
    unit,
    tags,
    timestamp: new Date().toISOString(),
  };

  pushMetric(metric);
  pendingFlushBatch.push(metric);
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

/**
 * Wrap an async function and record its duration + success/failure.
 *
 *   const result = await trackApiCall('invoices.list', () => listInvoices());
 *
 * Records two metrics:
 *   • `api.call.duration` (unit: ms) with tags {name, status:'success'|'failure'}
 *   • `api.call.count`    (unit: count) with tags {name, status:'success'|'failure'}
 */
export async function trackApiCall<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  let status: 'success' | 'failure' = 'success';
  try {
    return await fn();
  } catch (err) {
    status = 'failure';
    throw err;
  } finally {
    const durationMs = Date.now() - start;
    recordMetric('api.call.duration', durationMs, 'ms', { name, status });
    recordMetric('api.call.count', 1, 'count', { name, status });
  }
}

/**
 * Increment the Firestore read counter for a collection.
 *
 *   const snap = await getDocs(q);
 *   trackFirestoreRead('invoices', snap.size);
 */
export function trackFirestoreRead(collection: string, count: number): void {
  recordMetric('firestore.read.count', count, 'count', { collection });
}

/**
 * Increment the Firestore write counter for a collection.
 *
 *   await batch.commit();
 *   trackFirestoreWrite('invoices', 5);
 */
export function trackFirestoreWrite(collection: string, count: number): void {
  recordMetric('firestore.write.count', count, 'count', { collection });
}

/**
 * Record the duration of an arbitrary named function (no success/failure
 * tracking — for that, use `trackApiCall`).
 *
 *   const t = Date.now();
 *   doSyncWork();
 *   trackFunctionDuration('heavy.compute', Date.now() - t);
 */
export function trackFunctionDuration(name: string, durationMs: number): void {
  recordMetric('function.duration', durationMs, 'ms', { name });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export interface MetricsSummary {
  /** 50th percentile (median). */
  p50: number;
  /** 95th percentile. */
  p95: number;
  /** 99th percentile. */
  p99: number;
  /** Number of samples in the window. */
  count: number;
  /** Minimum value observed. */
  min: number;
  /** Maximum value observed. */
  max: number;
  /** Arithmetic mean. */
  mean: number;
}

/**
 * Aggregate metrics in the given time window (default: last 5 minutes).
 *
 *   const summary = getMetricsSummary(5 * 60 * 1000, {
 *     name: 'api.call.duration',
 *     tags: { name: 'invoices.list' },
 *   });
 *
 * Returns `{ p50, p95, p99, count, min, max, mean }`. If no metrics match,
 * returns zeros.
 *
 * @param windowMs  How far back to look (default 5 min).
 * @param filter    Optional filter on metric name + tags.
 */
export function getMetricsSummary(
  windowMs: number = 5 * 60 * 1000,
  filter?: { name?: string; tags?: Record<string, string> },
): MetricsSummary {
  const now = Date.now();
  const cutoff = now - windowMs;

  const values: number[] = [];
  for (let i = buffer.length - 1; i >= 0; i--) {
    const m = buffer[i];
    const t = new Date(m.timestamp).getTime();
    if (t < cutoff) break; // buffer is append-only; older entries are at the front
    if (filter?.name && m.name !== filter.name) continue;
    if (filter?.tags) {
      let match = true;
      for (const [k, v] of Object.entries(filter.tags)) {
        if (m.tags?.[k] !== v) { match = false; break; }
      }
      if (!match) continue;
    }
    values.push(m.value);
  }

  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0, count: 0, min: 0, max: 0, mean: 0 };
  }

  values.sort((a, b) => a - b);
  const count = values.length;
  const min = values[0] ?? 0;
  const max = values[count - 1] ?? 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;

  const percentile = (p: number): number => {
    const idx = Math.min(Math.floor((p / 100) * count), count - 1);
    return values[idx] ?? 0;
  };

  return {
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    count,
    min,
    max,
    mean,
  };
}

/**
 * Return a snapshot of the current in-memory buffer (newest first).
 *
 * @param limit  Max entries to return (default 100, max 10 000).
 */
export function getMetricSnapshot(limit: number = 100): PerformanceMetric[] {
  const cap = Math.min(Math.max(limit, 1), MAX_BUFFER_SIZE);
  return buffer.slice(-cap).reverse();
}

/** Clear the in-memory buffer. Test-only. */
export function _clearBufferForTests(): void {
  buffer.length = 0;
  pendingFlushBatch.length = 0;
}
