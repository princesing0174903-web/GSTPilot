// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — PHASE 2B · MODULE 1 — Auto Sync Engine™
//
// Always-on background sync orchestrator. Responsibilities:
//   • Auto-sync every N minutes (default 15) per connection
//   • Manual "Sync Now" (wraps executeSync with trigger='manual')
//   • Lazy sync-on-read — triggers due syncs when live data is loaded
//   • Queue management with rate limiting (1 concurrent/connection, 2 global)
//   • Retry failed syncs with exponential backoff (1m → 5m → 15m)
//   • Incremental sync flag (conceptual — production fetches delta since lastSyncedAt)
//   • Progress indicators via SyncQueueItem + SyncLog statuses
//   • Post-sync pipeline: validate → detect changes → generate alerts
//
// Architecture note: This module wraps syncConnection() from ./index.ts and adds
// the orchestration layer (scheduling, queue, post-sync pipeline). It does NOT
// modify syncConnection() itself, avoiding circular imports.
//
// Never throws — all operations are wrapped in try/catch.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { syncConnection } from './index';
import { runValidation } from './validation';
import { detectChanges, recordSyncOutcome } from './change-detection';
import { generateAlertsFromEvents } from './alerts';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SyncTrigger = 'auto' | 'manual' | 'retry';
export type QueueItemStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface SyncQueueItemRow {
  id: string;
  connectionId: string;
  connectionLabel: string;
  connectionType: string;
  status: QueueItemStatus;
  trigger: SyncTrigger;
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  syncLogId?: string;
  createdAt: string;
}

export interface SyncScheduleInfo {
  connectionId: string;
  autoSync: boolean;
  syncIntervalMins: number;
  lastSyncedAt?: string;
  nextSyncAt?: string;
  lastSyncDurationMs: number;
  consecutiveFailures: number;
  syncStatus: string;
}

export interface AutoSyncStatus {
  totalConnections: number;
  autoSyncEnabled: number;
  dueNow: number;
  queueDepth: number;
  running: number;
  lastRunAt?: string;
  nextRunAt?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_CONCURRENT_SYNC = 2;
const MIN_SYNC_GAP_MS = 60_000; // 60s rate limit per connection
const DEFAULT_INTERVAL_MINS = 15;
const BACKOFF_MINS = [1, 5, 15]; // exponential backoff for retries

// Module-level guard to prevent concurrent lazy-sync runs (SQLite single-writer)
let lazySyncRunning = false;

// ─── Public: execute a single sync + full post-sync pipeline ───────────────────

export interface SyncExecutionResult {
  success: boolean;
  status: string;
  recordsImported: number;
  errorsCount: number;
  durationMs: number;
  eventsCreated: number;
  alertsCreated: number;
  nextSyncAt?: string;
}

/**
 * Executes a sync for a connection, then runs the post-sync pipeline:
 *   validate → detect changes → generate alerts → schedule next sync.
 * This is the single entry point for ALL syncs (auto, manual, retry).
 */
export async function executeSync(
  connectionId: string,
  trigger: SyncTrigger = 'auto',
): Promise<SyncExecutionResult> {
  const startedAt = Date.now();
  let success = false;
  let recordsImported = 0;
  let errorsCount = 0;
  let status = 'failed';

  try {
    // 1. Execute the raw sync (regenerate dataset + persist + log)
    const result = await syncConnection(connectionId);
    status = result.log?.status ?? 'failed';
    success = status === 'success';
    recordsImported = result.log?.recordsImported ?? 0;
    errorsCount = result.log?.errorsCount ?? 0;

    // 2. Record sync outcome as an event
    await recordSyncOutcome(connectionId, success, recordsImported, errorsCount);

    // 3. Post-sync pipeline (only on success/partial — not on hard failure)
    let eventsCreated = 0;
    let alertsCreated = 0;
    if (status === 'success' || status === 'partial') {
      // 3a. Detect changes (diffs against previous snapshot, generates events)
      const events = await detectChanges(connectionId);
      eventsCreated = events.length;

      // 3b. Generate alerts from events
      alertsCreated = await generateAlertsFromEvents(events);

      // 3c. Run data validation (quality checks)
      await runValidation();
    }

    // 4. Update connection schedule fields
    const durationMs = Date.now() - startedAt;
    const conn = await db.businessConnection.findUnique({ where: { id: connectionId } });
    const intervalMins = conn?.syncIntervalMins ?? DEFAULT_INTERVAL_MINS;
    const nextSyncAt = new Date(Date.now() + intervalMins * 60 * 1000);

    // On failure with retries remaining, schedule a faster retry via backoff
    let actualNextSync = nextSyncAt;
    let consecutiveFailures = (conn?.consecutiveFailures ?? 0);
    if (!success) {
      consecutiveFailures += 1;
      const backoffIdx = Math.min(consecutiveFailures - 1, BACKOFF_MINS.length - 1);
      actualNextSync = new Date(Date.now() + BACKOFF_MINS[backoffIdx] * 60 * 1000);
    } else {
      consecutiveFailures = 0;
    }

    await db.businessConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncDurationMs: durationMs,
        consecutiveFailures,
        nextSyncAt: conn?.autoSync ? actualNextSync : null,
      },
    });

    return {
      success,
      status,
      recordsImported,
      errorsCount,
      durationMs,
      eventsCreated,
      alertsCreated,
      nextSyncAt: actualNextSync.toISOString(),
    };
  } catch (err) {
    console.error('executeSync error:', err);
    const durationMs = Date.now() - startedAt;
    // Mark connection as failed
    try {
      await db.businessConnection.update({
        where: { id: connectionId },
        data: {
          syncStatus: 'failed',
          lastSyncDurationMs: durationMs,
          consecutiveFailures: { increment: 1 },
        },
      });
    } catch {
      /* ignore */
    }
    return {
      success: false,
      status: 'failed',
      recordsImported: 0,
      errorsCount: 1,
      durationMs,
      eventsCreated: 0,
      alertsCreated: 0,
    };
  }
}

// ─── Public: enqueue a sync job ────────────────────────────────────────────────

export async function enqueueSync(
  connectionId: string,
  trigger: SyncTrigger = 'auto',
  priority = 5,
): Promise<string | null> {
  try {
    // Rate limit: don't enqueue if a queued/running item exists for this connection
    const existing = await db.syncQueueItem.findFirst({
      where: {
        connectionId,
        status: { in: ['queued', 'running'] },
      },
    });
    if (existing) return existing.id;

    const item = await db.syncQueueItem.create({
      data: {
        connectionId,
        status: 'queued',
        trigger,
        priority,
        scheduledAt: new Date(),
      },
    });
    return item.id;
  } catch (err) {
    console.error('enqueueSync error:', err);
    return null;
  }
}

// ─── Public: process the sync queue (rate-limited) ─────────────────────────────

/**
 * Processes up to MAX_CONCURRENT_SYNC queue items. Each item:
 *   1. Marks itself 'running'
 *   2. Checks rate limit (min gap since last sync for this connection)
 *   3. Calls executeSync()
 *   4. On success: marks 'done'
 *   5. On failure + attempts < maxAttempts: re-queues with incremented attempts
 *   6. On failure + attempts exhausted: marks 'failed'
 *
 * Returns the number of items processed. Never throws.
 */
export async function processQueue(): Promise<number> {
  let processed = 0;
  try {
    // Count currently running items
    const runningCount = await db.syncQueueItem.count({ where: { status: 'running' } });
    const slotsAvailable = MAX_CONCURRENT_SYNC - runningCount;
    if (slotsAvailable <= 0) return 0;

    // Pick the highest-priority, oldest queued items
    const items = await db.syncQueueItem.findMany({
      where: { status: 'queued' },
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
      take: slotsAvailable,
    });

    // Process sequentially within this call (the rate limit + SQLite write contention
    // makes parallel processing risky). Each executeSync is fast (~100ms for simulated data).
    for (const item of items) {
      try {
        // Rate limit check
        const conn = await db.businessConnection.findUnique({ where: { id: item.connectionId } });
        if (conn?.lastSyncedAt) {
          const gap = Date.now() - conn.lastSyncedAt.getTime();
          if (gap < MIN_SYNC_GAP_MS && item.trigger === 'auto') {
            // Auto-sync too soon — reschedule this item for later and skip
            await db.syncQueueItem.update({
              where: { id: item.id },
              data: { scheduledAt: new Date(Date.now() + MIN_SYNC_GAP_MS - gap) },
            });
            continue;
          }
        }

        // Mark running
        await db.syncQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'running',
            startedAt: new Date(),
            attempts: { increment: 1 },
          },
        });

        // Execute
        const result = await executeSync(item.connectionId, item.trigger as SyncTrigger);

        if (result.success || result.status === 'partial') {
          await db.syncQueueItem.update({
            where: { id: item.id },
            data: {
              status: 'done',
              completedAt: new Date(),
            },
          });
        } else {
          // Retry logic
          if (item.attempts + 1 < item.maxAttempts) {
            // Re-queue with backoff
            const backoffIdx = Math.min(item.attempts, BACKOFF_MINS.length - 1);
            await db.syncQueueItem.update({
              where: { id: item.id },
              data: {
                status: 'queued',
                scheduledAt: new Date(Date.now() + BACKOFF_MINS[backoffIdx] * 60 * 1000),
                lastError: `Attempt ${item.attempts + 1} failed`,
              },
            });
          } else {
            // Exhausted retries
            await db.syncQueueItem.update({
              where: { id: item.id },
              data: {
                status: 'failed',
                completedAt: new Date(),
                lastError: `Failed after ${item.maxAttempts} attempts`,
              },
            });
          }
        }
        processed++;
      } catch (err) {
        console.error('processQueue item error:', err);
        try {
          await db.syncQueueItem.update({
            where: { id: item.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              lastError: err instanceof Error ? err.message : 'Unknown error',
            },
          });
        } catch {
          /* ignore */
        }
      }
    }
  } catch (err) {
    console.error('processQueue error:', err);
  }
  return processed;
}

// ─── Public: find due connections + enqueue + process ──────────────────────────

/**
 * The main "tick" of the auto-sync engine. Finds all connections where:
 *   autoSync = true AND nextSyncAt <= now AND syncStatus != 'syncing'
 * Enqueues each as a SyncQueueItem, then processes the queue.
 *
 * Returns the number of syncs triggered. Never throws.
 */
export async function runDueSyncs(): Promise<number> {
  let triggered = 0;
  try {
    const now = new Date();
    const dueConns = await db.businessConnection.findMany({
      where: {
        status: 'active',
        autoSync: true,
        nextSyncAt: { lte: now },
        syncStatus: { not: 'syncing' },
      },
      orderBy: { nextSyncAt: 'asc' },
    });

    for (const conn of dueConns) {
      const itemId = await enqueueSync(conn.id, 'auto');
      if (itemId) triggered++;
    }

    if (triggered > 0) {
      await processQueue();
    } else {
      // Also process any pre-queued items (e.g. from manual triggers)
      const queued = await db.syncQueueItem.count({ where: { status: 'queued' } });
      if (queued > 0) {
        await processQueue();
      }
    }
  } catch (err) {
    console.error('runDueSyncs error:', err);
  }
  return triggered;
}

// ─── Public: lazy sync-on-read (fire-and-forget) ───────────────────────────────

/**
 * Called from API routes that serve live data. Checks if any connections are
 * due for sync and triggers them in the background (non-blocking). The current
 * request returns with whatever data is available; the next request will have
 * fresh data. This is how "always fresh" works without a cron daemon.
 *
 * Uses a module-level guard to prevent concurrent sync runs (SQLite has a
 * single-writer lock). The sync is deferred via setTimeout(0) so it runs
 * after the current request's response is sent.
 */
export function triggerLazySync(): void {
  if (lazySyncRunning) return; // already running — skip
  // Defer to after the current event loop (response sent first)
  setTimeout(() => {
    if (lazySyncRunning) return;
    lazySyncRunning = true;
    runDueSyncs()
      .catch((err) => {
        console.error('triggerLazySync background error:', err);
      })
      .finally(() => {
        lazySyncRunning = false;
      });
  }, 100);
}

// ─── Public: manual "Sync Now" ─────────────────────────────────────────────────

/**
 * Triggers an immediate sync for a connection, bypassing the schedule and rate
 * limit. Used by the "Sync Now" button in the UI.
 */
export async function syncNow(connectionId: string): Promise<SyncExecutionResult> {
  // Enqueue at highest priority
  await enqueueSync(connectionId, 'manual', 1);
  // Process immediately
  await processQueue();
  // The queue processor already called executeSync — but if the item was rate-limited
  // or skipped, execute directly to ensure the user gets a result.
  const result = await executeSync(connectionId, 'manual');
  return result;
}

// ─── Public: retry failed syncs ────────────────────────────────────────────────

export async function retryFailedSyncs(): Promise<number> {
  let retried = 0;
  try {
    const failedConns = await db.businessConnection.findMany({
      where: {
        status: 'active',
        syncStatus: { in: ['failed', 'partial'] },
      },
    });

    for (const conn of failedConns) {
      const itemId = await enqueueSync(conn.id, 'retry', 2);
      if (itemId) retried++;
    }

    if (retried > 0) {
      await processQueue();
    }
  } catch (err) {
    console.error('retryFailedSyncs error:', err);
  }
  return retried;
}

// ─── Public: update sync schedule ──────────────────────────────────────────────

export async function updateSyncSchedule(
  connectionId: string,
  opts: { autoSync?: boolean; syncIntervalMins?: number },
): Promise<void> {
  try {
    const update: { autoSync?: boolean; syncIntervalMins?: number; nextSyncAt?: Date } = {};
    if (opts.autoSync !== undefined) update.autoSync = opts.autoSync;
    if (opts.syncIntervalMins !== undefined) update.syncIntervalMins = opts.syncIntervalMins;

    // Recompute nextSyncAt if autoSync was just enabled or interval changed
    if (opts.autoSync === true || opts.syncIntervalMins !== undefined) {
      const conn = await db.businessConnection.findUnique({ where: { id: connectionId } });
      if (conn?.autoSync || opts.autoSync === true) {
        const interval = opts.syncIntervalMins ?? conn?.syncIntervalMins ?? DEFAULT_INTERVAL_MINS;
        update.nextSyncAt = new Date(Date.now() + interval * 60 * 1000);
      }
    }
    if (opts.autoSync === false) {
      update.nextSyncAt = null;
    }

    await db.businessConnection.update({
      where: { id: connectionId },
      data: update,
    });
  } catch (err) {
    console.error('updateSyncSchedule error:', err);
  }
}

// ─── Public: get sync queue (for UI) ───────────────────────────────────────────

export async function getSyncQueue(limit = 50): Promise<SyncQueueItemRow[]> {
  try {
    const items = await db.syncQueueItem.findMany({
      where: { status: { in: ['queued', 'running', 'done', 'failed'] } },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'desc' }],
      take: limit,
      include: { connection: true },
    });

    return items.map((item) => ({
      id: item.id,
      connectionId: item.connectionId,
      connectionLabel: item.connection?.tradeName ?? item.connection?.legalName ?? item.connection?.provider ?? 'Unknown',
      connectionType: item.connection?.type ?? 'unknown',
      status: item.status as QueueItemStatus,
      trigger: item.trigger as SyncTrigger,
      priority: item.priority,
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      scheduledAt: item.scheduledAt.toISOString(),
      startedAt: item.startedAt?.toISOString(),
      completedAt: item.completedAt?.toISOString(),
      lastError: item.lastError ?? undefined,
      syncLogId: item.syncLogId ?? undefined,
      createdAt: item.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('getSyncQueue error:', err);
    return [];
  }
}

// ─── Public: get sync schedules for all connections ────────────────────────────

export async function getSyncSchedules(): Promise<SyncScheduleInfo[]> {
  try {
    const conns = await db.businessConnection.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    return conns.map((c) => ({
      connectionId: c.id,
      autoSync: c.autoSync,
      syncIntervalMins: c.syncIntervalMins,
      lastSyncedAt: c.lastSyncedAt?.toISOString(),
      nextSyncAt: c.nextSyncAt?.toISOString(),
      lastSyncDurationMs: c.lastSyncDurationMs,
      consecutiveFailures: c.consecutiveFailures,
      syncStatus: c.syncStatus,
    }));
  } catch (err) {
    console.error('getSyncSchedules error:', err);
    return [];
  }
}

// ─── Public: auto-sync status (for UI + Oracle) ────────────────────────────────

export async function getAutoSyncStatus(): Promise<AutoSyncStatus> {
  try {
    const now = new Date();
    const [totalConnections, autoSyncEnabled, dueNow, queueDepth, running] = await Promise.all([
      db.businessConnection.count({ where: { status: 'active' } }),
      db.businessConnection.count({ where: { status: 'active', autoSync: true } }),
      db.businessConnection.count({
        where: {
          status: 'active',
          autoSync: true,
          nextSyncAt: { lte: now },
          syncStatus: { not: 'syncing' },
        },
      }),
      db.syncQueueItem.count({ where: { status: 'queued' } }),
      db.syncQueueItem.count({ where: { status: 'running' } }),
    ]);

    // Next run = earliest nextSyncAt among auto-sync connections
    const nextConn = await db.businessConnection.findFirst({
      where: { status: 'active', autoSync: true, nextSyncAt: { not: null } },
      orderBy: { nextSyncAt: 'asc' },
    });
    const lastConn = await db.businessConnection.findFirst({
      where: { status: 'active', lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: 'desc' },
    });

    return {
      totalConnections,
      autoSyncEnabled,
      dueNow,
      queueDepth,
      running,
      lastRunAt: lastConn?.lastSyncedAt?.toISOString(),
      nextRunAt: nextConn?.nextSyncAt?.toISOString(),
    };
  } catch (err) {
    console.error('getAutoSyncStatus error:', err);
    return {
      totalConnections: 0,
      autoSyncEnabled: 0,
      dueNow: 0,
      queueDepth: 0,
      running: 0,
    };
  }
}
