// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Bank Transactions → BankTransaction
//
// Syncs Zoho Books banktransactions into the existing `BankTransaction` Prisma
// model. Oracle Memory Engine reads db.bankTransaction.findMany — so synced
// Zoho bank transactions appear in Oracle's memory snapshot ("What is my
// current cash balance?").
//
// Dependency: bank transactions reference a bank account. The mapper resolves
// the accountId via ZohoEntityMap (zohoEntityType='bank_account'). If the bank
// account hasn't been synced yet, the transaction is skipped (stats.skipped++).
//
// Idempotent + incremental + resume — same pattern as customers.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapBankTransaction, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoBankTransaction } from './types';

export async function syncBankTransactions(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoBankTransaction>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/banktransactions',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'banktransactions',
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
        // Resolve the bank account → accountId via ZohoEntityMap.
        if (!t.bank_account_id) {
          stats.skipped++;
          continue;
        }
        const amap = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'bank_account',
          t.bank_account_id,
        );
        if (!amap) {
          stats.skipped++;
          continue;
        }
        const accountId = amap.localEntityId;

        const normalized = mapBankTransaction(t, accountId);
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'bank_transaction',
          t.transaction_id,
        );

        if (existing) {
          await db.bankTransaction.update({
            where: { id: existing.localEntityId },
            data: {
              accountId: normalized.accountId,
              date: new Date(normalized.date),
              description: normalized.description,
              amount: normalized.amount,
              type: normalized.type,
              category: normalized.category,
              referenceNo: normalized.referenceNo,
              matched: normalized.matched,
            },
          });
          stats.updated++;
        } else {
          const row = await db.bankTransaction.create({
            data: {
              accountId: normalized.accountId,
              date: new Date(normalized.date),
              description: normalized.description,
              amount: normalized.amount,
              type: normalized.type,
              category: normalized.category,
              referenceNo: normalized.referenceNo,
              matched: normalized.matched,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'bank_transaction',
            t.transaction_id,
            'BankTransaction',
            row.id,
            parseZohoLastModified(t.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(t.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert bank transaction.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('bank_transaction', stats, newWatermark, finalResumeCursor, lastError);
}
