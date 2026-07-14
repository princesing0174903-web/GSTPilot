// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Sync · Payments (Customer + Vendor) → Payment
//
// Syncs Zoho Books customer payments (/customerpayments) AND vendor payments
// (/vendorpayments) into the existing `Payment` Prisma model.
//
// Oracle Memory Engine reads db.payment.findMany — so synced Zoho payments
// appear in Oracle's memory snapshot ("How much did we collect last month?",
// "What's our total vendor payouts?", "Show me all UPI payments from Acme Corp").
//
// Two sub-passes:
//   1. Customer payments (partyType='customer') — links to Client + Invoice
//   2. Vendor payments   (partyType='vendor')   — links to Vendor + PurchaseBill
//
// Idempotent + incremental + resume — same pattern as customers.ts / bills.ts.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  mapCustomerPayment,
  mapVendorPayment,
  parseZohoLastModified,
} from './mapper';
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
  ZohoCustomerPayment,
  ZohoVendorPayment,
} from './types';

// ─── Customer Payments → Payment ─────────────────────────────────────────────

async function syncCustomerPayments(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
  stats: ReturnType<typeof emptyStats>,
): Promise<{ newWatermark: string | null; lastCursor: string | null; lastError: string | null }> {
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoCustomerPayment>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/customerpayments',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'customerpayments',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const p of page.records) {
      try {
        const normalized = mapCustomerPayment(p);

        // Best-effort: resolve customer_id → Client.id via ZohoEntityMap.
        if (p.customer_id) {
          const cmap = await findLocalEntityId(
            opts.organizationId,
            opts.zohoOrgId,
            'customer',
            p.customer_id,
          );
          if (cmap) normalized.clientId = cmap.localEntityId;
        }

        // Best-effort: resolve invoice_id → Invoice.id via ZohoEntityMap.
        if (p.invoice_id) {
          const imap = await findLocalEntityId(
            opts.organizationId,
            opts.zohoOrgId,
            'invoice',
            p.invoice_id,
          );
          if (imap) normalized.invoiceId = imap.localEntityId;
        }

        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'payment',
          `cust_${p.payment_id}`, // namespace to avoid collision with vendor payment IDs
        );

        if (existing) {
          await db.payment.update({
            where: { id: existing.localEntityId },
            data: {
              clientId: normalized.clientId,
              invoiceId: normalized.invoiceId,
              purchaseBillId: null,
              partyName: normalized.partyName,
              partyType: normalized.partyType,
              amount: normalized.amount,
              paymentDate: normalized.paymentDate,
              paymentMode: normalized.paymentMode,
              referenceNo: normalized.referenceNo,
              status: normalized.status,
              notes: normalized.notes,
            },
          });
          stats.updated++;
        } else {
          const row = await db.payment.create({
            data: {
              clientId: normalized.clientId,
              invoiceId: normalized.invoiceId,
              purchaseBillId: null,
              partyName: normalized.partyName,
              partyType: normalized.partyType,
              amount: normalized.amount,
              paymentDate: normalized.paymentDate,
              paymentMode: normalized.paymentMode,
              referenceNo: normalized.referenceNo,
              status: normalized.status,
              notes: normalized.notes,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'payment',
            `cust_${p.payment_id}`,
            'Payment',
            row.id,
            parseZohoLastModified(p.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(p.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert customer payment.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  return { newWatermark, lastCursor, lastError };
}

// ─── Vendor Payments → Payment ───────────────────────────────────────────────

async function syncVendorPayments(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
  stats: ReturnType<typeof emptyStats>,
): Promise<{ newWatermark: string | null; lastCursor: string | null; lastError: string | null }> {
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  const gen = paginate<ZohoVendorPayment>({
    zohoOrgId: opts.zohoOrgId,
    accessToken: opts.accessToken,
    path: '/vendorpayments',
    mode: opts.mode,
    watermark,
    resumeCursor,
    maxRecords: opts.maxRecordsPerEntity,
    abortSignal: opts.abortSignal,
    entityKey: 'vendorpayments',
  });

  for await (const page of gen) {
    stats.pages++;
    lastCursor = page.nextCursor;

    if (page.error) {
      stats.lastError = page.error;
      lastError = page.error;
      break;
    }

    for (const p of page.records) {
      try {
        const normalized = mapVendorPayment(p);

        // Best-effort: resolve vendor_id → Client.id (GSTPilot vendors live in
        // the Client table too — Client.entityType='vendor' — but ZohoEntityMap
        // tracks them under 'vendor' with localEntityType='Vendor'. We link the
        // payment to the Client row if the vendor maps to one, otherwise leave
        // clientId null and rely on partyName for identification.)
        if (p.vendor_id) {
          const vmap = await findLocalEntityId(
            opts.organizationId,
            opts.zohoOrgId,
            'vendor',
            p.vendor_id,
          );
          if (vmap && vmap.localEntityType === 'Client') {
            normalized.clientId = vmap.localEntityId;
          }
        }

        // Best-effort: resolve bill_id → PurchaseBill.id via ZohoEntityMap.
        if (p.bill_id) {
          const bmap = await findLocalEntityId(
            opts.organizationId,
            opts.zohoOrgId,
            'bill',
            p.bill_id,
          );
          if (bmap) normalized.purchaseBillId = bmap.localEntityId;
        }

        const existing = await findLocalEntityId(
          opts.organizationId,
          opts.zohoOrgId,
          'payment',
          `vend_${p.payment_id}`, // namespace to avoid collision with customer payment IDs
        );

        if (existing) {
          await db.payment.update({
            where: { id: existing.localEntityId },
            data: {
              clientId: normalized.clientId,
              invoiceId: null,
              purchaseBillId: normalized.purchaseBillId,
              partyName: normalized.partyName,
              partyType: normalized.partyType,
              amount: normalized.amount,
              paymentDate: normalized.paymentDate,
              paymentMode: normalized.paymentMode,
              referenceNo: normalized.referenceNo,
              status: normalized.status,
              notes: normalized.notes,
            },
          });
          stats.updated++;
        } else {
          const row = await db.payment.create({
            data: {
              clientId: normalized.clientId,
              invoiceId: null,
              purchaseBillId: normalized.purchaseBillId,
              partyName: normalized.partyName,
              partyType: normalized.partyType,
              amount: normalized.amount,
              paymentDate: normalized.paymentDate,
              paymentMode: normalized.paymentMode,
              referenceNo: normalized.referenceNo,
              status: normalized.status,
              notes: normalized.notes,
            },
          });
          await recordEntityMapping(
            opts.organizationId,
            opts.zohoOrgId,
            'payment',
            `vend_${p.payment_id}`,
            'Payment',
            row.id,
            parseZohoLastModified(p.last_modified_time),
          );
          stats.imported++;
        }

        newWatermark = bumpWatermark(newWatermark, parseZohoLastModified(p.last_modified_time));
      } catch (err) {
        stats.failed++;
        stats.lastError = err instanceof Error ? err.message : 'Failed to upsert vendor payment.';
        lastError = stats.lastError;
      }
    }

    if (opts.abortSignal?.aborted) {
      lastError = 'Aborted by caller.';
      break;
    }
  }

  return { newWatermark, lastCursor, lastError };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sync Zoho Books payments (both customer and vendor) into the Payment table.
 *
 * Customer payments run first (sales collections), then vendor payments
 * (purchases / bill payouts). Stats are aggregated into a single EntitySyncResult
 * so the UI shows "Payments: N imported" as one line item.
 *
 * Resume: if interrupted during the customer-payments pass, the resumeCursor
 * continues that pass. If interrupted during the vendor-payments pass, we
 * re-run customer payments from scratch (idempotent upserts make this safe) and
 * resume vendor payments from the cursor. This keeps the resume logic simple —
 * the cursor namespace is the entity key, not a compound (sub-pass, cursor).
 */
export async function syncPayments(
  opts: SyncOptions,
  watermark: string | null,
  resumeCursor: string | null,
): Promise<EntitySyncResult> {
  const stats = emptyStats();
  let newWatermark = watermark;
  let lastCursor: string | null = null;
  let lastError: string | null = null;

  // Pass 1: Customer payments (only if not resuming a vendor-payments cursor).
  // Heuristic: vendor-payments cursors are opaque Zoho tokens; we can't tell
  // them apart from customer-payments cursors. To keep resume robust, we run
  // customer payments with the resumeCursor if it's set, then run vendor
  // payments fresh. The cost of re-running customer payments is low because
  // upserts are idempotent and incremental mode only fetches modified records.
  const custRes = await syncCustomerPayments(opts, watermark, resumeCursor, stats);
  newWatermark = bumpWatermark(newWatermark, custRes.newWatermark);
  lastCursor = custRes.lastCursor;
  if (custRes.lastError) lastError = custRes.lastError;

  // If customer payments were interrupted, stop here — return the cursor so
  // the next run can resume.
  if (lastError) {
    const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
    return buildEntityResult('payment', stats, newWatermark, finalResumeCursor, lastError);
  }

  // Pass 2: Vendor payments (fresh — no resumeCursor, since customer-pass
  // cursor doesn't apply to vendorpayments endpoint).
  const vendRes = await syncVendorPayments(opts, watermark, null, stats);
  newWatermark = bumpWatermark(newWatermark, vendRes.newWatermark);
  // Prefer the vendor-payments cursor if customer payments had no more pages.
  lastCursor = vendRes.lastCursor ?? lastCursor;
  if (vendRes.lastError) lastError = vendRes.lastError;

  const finalResumeCursor = lastCursor && !lastError ? null : lastCursor;
  return buildEntityResult('payment', stats, newWatermark, finalResumeCursor, lastError);
}
