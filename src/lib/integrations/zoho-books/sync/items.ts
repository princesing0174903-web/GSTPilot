// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Items → ZohoItem
//
// Syncs Zoho Books items (product/service catalog from /items) into the
// `ZohoItem` Prisma model.
//
// GSTPilot has no standalone Item model (InvoiceItem is a line-item on invoices,
// not a catalog entry). Zoho Books exposes /items (products & services sold),
// so we store them in a dedicated ZohoItem table — normalized GSTPilot records,
// NOT raw Zoho JSON.
//
// Oracle Memory Engine can read db.zohoItem.findMany to answer catalog questions
// ("What's my product list?", "Which items have GST?", "Show low-stock items")
// with zero Oracle code changes.
//
// Idempotent + incremental + resume — same pattern as customers.ts / bills.ts.
// Dedup: upsert by (organizationId, zohoOrgId, zohoItemId) — the unique key.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapItem, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoItem } from './types';

/**
 * Sync Zoho Books items (product/service catalog) into the ZohoItem table.
 *
 * @param opts          SyncOptions (orgId, userId, zohoOrgId, accessToken, mode, ...)
 * @param watermark     ISO timestamp — only fetch items modified after this (incremental)
 * @param resumeCursor  Zoho `next_token` from an interrupted run (resume)
 */
export async function syncItems(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoItem>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/items',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'items',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const item of page.records) {
      try {
        const normalized = mapItem(item);

        // Idempotent: look up by ZohoEntityMap first (fast path — known record).
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'item',
          item.item_id,
        );

        if (existing) {
          // UPDATE — keep the same row id.
          await db.zohoItem.update({
            where: { id: existing.localEntityId },
            data: {
              zohoItemId: item.item_id,
              name: normalized.name,
              description: normalized.description,
              itemType: normalized.itemType,
              unit: normalized.unit,
              hsnOrSac: normalized.hsnOrSac,
              rate: normalized.rate,
              purchaseRate: normalized.purchaseRate,
              taxName: normalized.taxName,
              taxPercentage: normalized.taxPercentage,
              isTaxable: normalized.isTaxable,
              stockOnHand: normalized.stockOnHand,
              reorderLevel: normalized.reorderLevel,
              status: normalized.status,
            },
          });
          stats.updated++;
        } else {
          // INSERT — upsert by the unique constraint (organizationId, zohoOrgId, zohoItemId)
          // to handle re-runs that lost the ZohoEntityMap mapping.
          const row = await db.zohoItem.upsert({
            where: {
              organizationId_zohoOrgId_zohoItemId: {
                organizationId: opts.organizationId,
                zohoOrgId: opts.zohoOrgId,
                zohoItemId: item.item_id,
              },
            },
            create: {
              organizationId: opts.organizationId,
              zohoOrgId: opts.zohoOrgId,
              zohoItemId: item.item_id,
              name: normalized.name,
              description: normalized.description,
              itemType: normalized.itemType,
              unit: normalized.unit,
              hsnOrSac: normalized.hsnOrSac,
              rate: normalized.rate,
              purchaseRate: normalized.purchaseRate,
              taxName: normalized.taxName,
              taxPercentage: normalized.taxPercentage,
              isTaxable: normalized.isTaxable,
              stockOnHand: normalized.stockOnHand,
              reorderLevel: normalized.reorderLevel,
              status: normalized.status,
              source: 'zoho',
            },
            update: {
              name: normalized.name,
              description: normalized.description,
              itemType: normalized.itemType,
              unit: normalized.unit,
              hsnOrSac: normalized.hsnOrSac,
              rate: normalized.rate,
              purchaseRate: normalized.purchaseRate,
              taxName: normalized.taxName,
              taxPercentage: normalized.taxPercentage,
              isTaxable: normalized.isTaxable,
              stockOnHand: normalized.stockOnHand,
              reorderLevel: normalized.reorderLevel,
              status: normalized.status,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'item',
            item.item_id,
            'ZohoItem',
            row.id,
            parseZohoLastModified(item.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(item.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert item.';
        lastError = stats.lastError;
        // Continue to the next record — one bad row shouldn't abort the batch.
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('item', stats, newWatermark, finalResumeCursor, lastError);
}
