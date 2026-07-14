// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Journals → ZohoJournalEntry
//
// Syncs Zoho Books journals into the new `ZohoJournalEntry` Prisma model.
// GSTPilot has no generic Journal model, so journals live in this dedicated
// Zoho-specific table (normalized — not raw Zoho JSON). Oracle doesn't have a
// tool for journals yet; the data is persisted for future use and the UI shows
// the imported count.
//
// Idempotent + incremental + resume — same pattern as customers.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapJournal, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoJournal } from './types';

export async function syncJournals(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoJournal>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/journals',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'journals',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const j of page.records) {
      try {
        const normalized = mapJournal(j);
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'journal',
          j.journal_id,
        );

        if (existing) {
          await db.zohoJournalEntry.update({
            where: { id: existing.localEntityId },
            data: {
              journalNumber: normalized.journalNumber,
              referenceNumber: normalized.referenceNumber,
              date: normalized.date,
              totalDebit: normalized.totalDebit,
              totalCredit: normalized.totalCredit,
              notes: normalized.notes,
              lines: normalized.lines,
              status: normalized.status,
            },
          });
          stats.updated++;
        } else {
          const row = await db.zohoJournalEntry.create({
            data: {
              organizationId: opts.organizationId,
              zohoOrgId: opts.zohoOrgId,
              journalNumber: normalized.journalNumber,
              referenceNumber: normalized.referenceNumber,
              date: normalized.date,
              totalDebit: normalized.totalDebit,
              totalCredit: normalized.totalCredit,
              notes: normalized.notes,
              lines: normalized.lines,
              status: normalized.status,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'journal',
            j.journal_id,
            'ZohoJournalEntry',
            row.id,
            parseZohoLastModified(j.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(j.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert journal.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('journal', stats, newWatermark, finalResumeCursor, lastError);
}
