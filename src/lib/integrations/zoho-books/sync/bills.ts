// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Sync · Bills → PurchaseBill
//
// Syncs Zoho Books bills into the existing `PurchaseBill` Prisma model.
// VEYRO AI Memory Engine reads db.purchaseBill.findMany — so synced Zoho bills
// appear in Oracle's memory snapshot ("Which vendor costs increased?",
// "What are my total payables?").
//
// Dependency: bills reference a vendor. The mapper resolves the vendor name
// (PurchaseBill.vendorName is a free-text field, so we don't need a vendorId
// lookup — but we DO look up the Vendor row to enrich the GSTIN if known).
//
// Idempotent + incremental + resume — same pattern as customers.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapBill, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoBill } from './types';

export async function syncBills(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoBill>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/bills',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'bills',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const bill of page.records) {
      try {
        // Best-effort: look up the vendor mapping to enrich the GSTIN.
        let vendorGstin: string | null = null;
        if (bill.vendor_id) {
          const vmap = await findLocalEntityId(
            opts.organizationId,
            opts.zohoOrgId,
            'vendor',
            bill.vendor_id,
          );
          if (vmap) {
            const vrow = await db.vendor.findUnique({
              where: { id: vmap.localEntityId },
              select: { gstin: true },
            });
            vendorGstin = vrow?.gstin ?? null;
          }
        }

        const normalized = mapBill(bill, null);
        // Override vendorGstin with the resolved Vendor's GSTIN if available.
        if (vendorGstin) normalized.vendorGstin = vendorGstin;

        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'bill',
          bill.bill_id,
        );

        if (existing) {
          await db.purchaseBill.update({
            where: { id: existing.localEntityId },
            data: {
              vendorName: normalized.vendorName,
              vendorGstin: normalized.vendorGstin,
              invoiceNo: normalized.invoiceNo,
              invoiceDate: normalized.invoiceDate,
              dueDate: normalized.dueDate,
              taxableValue: normalized.taxableValue,
              cgst: normalized.cgst,
              sgst: normalized.sgst,
              igst: normalized.igst,
              cess: normalized.cess,
              gstAmount: normalized.gstAmount,
              totalAmount: normalized.totalAmount,
              paidAmount: normalized.paidAmount,
              balanceAmount: normalized.balanceAmount,
              status: normalized.status,
              paymentStatus: normalized.paymentStatus,
              category: normalized.category,
            },
          });
          stats.updated++;
        } else {
          const row = await db.purchaseBill.create({
            data: {
              vendorName: normalized.vendorName,
              vendorGstin: normalized.vendorGstin,
              invoiceNo: normalized.invoiceNo,
              invoiceDate: normalized.invoiceDate,
              dueDate: normalized.dueDate,
              taxableValue: normalized.taxableValue,
              cgst: normalized.cgst,
              sgst: normalized.sgst,
              igst: normalized.igst,
              cess: normalized.cess,
              gstAmount: normalized.gstAmount,
              totalAmount: normalized.totalAmount,
              paidAmount: normalized.paidAmount,
              balanceAmount: normalized.balanceAmount,
              status: normalized.status,
              paymentStatus: normalized.paymentStatus,
              category: normalized.category,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'bill',
            bill.bill_id,
            'PurchaseBill',
            row.id,
            parseZohoLastModified(bill.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(bill.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert bill.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('bill', stats, newWatermark, finalResumeCursor, lastError);
}
