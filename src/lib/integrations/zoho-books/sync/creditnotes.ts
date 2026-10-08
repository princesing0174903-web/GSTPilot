// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Sync · Credit Notes → ZohoCreditNote
//
// Syncs Zoho Books credit notes (/creditnotes) into the `ZohoCreditNote`
// Prisma model. A credit note is a negative invoice — issued when a customer
// returns goods, gets a post-invoice discount, or overpays.
//
// Relationships maintained:
//   • ZohoCreditNote.customerId → ZohoCustomer.zohoContactId (customer link)
//   • ZohoCreditNote.invoiceId  → ZohoInvoice.invoice_id (optional invoice link)
//
// VEYRO AI Memory Engine can read db.zohoCreditNote.findMany to answer:
//   "How much credit have I issued?"
//   "Which customers have open credit notes?"
//
// Idempotent + incremental + resume — same pattern as items.ts / customers.ts.
// Dedup: upsert by (organizationId, zohoOrgId, zohoCreditNoteId) — the unique key.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapCreditNote, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoCreditNote } from './types';

/**
 * Sync Zoho Books credit notes into the ZohoCreditNote table.
 *
 * @param opts          SyncOptions (orgId, userId, zohoOrgId, accessToken, mode, ...)
 * @param watermark     ISO timestamp — only fetch credit notes modified after this (incremental)
 * @param resumeCursor  Zoho `next_token` from an interrupted run (resume)
 */
export async function syncCreditNotes(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoCreditNote>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/creditnotes',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'creditnotes',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const cn of page.records) {
      try {
        const normalized = mapCreditNote(cn);

        // Idempotent: look up by ZohoEntityMap first (fast path — known record).
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'creditnote',
          normalized.zohoCreditNoteId,
        );

        if (existing) {
          // UPDATE — keep the same row id.
          await db.zohoCreditNote.update({
            where: { id: existing.localEntityId },
            data: {
              creditNoteNumber: normalized.creditNoteNumber,
              date: normalized.date,
              status: normalized.status,
              customerId: normalized.customerId,
              customerName: normalized.customerName,
              invoiceId: normalized.invoiceId,
              invoiceNumber: normalized.invoiceNumber,
              total: normalized.total,
              subTotal: normalized.subTotal,
              totalCredited: normalized.totalCredited,
              balance: normalized.balance,
              currencyCode: normalized.currencyCode,
              reason: normalized.reason,
              notes: normalized.notes,
              lineItems: normalized.lineItems,
              lastSyncedAt: new Date(),
              zohoCreatedAt: normalized.zohoCreatedAt,
              zohoUpdatedAt: normalized.zohoUpdatedAt,
            },
          });
          stats.updated++;
        } else {
          // INSERT — upsert by the unique constraint (organizationId, zohoOrgId, zohoCreditNoteId)
          // to handle re-runs that lost the ZohoEntityMap mapping.
          const row = await db.zohoCreditNote.upsert({
            where: {
              organizationId_zohoOrgId_zohoCreditNoteId: {
                organizationId: opts.organizationId,
                zohoOrgId: opts.zohoOrgId,
                zohoCreditNoteId: normalized.zohoCreditNoteId,
              },
            },
            create: {
              organizationId: opts.organizationId,
              zohoOrgId: opts.zohoOrgId,
              zohoCreditNoteId: normalized.zohoCreditNoteId,
              creditNoteNumber: normalized.creditNoteNumber,
              date: normalized.date,
              status: normalized.status,
              customerId: normalized.customerId,
              customerName: normalized.customerName,
              invoiceId: normalized.invoiceId,
              invoiceNumber: normalized.invoiceNumber,
              total: normalized.total,
              subTotal: normalized.subTotal,
              totalCredited: normalized.totalCredited,
              balance: normalized.balance,
              currencyCode: normalized.currencyCode,
              reason: normalized.reason,
              notes: normalized.notes,
              lineItems: normalized.lineItems,
              lastSyncedAt: new Date(),
              zohoCreatedAt: normalized.zohoCreatedAt,
              zohoUpdatedAt: normalized.zohoUpdatedAt,
            },
            update: {
              creditNoteNumber: normalized.creditNoteNumber,
              date: normalized.date,
              status: normalized.status,
              customerId: normalized.customerId,
              customerName: normalized.customerName,
              invoiceId: normalized.invoiceId,
              invoiceNumber: normalized.invoiceNumber,
              total: normalized.total,
              subTotal: normalized.subTotal,
              totalCredited: normalized.totalCredited,
              balance: normalized.balance,
              currencyCode: normalized.currencyCode,
              reason: normalized.reason,
              notes: normalized.notes,
              lineItems: normalized.lineItems,
              lastSyncedAt: new Date(),
              zohoCreatedAt: normalized.zohoCreatedAt,
              zohoUpdatedAt: normalized.zohoUpdatedAt,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'creditnote',
            normalized.zohoCreditNoteId,
            'ZohoCreditNote',
            row.id,
            parseZohoLastModified(cn.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(cn.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert credit note.';
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
  return buildEntityResult('creditnote', stats, newWatermark, finalResumeCursor, lastError);
}
