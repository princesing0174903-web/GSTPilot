// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync Orchestrator
//
// Drives a full or incremental sync of all 11 Zoho Books entity types into
// GSTPilot's existing Prisma models. The orchestrator:
//
//   1. Resumes an interrupted sync if `opts.resume=true` and a recent
//      ZohoSyncLog with status='running' exists (continues from
//      lastEntity + lastCursor + per-entity watermarks).
//   2. Creates a new ZohoSyncLog row with status='running'.
//   3. Runs each entity sync in dependency order:
//        customer → vendor → tax → bank_account
//        → invoice → bill → expense → bank_transaction → journal
//        → payment → item
//      (Invoices depend on customers; bank transactions depend on bank accounts;
//       bills optionally enrich via vendors; expenses optionally link to
//       customers; payments depend on customers/invoices/vendors/bills;
//       items are independent catalog data.)
//   4. Persists the per-entity watermark + lastEntity + lastCursor after each
//      entity completes (so an interruption mid-run can be resumed).
//   5. Updates the ZohoSyncLog row at the end with status='completed' |
//      'partial' | 'failed' + final stats.
//   6. Writes a safeAudit entry (ZOHO_BOOKS_SYNC) on completion.
//
// Incremental vs Full:
//   • mode='full'        → ignore all watermarks; fetch every page from the
//                          start. Used by the manual "Sync Now" button.
//   • mode='incremental' → pass each entity's max last_modified_time (read
//                          from ZohoEntityMap) as the `last_modified_time`
//                          query param. Only modified records are fetched.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';
import { syncCustomers } from './customers';
import { syncVendors } from './vendors';
import { syncTaxes } from './taxes';
import { syncBankAccounts } from './bank-accounts';
import { syncInvoices } from './invoices';
import { syncBills } from './bills';
import { syncExpenses } from './expenses';
import { syncBankTransactions } from './bank-transactions';
import { syncJournals } from './journals';
import { syncPayments } from './payments';
import { syncItems } from './items';
import { countImportedRecords, getWatermark } from './shared';
import type {
  EntitySyncResult,
  EntitySyncStats,
  ResumeContext,
  SyncMode,
  SyncOptions,
  SyncStats,
  SyncStatus,
  TriggerSyncResponse,
  ZohoSyncEntity,
} from './types';
import { ZOHO_SYNC_ENTITIES } from './types';

// ─── Entity runners indexed by entity type ───────────────────────────────────
//
// Each runner takes (opts, watermark, resumeCursor) and returns an
// EntitySyncResult. The orchestrator calls them in dependency order.

type EntityRunner = (
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
) => Promise<EntitySyncResult>;

const ENTITY_RUNNERS: Record<ZohoSyncEntity, EntityRunner> = {
  customer: syncCustomers,
  vendor: syncVendors,
  tax: syncTaxes,
  bank_account: syncBankAccounts,
  invoice: syncInvoices,
  bill: syncBills,
  expense: syncExpenses,
  bank_transaction: syncBankTransactions,
  journal: syncJournals,
  payment: syncPayments,
  item: syncItems,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyStats(): SyncStats {
  const out = {} as SyncStats;
  for (const e of ZOHO_SYNC_ENTITIES) {
    out[e] = {
      imported: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      pages: 0,
      lastError: null,
    };
  }
  return out;
}

/**
 * Look for a recent ZohoSyncLog with status='running' for this (org, zohoOrgId)
 * pair. If found and stale (>5 min old, indicating a crash), return a
 * ResumeContext so the orchestrator can continue from where it left off.
 */
async function findResumableLog(
  organizationId: string,
  zohoOrgId: string,
): Promise<ResumeContext | null> {
  const recent = await db.zohoSyncLog.findFirst({
    where: {
      organizationId,
      zohoOrgId,
      status: 'running',
      startedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }, // stale >5 min
    },
    orderBy: { startedAt: 'desc' },
  });
  if (!recent) return null;
  return {
    syncLogId: recent.id,
    lastEntity: (recent.lastEntity as ZohoSyncEntity | null) ?? null,
    lastCursor: recent.lastCursor,
    watermarks: {}, // Per-entity watermarks are read from ZohoEntityMap (max lastModifiedAt).
  };
}

/**
 * Mark a previously-running log as 'failed' (stale, abandoned). Called when the
 * orchestrator decides to start fresh instead of resuming.
 */
async function abandonStaleLog(syncLogId: string, reason: string): Promise<void> {
  try {
    await db.zohoSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: `Abandoned: ${reason}`,
      },
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Persist the current progress to the ZohoSyncLog row. Called after each entity
 * completes (so an interruption mid-run can be resumed from the last completed
 * entity).
 */
async function persistProgress(
  syncLogId: string,
  lastEntity: ZohoSyncEntity | null,
  lastCursor: string | null,
  stats: SyncStats,
): Promise<void> {
  try {
    await db.zohoSyncLog.update({
      where: { id: syncLogId },
      data: {
        lastEntity,
        lastCursor,
        stats: JSON.stringify(stats),
      },
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Compute the final sync status from the per-entity results.
 *   • All entities completed with 0 failures → 'completed'
 *   • Some entities failed but others succeeded → 'partial'
 *   • All entities failed → 'failed'
 */
function computeFinalStatus(results: EntitySyncResult[]): SyncStatus {
  if (results.length === 0) return 'failed';
  const failed = results.filter((r) => r.error !== null && r.stats.imported === 0 && r.stats.updated === 0);
  const partial = results.filter((r) => r.error !== null || r.stats.failed > 0);
  if (failed.length === results.length) return 'failed';
  if (partial.length > 0) return 'partial';
  return 'completed';
}

// ─── Public API: runSync ─────────────────────────────────────────────────────

/**
 * Run a full or incremental Zoho Books sync.
 *
 * @returns TriggerSyncResponse — the syncLogId, final status, and per-entity stats.
 *
 * This function is async but NOT backgrounded — the caller (the API route)
 * awaits it. For very large Zoho orgs, the route should set a generous timeout
 * (or run via a queue in a future enhancement).
 */
export async function runSync(opts: SyncOptions): Promise<TriggerSyncResponse> {
  // 1. Resume check — if requested and a stale running log exists, continue it.
  let resumeCtx: ResumeContext | null = null;
  if (opts.resume) {
    resumeCtx = await findResumableLog(opts.organizationId, opts.zohoOrgId);
  }

  // 2. Create (or reuse) the ZohoSyncLog row.
  let syncLogId: string;
  let mode: SyncMode = opts.mode;
  let startEntityIdx = 0;
  let startCursor: string | null = null;

  if (resumeCtx) {
    syncLogId = resumeCtx.syncLogId;
    // If we're resuming, the mode is whatever the original log was.
    const log = await db.zohoSyncLog.findUnique({ where: { id: syncLogId }, select: { mode: true } });
    mode = (log?.mode as SyncMode | null) ?? opts.mode;
    // Find the entity index to resume from.
    if (resumeCtx.lastEntity) {
      const idx = ZOHO_SYNC_ENTITIES.indexOf(resumeCtx.lastEntity);
      if (idx >= 0) {
        startEntityIdx = idx;
        startCursor = resumeCtx.lastCursor;
      }
    }
  } else {
    const log = await db.zohoSyncLog.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId,
        zohoOrgId: opts.zohoOrgId,
        status: 'running',
        mode,
        stats: JSON.stringify(emptyStats()),
      },
    });
    syncLogId = log.id;
  }

  const stats = emptyStats();
  const results: EntitySyncResult[] = [];
  let topLevelError: string | null = null;

  try {
    // 3. Run each entity sync in dependency order.
    for (let i = startEntityIdx; i < ZOHO_SYNC_ENTITIES.length; i++) {
      const entity = ZOHO_SYNC_ENTITIES[i];
      const runner = ENTITY_RUNNERS[entity];

      // Read the per-entity watermark from ZohoEntityMap (max lastModifiedAt).
      // For full mode, ignore it (watermark = null).
      // For incremental mode, use it (only fetch records modified after it).
      // For resume, only the resumeCursor for the first entity is used.
      const isResumeEntity = i === startEntityIdx && startCursor !== null;
      const watermark =
        mode === 'full' ? null : await getWatermark(opts.organizationId, opts.zohoOrgId, entity);
      const resumeCursor = isResumeEntity ? startCursor : null;

      // Update the log's lastEntity before starting (so a crash here resumes
      // from THIS entity, not the previous one).
      await persistProgress(syncLogId, entity, resumeCursor, stats);

      const result = await runner(
        { ...opts, mode },
        watermark,
        resumeCursor,
      );

      stats[entity] = result.stats;
      results.push(result);

      // Persist progress after each entity (so an interruption during the
      // NEXT entity resumes from this completed one).
      await persistProgress(syncLogId, entity, null, stats);

      // If this entity had a hard error (e.g., token revoked mid-sync), abort
      // the entire run — no point continuing with broken auth.
      if (result.error && /token|unauthorized|401/i.test(result.error)) {
        topLevelError = result.error;
        break;
      }

      // Check abort signal (e.g., the request was closed by the client).
      if (opts.abortSignal?.aborted) {
        topLevelError = 'Aborted by caller.';
        break;
      }
    }

    // 4. Compute final status + persist the log.
    const finalStatus = computeFinalStatus(results);
    await db.zohoSyncLog.update({
      where: { id: syncLogId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        error: topLevelError,
        stats: JSON.stringify(stats),
      },
    });

    // 5. Audit log (best-effort).
    try {
      const totalImported = results.reduce((s, r) => s + r.stats.imported, 0);
      const totalUpdated = results.reduce((s, r) => s + r.stats.updated, 0);
      const totalFailed = results.reduce((s, r) => s + r.stats.failed, 0);
      await safeAudit({
        userId: opts.userId,
        action: 'ZOHO_BOOKS_SYNC',
        entity: 'ZohoSyncLog',
        entityId: syncLogId,
        details: `${mode} sync ${finalStatus}: imported ${totalImported}, updated ${totalUpdated}, failed ${totalFailed}`,
      });
    } catch {
      /* ignore */
    }

    return {
      ok: finalStatus !== 'failed',
      syncLogId,
      mode,
      status: finalStatus,
      startedAt: (await db.zohoSyncLog.findUnique({ where: { id: syncLogId }, select: { startedAt: true } }))?.startedAt.toISOString() ?? new Date().toISOString(),
      stats,
      error: topLevelError,
    };
  } catch (err) {
    // Top-level exception — mark the log as failed.
    const errMsg = err instanceof Error ? err.message : 'Sync failed with an unknown error.';
    topLevelError = errMsg;
    try {
      await db.zohoSyncLog.update({
        where: { id: syncLogId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: errMsg,
          stats: JSON.stringify(stats),
        },
      });
    } catch {
      /* non-fatal */
    }
    try {
      await safeAudit({
        userId: opts.userId,
        action: 'ZOHO_BOOKS_SYNC_FAILED',
        entity: 'ZohoSyncLog',
        entityId: syncLogId,
        details: errMsg,
      });
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      syncLogId,
      mode,
      status: 'failed',
      startedAt: new Date().toISOString(),
      stats,
      error: errMsg,
    };
  }
}

// ─── Public API: getSyncStatus ───────────────────────────────────────────────

/**
 * Read the current sync status for an (organizationId, zohoOrgId) pair.
 * Returns:
 *   - The most recent ZohoSyncLog (running | completed | failed | partial)
 *   - Aggregate record counts from ZohoEntityMap ("Records Imported")
 *   - Whether a sync is currently running (for the UI spinner)
 */
export async function getSyncStatus(
  organizationId: string,
  zohoOrgId: string,
): Promise<{
  lastSync: {
    id: string;
    status: SyncStatus;
    mode: SyncMode;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    error: string | null;
    stats: Partial<Record<ZohoSyncEntity, EntitySyncStats>>;
  } | null;
  recordsImported: Partial<Record<ZohoSyncEntity, number>>;
  totalRecords: number;
  isRunning: boolean;
}> {
  const [lastLog, counts] = await Promise.all([
    db.zohoSyncLog.findFirst({
      where: { organizationId, zohoOrgId },
      orderBy: { startedAt: 'desc' },
    }),
    countImportedRecords(organizationId, zohoOrgId),
  ]);

  let parsedStats: Partial<Record<ZohoSyncEntity, EntitySyncStats>> = {};
  if (lastLog?.stats) {
    try {
      parsedStats = JSON.parse(lastLog.stats) as Partial<Record<ZohoSyncEntity, EntitySyncStats>>;
    } catch {
      parsedStats = {};
    }
  }

  const totalRecords = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  return {
    lastSync: lastLog
      ? {
          id: lastLog.id,
          status: lastLog.status as SyncStatus,
          mode: lastLog.mode as SyncMode,
          startedAt: lastLog.startedAt.toISOString(),
          completedAt: lastLog.completedAt?.toISOString() ?? null,
          durationMs: lastLog.completedAt
            ? lastLog.completedAt.getTime() - lastLog.startedAt.getTime()
            : null,
          error: lastLog.error,
          stats: parsedStats,
        }
      : null,
    recordsImported: counts,
    totalRecords,
    isRunning: lastLog?.status === 'running',
  };
}
