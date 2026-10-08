// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Sync · Expenses → Expense
//
// Syncs Zoho Books expenses into the existing `Expense` Prisma model.
// VEYRO AI Memory Engine + Oracle Chat read db.expense.findMany — so synced
// Zoho expenses appear in Oracle's memory snapshot and search_expenses tool
// ("What were this month's expenses?", "Which vendor costs increased?").
//
// Idempotent + incremental + resume — same pattern as customers.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapExpense, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoExpense } from './types';

export async function syncExpenses(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoExpense>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/expenses',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'expenses',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const e of page.records) {
      try {
        // Best-effort: resolve the customer → clientId if the expense is billable
        // to a customer. (Zoho expenses can optionally reference a customer.)
        let clientId: string | null = null;
        if (e.customer_id) {
          const cmap = await findLocalEntityId(
            opts.organizationId,
            opts.zohoOrgId,
            'customer',
            e.customer_id,
          );
          if (cmap) clientId = cmap.localEntityId;
        }

        const normalized = mapExpense(e, clientId);
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'expense',
          e.expense_id,
        );

        if (existing) {
          await db.expense.update({
            where: { id: existing.localEntityId },
            data: {
              clientId: normalized.clientId,
              category: normalized.category,
              description: normalized.description,
              vendor: normalized.vendor,
              amount: normalized.amount,
              gst: normalized.gst,
              gstClaimable: normalized.gstClaimable,
              date: normalized.date,
              paymentMode: normalized.paymentMode,
              status: normalized.status,
            },
          });
          stats.updated++;
        } else {
          const row = await db.expense.create({
            data: {
              clientId: normalized.clientId,
              category: normalized.category,
              description: normalized.description,
              vendor: normalized.vendor,
              amount: normalized.amount,
              gst: normalized.gst,
              gstClaimable: normalized.gstClaimable,
              date: normalized.date,
              paymentMode: normalized.paymentMode,
              status: normalized.status,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'expense',
            e.expense_id,
            'Expense',
            row.id,
            parseZohoLastModified(e.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(e.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert expense.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('expense', stats, newWatermark, finalResumeCursor, lastError);
}
