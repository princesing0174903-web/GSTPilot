// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Invoices → Invoice
//
// Syncs Zoho Books invoices into the existing `Invoice` Prisma model.
// Oracle Memory Engine + Oracle Chat read db.invoice.findMany — so synced Zoho
// invoices appear in Oracle's memory snapshot, search_invoices tool, and the
// financial aggregations ("Which invoices are overdue?", "Who owes me money?",
// "Which customer generated the highest revenue?").
//
// Dependency: invoices reference a customer (clientId). The mapper resolves
// the clientId via ZohoEntityMap (zohoEntityType='customer', zohoEntityId=
// invoice.customer_id). If the customer hasn't been synced yet, the invoice is
// skipped with stats.skipped++ — the orchestrator runs customers BEFORE
// invoices, so this is rare (only if a new customer was created mid-sync).
//
// Idempotent + incremental + resume — same pattern as customers.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { mapInvoice, parseZohoLastModified } from './mapper';
import {
  bumpWatermark,
  buildEntityResult,
  emptyStats,
  findLocalEntityId,
  paginate,
  recordEntityMapping,
  resolveSellerGstin,
} from './shared';
import type { EntitySyncResult, SyncOptions, ZohoInvoice } from './types';

export async function syncInvoices(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  // Resolve the seller GSTIN once (the connected Zoho org's own GSTIN).
  const sellerGstin = await resolveSellerGstin(opts.accessToken, opts.zohoOrgId);

  const gen = paginate<ZohoInvoice>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/invoices',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'invoices',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const inv of page.records) {
      try {
        // Resolve the customer → clientId via ZohoEntityMap.
        let clientId: string | null = null;
        if (inv.customer_id) {
          const map = await findLocalEntityId(
            opts.organizationId,
            opts.zohoOrgId,
            'customer',
            inv.customer_id,
          );
          if (map) {
            clientId = map.localEntityId;
          } else {
            // Customer not yet synced — skip this invoice. The next incremental
            // run will pick it up once the customer is synced. (The orchestrator
            // runs customers before invoices, so this only happens if the
            // customer was created mid-sync.)
            stats.skipped++;
            continue;
          }
        } else {
          // No customer_id on the invoice — skip (can't link to a Client row,
          // and Invoice.clientId is required).
          stats.skipped++;
          continue;
        }

        const normalized = mapInvoice(inv, clientId, sellerGstin);
        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'invoice',
          inv.invoice_id,
        );

        if (existing) {
          await db.invoice.update({
            where: { id: existing.localEntityId },
            data: {
              clientId: normalized.clientId,
              invoiceNumber: normalized.invoiceNumber,
              invoiceDate: normalized.invoiceDate,
              sellerGstin: normalized.sellerGstin,
              buyerGstin: normalized.buyerGstin,
              buyerName: normalized.buyerName,
              invoiceType: normalized.invoiceType,
              taxableValue: normalized.taxableValue,
              cgst: normalized.cgst,
              sgst: normalized.sgst,
              igst: normalized.igst,
              cess: normalized.cess,
              totalAmount: normalized.totalAmount,
              gstAmount: normalized.gstAmount,
              paidAmount: normalized.paidAmount,
              balanceAmount: normalized.balanceAmount,
              dueDate: normalized.dueDate,
              paymentStatus: normalized.paymentStatus,
              status: normalized.status,
            },
          });
          stats.updated++;
        } else {
          const row = await db.invoice.create({
            data: {
              clientId: normalized.clientId,
              invoiceNumber: normalized.invoiceNumber,
              invoiceDate: normalized.invoiceDate,
              sellerGstin: normalized.sellerGstin,
              buyerGstin: normalized.buyerGstin,
              buyerName: normalized.buyerName,
              invoiceType: normalized.invoiceType,
              taxableValue: normalized.taxableValue,
              cgst: normalized.cgst,
              sgst: normalized.sgst,
              igst: normalized.igst,
              cess: normalized.cess,
              totalAmount: normalized.totalAmount,
              gstAmount: normalized.gstAmount,
              paidAmount: normalized.paidAmount,
              balanceAmount: normalized.balanceAmount,
              dueDate: normalized.dueDate,
              paymentStatus: normalized.paymentStatus,
              status: normalized.status,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'invoice',
            inv.invoice_id,
            'Invoice',
            row.id,
            parseZohoLastModified(inv.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(inv.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert invoice.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('invoice', stats, newWatermark, finalResumeCursor, lastError);
}
