// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Bank Accounts → BankAccount
//
// Syncs Zoho Books bankaccounts into the existing `BankAccount` Prisma model.
// Oracle Memory Engine reads db.bankAccount.findMany — so synced Zoho bank
// accounts appear in Oracle's memory snapshot ("What is my current cash
// balance?").
//
// Idempotent + incremental + resume — same pattern as customers.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapBankAccount, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoBankAccount } from './types';

export async function syncBankAccounts(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoBankAccount>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/bankaccounts',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'bankaccounts',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const a of page.records) {
      try {
        const normalized = mapBankAccount(a);
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'bank_account',
          a.account_id,
        );

        if (existing) {
          await db.bankAccount.update({
            where: { id: existing.localEntityId },
            data: {
              bankName: normalized.bankName,
              accountMasked: normalized.accountMasked,
              accountType: normalized.accountType,
              ifsc: normalized.ifsc,
              balance: normalized.balance,
              availableBalance: normalized.availableBalance,
              status: normalized.status,
              lastSyncAt: new Date(),
            },
          });
          stats.updated++;
        } else {
          // BankAccount has no @unique constraint except id — we can't upsert
          // by a natural key. Use findFirst by (bankName, accountMasked) as a
          // dedup heuristic, else create.
          const existingByMask = await db.bankAccount.findFirst({
            where: {
              bankName: normalized.bankName,
              accountMasked: normalized.accountMasked,
            },
            select: { id: true },
          });
          if (existingByMask) {
            await db.bankAccount.update({
              where: { id: existingByMask.id },
              data: {
                accountType: normalized.accountType,
                ifsc: normalized.ifsc,
                balance: normalized.balance,
                availableBalance: normalized.availableBalance,
                status: normalized.status,
                lastSyncAt: new Date(),
              },
            });
            await recordEntityMapping(
              opts.organizationId,
              opts.zohoOrgId,
              'bank_account',
              a.account_id,
              'BankAccount',
              existingByMask.id,
              parseZohoLastModified(a.last_modified_time),
            );
            stats.updated++;
          } else {
            const row = await db.bankAccount.create({
              data: {
                bankName: normalized.bankName,
                accountMasked: normalized.accountMasked,
                accountType: normalized.accountType,
                ifsc: normalized.ifsc,
                balance: normalized.balance,
                availableBalance: normalized.availableBalance,
                status: normalized.status,
                lastSyncAt: new Date(),
              },
            });
            await recordEntityMapping(
              opts.organizationId,
              opts.zohoOrgId,
              'bank_account',
              a.account_id,
              'BankAccount',
              row.id,
              parseZohoLastModified(a.last_modified_time),
            );
            stats.imported++;
          }
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(a.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert bank account.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('bank_account', stats, newWatermark, finalResumeCursor, lastError);
}
