// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Taxes (lookup-only)
//
// Zoho Books tax rates are reference data: GSTPilot's existing models embed
// tax amounts directly on invoices/bills/expenses (cgst/sgst/igst/cess), so
// there's no dedicated Tax table to write into. We still walk the /settings/taxes
// endpoint and persist a ZohoEntityMap row per tax — this gives the UI an
// accurate "Taxes: N imported" count and lets future features map
// Zoho tax_id → tax_name without an extra API round-trip.
//
// The localEntityType is 'TaxRate' (a virtual label — no Prisma row is written).
// The localEntityId is the zohoTaxId itself (so the mapping is self-referential
// but still tracks lastModifiedAt for incremental sync).
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { mapTax, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoTax } from './types';

export async function syncTaxes(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoTax>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/settings/taxes',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'taxes',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const t of page.records) {
      try {
        const normalized = mapTax(t);
        // Self-referential mapping: localEntityId = zohoTaxId (no Prisma row).
        // This still tracks the lastModifiedAt watermark for incremental sync.
        await recordEntityMapping(
          opts.organizationId,
          opts.zohoOrgId,
          'tax',
          normalized.zohoTaxId,
          'TaxRate',
          normalized.zohoTaxId,
          parseZohoLastModified(t.last_modified_time),
        );
        stats.imported++;
        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(t.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to record tax.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('tax', stats, newWatermark, finalResumeCursor, lastError);
}
