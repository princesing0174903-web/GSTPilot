// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Vendors → Vendor
//
// Syncs Zoho Books contacts (type=vendor) into the existing `Vendor` Prisma
// model. Oracle Chat's `search_vendors` tool reads db.vendor.findMany — so
// synced Zoho vendors are immediately queryable by Oracle ("Which vendor
// costs increased?").
//
// Idempotent + incremental + resume — same pattern as customers.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapVendor, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoVendor } from './types';

export async function syncVendors(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoVendor>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/contacts',
    params: { contact_type: 'vendor' },
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
      break;
    }

    for (const v of page.records) {
      try {
        const normalized = mapVendor(v);
        // Inject zohoOrgId into the metadata JSON.
        const meta = JSON.parse(normalized.metadata) as { zohoOrgId: string | null; source: string };
        meta.zohoOrgId = opts.zohoOrgId;
        const metadata = JSON.stringify(meta);

        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'vendor',
          v.contact_id,
        );

        if (existing) {
          await db.vendor.update({
            where: { id: existing.localEntityId },
            data: {
              name: normalized.name,
              gstin: normalized.gstin,
              category: normalized.category,
              state: normalized.state,
              stateCode: normalized.stateCode,
              status: normalized.status,
              outstanding: normalized.outstanding,
              metadata,
            },
          });
          stats.updated++;
        } else {
          // Upsert by gstin when present, else by name (Vendor.gstin is @unique
          // but nullable; vendors without GSTIN can't be upserted by gstin).
          if (normalized.gstin) {
            const row = await db.vendor.upsert({
              where: { gstin: normalized.gstin },
              create: {
                name: normalized.name,
                gstin: normalized.gstin,
                category: normalized.category,
                state: normalized.state,
                stateCode: normalized.stateCode,
                status: normalized.status,
                outstanding: normalized.outstanding,
                metadata,
              },
              update: {
                name: normalized.name,
                category: normalized.category,
                state: normalized.state,
                stateCode: normalized.stateCode,
                status: normalized.status,
                outstanding: normalized.outstanding,
                metadata,
              },
            });
            await recordEntityMapping(
              opts.organizationId,
              opts.zohoOrgId,
              'vendor',
              v.contact_id,
              'Vendor',
              row.id,
              parseZohoLastModified(v.last_modified_time),
            );
          } else {
            // No GSTIN — create without one. If a duplicate name exists, this
            // will create a second row, but the ZohoEntityMap lookup prevents
            // duplicate imports on subsequent runs (we look up by zohoEntityId).
            const row = await db.vendor.create({
              data: {
                name: normalized.name,
                gstin: null,
                category: normalized.category,
                state: normalized.state,
                stateCode: normalized.stateCode,
                status: normalized.status,
                outstanding: normalized.outstanding,
                metadata,
              },
            });
            await recordEntityMapping(
              opts.organizationId,
              opts.zohoOrgId,
              'vendor',
              v.contact_id,
              'Vendor',
              row.id,
              parseZohoLastModified(v.last_modified_time),
            );
          }
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(v.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert vendor.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('vendor', stats, newWatermark, finalResumeCursor, lastError);
}
