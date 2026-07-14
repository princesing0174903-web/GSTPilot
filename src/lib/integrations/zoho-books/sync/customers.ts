// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Customers → Client
//
// Syncs Zoho Books contacts (type=customer) into the existing `Client` Prisma
// model. Oracle Memory Engine reads db.client.findMany — so synced Zoho
// customers appear in Oracle's memory snapshot with zero Oracle code changes.
//
// Idempotent: each Zoho contact_id is looked up in ZohoEntityMap. If found →
// UPDATE the existing Client row. If not → INSERT a new Client + ZohoEntityMap.
// No duplicate imports.
//
// Incremental: when mode='incremental', the previous run's max last_modified_time
// is passed as `last_modified_time` to Zoho's /contacts endpoint, so only
// modified customers are fetched.
//
// Resume: if interrupted mid-batch, the last `next_token` is returned as
// `resumeCursor` — the orchestrator persists it and the next run continues
// from there.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapCustomerToClient, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type {
  EntitySyncResult,
  SyncOptions,
  ZohoContact,
  ZohoContactsResponse,
} from './types';

/**
 * Sync Zoho Books customers into the Client table.
 *
 * @param opts       SyncOptions (orgId, userId, zohoOrgId, accessToken, mode, ...)
 * @param watermark  ISO timestamp — only fetch customers modified after this (incremental)
 * @param resumeCursor  Zoho `next_token` from an interrupted run (resume)
 */
export async function syncCustomers(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  // Resolve the seller GSTIN once (used as Invoice.sellerGstin later, but also
  // as a fallback for clients without their own GSTIN).
  // (Resolved here so we don't refetch per-customer — cheap, one HTTP call.)
  const sellerGstin = `ZOHO-ORG-${opts.zohoOrgId}`; // sentinel; resolveSellerGstin is invoked at invoice-sync time

  const gen = paginate<ZohoContact>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/contacts',
    params: { contact_type: 'customer' },
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'contacts',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      // If this is a mid-batch page failure (we already have some records),
      // break and return partial results so the orchestrator can persist them
      // and the next run can resume.
      break;
    }

    for (const c of page.records) {
      try {
        const normalized = mapCustomerToClient(c, sellerGstin);
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'customer',
          c.contact_id,
        );

        if (existing) {
          // UPDATE — keep the same row id.
          await db.client.update({
            where: { id: existing.localEntityId },
            data: {
              tradeName: normalized.tradeName,
              legalName: normalized.legalName,
              address: normalized.address,
              state: normalized.state,
              stateCode: normalized.stateCode,
              contactEmail: normalized.contactEmail,
              contactPhone: normalized.contactPhone,
              entityType: normalized.entityType,
              status: normalized.status,
            },
          });
          stats.updated++;
        } else {
          // INSERT — upsert by gstin (handles re-runs that lost the mapping).
          const row = await db.client.upsert({
            where: { gstin: normalized.gstin },
            create: {
              gstin: normalized.gstin,
              tradeName: normalized.tradeName,
              legalName: normalized.legalName,
              address: normalized.address,
              state: normalized.state,
              stateCode: normalized.stateCode,
              contactEmail: normalized.contactEmail,
              contactPhone: normalized.contactPhone,
              entityType: normalized.entityType,
              status: normalized.status,
            },
            update: {
              tradeName: normalized.tradeName,
              legalName: normalized.legalName,
              address: normalized.address,
              state: normalized.state,
              stateCode: normalized.stateCode,
              contactEmail: normalized.contactEmail,
              contactPhone: normalized.contactPhone,
              entityType: normalized.entityType,
              status: normalized.status,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'customer',
            c.contact_id,
            'Client',
            row.id,
            parseZohoLastModified(c.last_modified_time),
          );
          stats.imported++;
        }

        // Bump the watermark with this record's last_modified_time.
        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(c.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert customer.';
        lastError = stats.lastError;
        // Continue to the next record — one bad row shouldn't abort the batch.
      }
    }

    // Check abort after each page.
    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  // If we exited the loop with a nextCursor, the sync was interrupted — return
  // it so the orchestrator can persist it as the resume point.
  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;

  return buildEntityResult(
    'customer',
    stats,
    newWatermark,
    finalResumeCursor,
    lastError,
  );
}

// Re-export the response type for the orchestrator's type-inference.
export type { ZohoContactsResponse };
