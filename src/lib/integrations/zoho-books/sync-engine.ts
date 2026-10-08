// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Full Sync Engine (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Orchestrates synchronization of ALL 13 Zoho Books modules into Prisma:
//   1.  Customers          → ZohoCustomer      (GET /contacts?contact_type=customer)
//   2.  Vendors            → ZohoVendor        (GET /contacts?contact_type=vendor)
//   3.  Items              → ZohoItem          (GET /items)
//   4.  Invoices           → ZohoInvoice       (GET /invoices)
//   5.  Bills              → ZohoBill          (GET /bills)
//   6.  Payments Received  → ZohoPaymentReceived (GET /customerpayments)
//   7.  Payments Made      → ZohoPaymentMade   (GET /vendorpayments)
//   8.  Credit Notes       → ZohoCreditNote    (GET /creditnotes)
//   9.  Expenses           → ZohoExpense       (GET /expenses)
//   10. Taxes              → ZohoTax           (GET /settings/taxes)
//   11. Journals           → ZohoJournalEntry  (GET /journals)
//   12. Bank Accounts      → ZohoBankAccount   (GET /bankaccounts)
//   13. Bank Transactions  → ZohoBankTransaction (GET /banktransactions)
//
// Every record stores: zohoId, organizationId, zohoOrgId, createdTime,
// modifiedTime, lastSyncedAt.
//
// Relationships maintained:
//   Invoice → Customer, Bill → Vendor, Payment → Invoice, Item → Invoice Lines,
//   Expense → Vendor, Bank Transaction → Bank Account
//
// Supports: Full Sync (all records) + Incremental Sync (modified since last sync)
//
// Progress: the ZohoSyncLog.currentEntity field is updated before each module
// so the UI can poll GET /api/integrations/zoho/sync/status and show
// "Fetching Customers…", "Fetching Invoices…", etc.
//
// Error handling: 401 (token expired → auto-refresh via getValidAccessToken),
// 403 (forbidden), 404 (not found), 429 (rate limit → backoff), 500 (server error).
// Each error is captured per-module; the sync continues with remaining modules
// and reports `partial` status if any module failed.
//
// NEVER uses mock data. Every record comes from the real Zoho Books REST API.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { zohoGet } from './client';
import { getValidAccessToken, loadTokens } from './oauth';
import { syncZohoCustomersIntoDb } from './customers';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncMode = 'full' | 'incremental';
export type SyncStatus = 'running' | 'completed' | 'partial' | 'failed';

export interface SyncModuleResult {
  module: string;
  status: 'ok' | 'error' | 'skipped';
  fetched: number;
  imported: number;
  updated: number;
  failed: number;
  error?: string;
  httpStatus?: number;
}

export interface SyncEngineResult {
  ok: boolean;
  status: SyncStatus;
  mode: SyncMode;
  syncLogId: string;
  zohoOrgId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalFetched: number;
  totalImported: number;
  totalUpdated: number;
  totalFailed: number;
  modules: SyncModuleResult[];
  error: string | null;
}

// ─── The 13 module definitions ────────────────────────────────────────────────
//
// Each module has:
//   - key: the entity name (matches ZohoSyncLog.currentEntity)
//   - label: human-readable label for progress display
//   - endpoint: the Zoho Books REST path
//   - responseKey: the JSON key in the Zoho response that holds the array
//   - upsert: the function that takes each raw Zoho record and upserts it

interface ModuleDef {
  key: string;
  label: string;
  endpoint: string;
  responseKey: string;

  upsert: (orgId: string, zohoOrgId: string, record: any) => Promise<{ imported: number; updated: number; failed: number }>;
  /**
   * Optional: path to the DETAIL endpoint for each record.
   *
   * Zoho Books LIST endpoints (e.g. GET /invoices) return summary fields only
   * (invoice_number, total, balance, status, date). They do NOT return:
   *   - sub_total
   *   - tax_total / cgst / sgst / igst / cess
   *   - line_items
   *   - custom fields, notes, billing/shipping address
   *
   * To get the full record (needed for GST reconciliation, invoice totals
   * breakdown, and line-item-level analysis), we must fetch each record
   * individually via GET /invoices/{invoice_id} (same for bills).
   *
   * When `detailPath` is set, fetchModule fetches the detail for each record
   * in parallel (concurrency 5) and merges the detail fields into the list
   * record before calling `upsert`. Detail-fetch failures are non-fatal —
   * the record is still upserted with whatever list data is available.
   */
  detailPath?: (record: any) => string | null;
  /** The JSON key holding the single detail record (e.g. 'invoice', 'bill'). */
  detailKey?: string;
}

// ─── Module upsert functions ─────────────────────────────────────────────────

 
function num(v: any, def = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? def : n;
}

 
function str(v: any, def: string | null = null): string | null {
  if (v === undefined || v === null || v === '') return def;
  return String(v);
}

 
function date(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Vendors ──────────────────────────────────────────────────────────────────
 
async function upsertVendor(orgId: string, zohoOrgId: string, v: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoContactId = str(v.contact_id) || '';
    if (!zohoContactId) { failed++; return { imported, updated, failed }; }
    const data = {
      contactName: str(v.contact_name, '') || v.company_name || 'Unknown',
      companyName: str(v.company_name),
      gstNumber: str(v.gstin),
      email: str(v.email),
      phone: str(v.phone),
      currency: str(v.currency_code),
      paymentTerms: num(v.payment_terms, 0) || null,
      outstandingPayable: num(v.outstanding_payable_amount, 0),
      status: str(v.status, 'active') || 'active',
      billingAddress: v.billing_address ? JSON.stringify(v.billing_address) : null,
      shippingAddress: v.shipping_address ? JSON.stringify(v.shipping_address) : null,
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(v.created_time),
      zohoUpdatedAt: date(v.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip instead of findFirst+update/create (2).
    // Uses the @@unique([organizationId, zohoOrgId, zohoContactId]) constraint.
    const created = await db.zohoVendor.upsert({
      where: { organizationId_zohoOrgId_zohoContactId: { organizationId: orgId, zohoOrgId, zohoContactId } },
      create: { organizationId: orgId, zohoOrgId, zohoContactId, ...data },
      update: data,
    });
    if (created.createdAt.getTime() === created.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] vendor upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
 
async function upsertInvoice(orgId: string, zohoOrgId: string, inv: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoInvoiceId = str(inv.invoice_id) || '';
    if (!zohoInvoiceId) { failed++; return { imported, updated, failed }; }
    const data = {
      invoiceNumber: str(inv.invoice_number),
      customerId: str(inv.customer_id),
      customerName: str(inv.customer_name),
      status: str(inv.status, 'draft') || 'draft',
      date: str(inv.date),
      dueDate: str(inv.due_date),
      subTotal: num(inv.sub_total, 0),
      total: num(inv.total, 0),
      balance: num(inv.balance, 0),
      paidAmount: num(inv.paid_amount, 0),
      cgst: num(inv.cgst, 0) + num(inv.total_cgst, 0),
      sgst: num(inv.sgst, 0) + num(inv.total_sgst, 0),
      igst: num(inv.igst, 0) + num(inv.total_igst, 0),
      cess: num(inv.cess, 0) + num(inv.total_cess, 0),
      totalTax: num(inv.tax_total, 0),
      currencyCode: str(inv.currency_code),
      lineItems: inv.line_items ? JSON.stringify(inv.line_items) : '[]',
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(inv.created_time),
      zohoUpdatedAt: date(inv.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const created = await db.zohoInvoice.upsert({
      where: { organizationId_zohoOrgId_zohoInvoiceId: { organizationId: orgId, zohoOrgId, zohoInvoiceId } },
      create: { organizationId: orgId, zohoOrgId, zohoInvoiceId, ...data },
      update: data,
    });
    if (created.createdAt.getTime() === created.updatedAt.getTime()) imported++;
    else updated++;

    // ── Mirror into native Invoice table so the Invoices page shows real
    // Zoho data (not just native invoices). Idempotent via ZohoEntityMap.
    try {
      await mirrorInvoiceToNativeInvoice(orgId, zohoOrgId, zohoInvoiceId, inv);
    } catch (mirrorErr) {
      console.warn(`[zoho-sync] invoice mirror to native Invoice failed for ${zohoInvoiceId}:`, mirrorErr instanceof Error ? mirrorErr.message : mirrorErr);
    }
  } catch (err) { failed++; console.error('[zoho-sync] upsertInvoice upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Bills ────────────────────────────────────────────────────────────────────
 
async function upsertBill(orgId: string, zohoOrgId: string, bill: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoBillId = str(bill.bill_id) || '';
    if (!zohoBillId) { failed++; return { imported, updated, failed }; }
    const data = {
      billNumber: str(bill.bill_number),
      vendorId: str(bill.vendor_id),
      vendorName: str(bill.vendor_name),
      status: str(bill.status, 'open') || 'open',
      date: str(bill.date),
      dueDate: str(bill.due_date),
      subTotal: num(bill.sub_total, 0),
      total: num(bill.total, 0),
      balance: num(bill.balance, 0),
      paidAmount: num(bill.paid_amount, 0),
      cgst: num(bill.cgst, 0) + num(bill.total_cgst, 0),
      sgst: num(bill.sgst, 0) + num(bill.total_sgst, 0),
      igst: num(bill.igst, 0) + num(bill.total_igst, 0),
      cess: num(bill.cess, 0) + num(bill.total_cess, 0),
      totalTax: num(bill.tax_total, 0),
      currencyCode: str(bill.currency_code),
      lineItems: bill.line_items ? JSON.stringify(bill.line_items) : '[]',
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(bill.created_time),
      zohoUpdatedAt: date(bill.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoBill.upsert({
      where: { organizationId_zohoOrgId_zohoBillId: { organizationId: orgId, zohoOrgId, zohoBillId } },
      create: { organizationId: orgId, zohoOrgId, zohoBillId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;

    // ── Mirror into PurchaseBill so the GST Reconciliation engine (which reads
    // db.purchaseBill) can compare Zoho bills against GSTR-2B. Idempotent via
    // ZohoEntityMap — re-running sync NEVER creates duplicate PurchaseBills.
    // Best-effort: a mirror failure does NOT fail the bill import above.
    try {
      await mirrorBillToPurchaseBill(orgId, zohoOrgId, zohoBillId, bill);
    } catch (mirrorErr) {
      console.warn(`[zoho-sync] bill mirror to PurchaseBill failed for ${zohoBillId}:`, mirrorErr instanceof Error ? mirrorErr.message : mirrorErr);
    }
  } catch (err) { failed++; console.error('[zoho-sync] upsertBill upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── PurchaseBill mirror (feeds GST Reconciliation — requirement #8) ──────────
//
// The reconciliation engine (src/app/api/gst-reconciliation/run/route.ts) reads
// `db.purchaseBill.findMany({ where: { client: { firmId: organizationId } } })`.
// To include Zoho bills WITHOUT modifying that engine, we mirror each ZohoBill
// into a PurchaseBill row, scoped under a Client whose firmId = organizationId.
//
// Idempotency: ZohoEntityMap (zohoEntityType='bill', zohoEntityId=zohoBillId)
// stores the local PurchaseBill id. On re-sync, the existing PurchaseBill is
// updated — never duplicated.
//
// Vendor GSTIN: resolved from the synced ZohoVendor table (by zohoContactId) so
// the reconciliation match engine can compare supplier GSTINs against GSTR-2B.
 
async function mirrorBillToPurchaseBill(orgId: string, zohoOrgId: string, zohoBillId: string, bill: any) {
  // 1. Resolve the vendor's GSTIN from the ZohoVendor table (synced separately).
  const vendorContactId = str(bill.vendor_id);
  let vendorGstin: string | null = str(bill.gstin);
  if (!vendorGstin && vendorContactId) {
    const vendor = await db.zohoVendor.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoContactId: vendorContactId },
      select: { gstNumber: true },
    });
    vendorGstin = vendor?.gstNumber ?? null;
  }

  // 2. Ensure a Client row exists for the vendor (firmId = orgId). This is the
  //    "owning party" the reconciliation query joins on. Idempotent by gstin.
  const firmId = orgId;
  // Ensure the Firm exists (the customer mirror does the same).
  await db.firm.upsert({
    where: { id: firmId },
    create: { id: firmId, name: 'VEYRO Org', subscriptionPlan: 'enterprise', maxClients: 100000, isActive: true },
    update: { isActive: true },
  }).catch(() => {});
  const clientGstin = (vendorGstin && vendorGstin.trim()) || `ZOHO-VENDOR-${vendorContactId || zohoBillId}`;
  const clientTradeName = str(bill.vendor_name) || 'Zoho Vendor';
  const client = await db.client.upsert({
    where: { gstin: clientGstin },
    create: {
      gstin: clientGstin,
      tradeName: clientTradeName,
      legalName: clientTradeName,
      status: 'active',
      firmId,
    },
    update: {
      tradeName: clientTradeName,
      legalName: clientTradeName,
      firmId,
    },
  });

  // 3. Look up the existing PurchaseBill via ZohoEntityMap.
  const mapping = await db.zohoEntityMap.findUnique({
    where: {
      organizationId_zohoOrgId_zohoEntityType_zohoEntityId: {
        organizationId: orgId,
        zohoOrgId,
        zohoEntityType: 'bill',
        zohoEntityId: zohoBillId,
      },
    },
  });

  const taxableValue = num(bill.sub_total, 0) || num(bill.total, 0);
  const cgst = num(bill.cgst, 0) + num(bill.total_cgst, 0);
  const sgst = num(bill.sgst, 0) + num(bill.total_sgst, 0);
  const igst = num(bill.igst, 0) + num(bill.total_igst, 0);
  const cess = num(bill.cess, 0) + num(bill.total_cess, 0);
  const gstAmount = cgst + sgst + igst + cess;
  const totalAmount = num(bill.total, 0);
  const paidAmount = num(bill.paid_amount, 0);
  const balanceAmount = num(bill.balance, 0);

  const purchaseData = {
    clientId: client.id,
    vendorName: str(bill.vendor_name) || 'Zoho Vendor',
    vendorGstin: vendorGstin || clientGstin,
    invoiceNo: str(bill.bill_number) || `ZOHO-${zohoBillId}`,
    invoiceDate: str(bill.date) || new Date().toISOString().slice(0, 10),
    dueDate: str(bill.due_date),
    taxableValue,
    cgst,
    sgst,
    igst,
    cess,
    gstAmount,
    totalAmount,
    paidAmount,
    balanceAmount,
    status: str(bill.status, 'recorded') || 'recorded',
    paymentStatus: balanceAmount <= 0 && paidAmount > 0 ? 'paid' : 'unpaid',
    category: 'Zoho Books',
    notes: `Synced from Zoho Books (bill_id: ${zohoBillId})`,
  };

  if (mapping) {
    // Update the existing PurchaseBill.
    await db.purchaseBill.update({
      where: { id: mapping.localEntityId },
      data: purchaseData,
    });
    // Refresh the mapping's lastSyncedAt.
    await db.zohoEntityMap.update({
      where: { id: mapping.id },
      data: {
        lastModifiedAt: date(bill.last_modified_time) ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  } else {
    // Create a new PurchaseBill + mapping.
    const created = await db.purchaseBill.create({ data: purchaseData });
    await db.zohoEntityMap.create({
      data: {
        organizationId: orgId,
        zohoOrgId,
        zohoEntityType: 'bill',
        zohoEntityId: zohoBillId,
        localEntityType: 'PurchaseBill',
        localEntityId: created.id,
        lastModifiedAt: date(bill.last_modified_time) ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  }
}

// ─── Invoice mirror (ZohoInvoice → native Invoice) ──────────────────────────
//
// The Invoices page (view=invoices) reads from db.invoice.findMany({ where: {
// client: { firmId } } }). Without this mirror, the 6 real ZohoInvoices are
// HIDDEN from the Invoices page — the user only sees native invoices.
//
// Idempotent via ZohoEntityMap (zohoEntityType='invoice'). Re-running sync
// NEVER creates duplicate native Invoices.
//
// Best-effort: a mirror failure does NOT fail the invoice import above.

async function mirrorInvoiceToNativeInvoice(orgId: string, zohoOrgId: string, zohoInvoiceId: string, inv: any) {
  // 1. Resolve the customer's Client row (created by the Customer→Client mirror).
  //    The mirror uses gstin = ZOHO-CONTACT-{zohoContactId} for customers
  //    without a real GSTIN.
  const zohoCustomerId = str(inv.customer_id);
  let buyerGstin: string | null = str(inv.gstin);
  let clientRow: { id: string } | null = null;
  if (zohoCustomerId) {
    // Look up the ZohoCustomer to get the GSTIN.
    const zc = await db.zohoCustomer.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoContactId: zohoCustomerId },
      select: { gstNumber: true, contactName: true, companyName: true },
    });
    if (zc?.gstNumber?.trim()) buyerGstin = zc.gstin.trim();
    // Find the Client row by gstin (real or synthetic).
    const clientGstin = buyerGstin?.trim() || `ZOHO-CONTACT-${zohoCustomerId}`;
    clientRow = await db.client.findUnique({
      where: { gstin: clientGstin },
      select: { id: true },
    }).catch(() => null);
  }
  // If no Client row exists (customer mirror didn't run), create a stub.
  if (!clientRow && zohoCustomerId) {
    const clientGstin = buyerGstin?.trim() || `ZOHO-CONTACT-${zohoCustomerId}`;
    await db.firm.upsert({
      where: { id: orgId },
      create: { id: orgId, name: 'VEYRO Org', subscriptionPlan: 'enterprise', maxClients: 100000, isActive: true },
      update: { isActive: true },
    }).catch(() => {});
    clientRow = await db.client.upsert({
      where: { gstin: clientGstin },
      create: {
        gstin: clientGstin,
        tradeName: str(inv.customer_name) || 'Zoho Customer',
        legalName: str(inv.customer_name) || 'Zoho Customer',
        status: 'active',
        firmId: orgId,
      },
      update: {},
    }).then((c) => ({ id: c.id })).catch(() => null);
  }
  if (!clientRow) return; // can't mirror without a client

  // 2. Look up existing mapping.
  const mapping = await db.zohoEntityMap.findUnique({
    where: {
      organizationId_zohoOrgId_zohoEntityType_zohoEntityId: {
        organizationId: orgId, zohoOrgId,
        zohoEntityType: 'invoice', zohoEntityId: zohoInvoiceId,
      },
    },
  });

  const cgst = num(inv.cgst, 0) + num(inv.total_cgst, 0);
  const sgst = num(inv.sgst, 0) + num(inv.total_sgst, 0);
  const igst = num(inv.igst, 0) + num(inv.total_igst, 0);
  const cess = num(inv.cess, 0) + num(inv.total_cess, 0);
  const gstAmount = cgst + sgst + igst + cess;
  const totalAmount = num(inv.total, 0);
  const paidAmount = num(inv.paid_amount, 0);
  const balanceAmount = num(inv.balance, 0);
  const taxableValue = num(inv.sub_total, 0) || (totalAmount - gstAmount);

  const invoiceData = {
    clientId: clientRow.id,
    invoiceNumber: str(inv.invoice_number) || `ZOHO-${zohoInvoiceId}`,
    invoiceDate: str(inv.date) || new Date().toISOString().slice(0, 10),
    sellerGstin: `ZOHO-ORG-${zohoOrgId}`, // org's own GSTIN placeholder
    buyerGstin: buyerGstin || undefined,
    buyerName: str(inv.customer_name) || undefined,
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue,
    cgst, sgst, igst, cess,
    totalAmount,
    gstAmount,
    paidAmount,
    balanceAmount,
    paymentStatus: balanceAmount <= 0 && paidAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    status: str(inv.status, 'draft') || 'draft',
    dueDate: str(inv.due_date) || undefined,
    notes: `Synced from Zoho Books (invoice_id: ${zohoInvoiceId})`,
  };

  if (mapping) {
    await db.invoice.update({ where: { id: mapping.localEntityId }, data: invoiceData });
    await db.zohoEntityMap.update({
      where: { id: mapping.id },
      data: {
        lastModifiedAt: date(inv.last_modified_time) ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  } else {
    const created = await db.invoice.create({ data: invoiceData });
    await db.zohoEntityMap.create({
      data: {
        organizationId: orgId, zohoOrgId,
        zohoEntityType: 'invoice', zohoEntityId: zohoInvoiceId,
        localEntityType: 'Invoice', localEntityId: created.id,
        lastModifiedAt: date(inv.last_modified_time) ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  }
}

// ─── BankAccount mirror (ZohoBankAccount → native BankAccount) ──────────────
//
// The Banking page (view=banking) reads from db.bankAccount.findMany({ where:
// { organizationId } }). Without this mirror, the 4 real ZohoBankAccounts are
// HIDDEN — and worse, the Banking page auto-seeds 4 DEMO accounts (HDFC/ICICI/
// Axis/Cash) which the user explicitly told us to remove.
//
// Idempotent via ZohoEntityMap (zohoEntityType='bank_account'). Re-running
// sync NEVER creates duplicate native BankAccounts.
//
// Best-effort: a mirror failure does NOT fail the bank account import above.

async function mirrorBankAccountToNativeBankAccount(orgId: string, zohoOrgId: string, zohoAccountId: string, ba: any) {
  const mapping = await db.zohoEntityMap.findUnique({
    where: {
      organizationId_zohoOrgId_zohoEntityType_zohoEntityId: {
        organizationId: orgId, zohoOrgId,
        zohoEntityType: 'bank_account', zohoEntityId: zohoAccountId,
      },
    },
  });

  const accountNumber = str(ba.account_number) || str(ba.bank_account_number) || '';
  const masked = accountNumber
    ? accountNumber.length > 4
      ? `****${accountNumber.slice(-4)}`
      : accountNumber
    : '****';

  const accountData = {
    organizationId: orgId,
    bankName: str(ba.bank_name) || str(ba.account_name) || 'Zoho Bank Account',
    accountNumber,
    accountMasked: masked,
    accountType: str(ba.account_type) || 'current',
    ifsc: str(ba.ifsc_code) || null,
    owner: str(ba.account_name) || null,
    balance: num(ba.balance, 0),
    availableBalance: num(ba.available_balance, 0),
    currency: str(ba.currency_code) || 'INR',
    provider: 'zoho_books', // NOT 'mock' — this is real data from Zoho Books
    status: str(ba.status, 'active') || 'active',
    lastSyncAt: new Date(),
  };

  if (mapping) {
    await db.bankAccount.update({ where: { id: mapping.localEntityId }, data: accountData });
    await db.zohoEntityMap.update({
      where: { id: mapping.id },
      data: {
        lastModifiedAt: date(ba.last_modified_time) ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  } else {
    const created = await db.bankAccount.create({ data: accountData });
    await db.zohoEntityMap.create({
      data: {
        organizationId: orgId, zohoOrgId,
        zohoEntityType: 'bank_account', zohoEntityId: zohoAccountId,
        localEntityType: 'BankAccount', localEntityId: created.id,
        lastModifiedAt: date(ba.last_modified_time) ?? undefined,
        lastSyncedAt: new Date(),
      },
    });
  }
}

// ─── Payments Received ────────────────────────────────────────────────────────
 
async function upsertPaymentReceived(orgId: string, zohoOrgId: string, p: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoPaymentId = str(p.payment_id) || '';
    if (!zohoPaymentId) { failed++; return { imported, updated, failed }; }
    const data = {
      paymentNumber: str(p.payment_number),
      customerId: str(p.customer_id),
      customerName: str(p.customer_name),
      invoiceId: str(p.invoice_id),
      invoiceNumber: str(p.invoice_number),
      amount: num(p.amount, 0),
      date: str(p.date),
      paymentMode: str(p.payment_mode),
      referenceNumber: str(p.reference_number),
      description: str(p.description),
      currencyCode: str(p.currency_code),
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(p.created_time),
      zohoUpdatedAt: date(p.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoPaymentReceived.upsert({
      where: { organizationId_zohoOrgId_zohoPaymentId: { organizationId: orgId, zohoOrgId, zohoPaymentId } },
      create: { organizationId: orgId, zohoOrgId, zohoPaymentId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] upsertPaymentReceived upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Payments Made ────────────────────────────────────────────────────────────
 
async function upsertPaymentMade(orgId: string, zohoOrgId: string, p: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoPaymentId = str(p.payment_id) || '';
    if (!zohoPaymentId) { failed++; return { imported, updated, failed }; }
    const data = {
      paymentNumber: str(p.payment_number),
      vendorId: str(p.vendor_id),
      vendorName: str(p.vendor_name),
      billId: str(p.bill_id),
      billNumber: str(p.bill_number),
      amount: num(p.amount, 0),
      date: str(p.date),
      paymentMode: str(p.payment_mode),
      referenceNumber: str(p.reference_number),
      description: str(p.description),
      currencyCode: str(p.currency_code),
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(p.created_time),
      zohoUpdatedAt: date(p.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoPaymentMade.upsert({
      where: { organizationId_zohoOrgId_zohoPaymentId: { organizationId: orgId, zohoOrgId, zohoPaymentId } },
      create: { organizationId: orgId, zohoOrgId, zohoPaymentId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] upsertPaymentMade upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Credit Notes ─────────────────────────────────────────────────────────────
 
async function upsertCreditNote(orgId: string, zohoOrgId: string, cn: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoCreditNoteId = str(cn.creditnote_id) || '';
    if (!zohoCreditNoteId) { failed++; return { imported, updated, failed }; }
    const data = {
      creditNoteNumber: str(cn.creditnote_number),
      date: str(cn.date),
      status: str(cn.status, 'open') || 'open',
      customerId: str(cn.customer_id),
      customerName: str(cn.customer_name),
      invoiceId: str(cn.invoice_id),
      invoiceNumber: str(cn.invoice_number),
      total: num(cn.total, 0),
      subTotal: num(cn.sub_total, 0),
      totalCredited: num(cn.total_credited, 0),
      balance: num(cn.balance, 0),
      currencyCode: str(cn.currency_code),
      reason: str(cn.reason),
      notes: str(cn.notes),
      lineItems: cn.line_items ? JSON.stringify(cn.line_items) : '[]',
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(cn.created_time),
      zohoUpdatedAt: date(cn.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoCreditNote.upsert({
      where: { organizationId_zohoOrgId_zohoCreditNoteId: { organizationId: orgId, zohoOrgId, zohoCreditNoteId } },
      create: { organizationId: orgId, zohoOrgId, zohoCreditNoteId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] upsertCreditNote upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
 
async function upsertExpense(orgId: string, zohoOrgId: string, e: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoExpenseId = str(e.expense_id) || '';
    if (!zohoExpenseId) { failed++; return { imported, updated, failed }; }
    const data = {
      expenseNumber: str(e.expense_number),
      vendorId: str(e.vendor_id),
      vendorName: str(e.vendor_name),
      accountId: str(e.account_id),
      accountName: str(e.account_name),
      amount: num(e.total, 0) || num(e.amount, 0),
      date: str(e.date),
      status: str(e.status, 'unbilled') || 'unbilled',
      paymentMode: str(e.payment_mode),
      referenceNumber: str(e.reference_number),
      description: str(e.description),
      currencyCode: str(e.currency_code),
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(e.created_time),
      zohoUpdatedAt: date(e.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoExpense.upsert({
      where: { organizationId_zohoOrgId_zohoExpenseId: { organizationId: orgId, zohoOrgId, zohoExpenseId } },
      create: { organizationId: orgId, zohoOrgId, zohoExpenseId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] upsertExpense upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Taxes ────────────────────────────────────────────────────────────────────
 
async function upsertTax(orgId: string, zohoOrgId: string, t: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoTaxId = str(t.tax_id) || '';
    if (!zohoTaxId) { failed++; return { imported, updated, failed }; }
    const data = {
      taxName: str(t.tax_name, '') || 'Unknown Tax',
      taxPercentage: num(t.tax_percentage, 0),
      taxType: str(t.tax_type, 'tax') || 'tax',
      taxAuthorityName: str(t.tax_authority_name),
      status: str(t.status, 'active') || 'active',
      isDefault: Boolean(t.is_default),
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(t.created_time),
      zohoUpdatedAt: date(t.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoTax.upsert({
      where: { organizationId_zohoOrgId_zohoTaxId: { organizationId: orgId, zohoOrgId, zohoTaxId } },
      create: { organizationId: orgId, zohoOrgId, zohoTaxId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] upsertTax upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Journals ─────────────────────────────────────────────────────────────────
 
async function upsertJournal(orgId: string, zohoOrgId: string, j: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const journalNumber = str(j.journal_number) || '';
    const zohoJournalId = str(j.journal_id) || journalNumber;
    if (!zohoJournalId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoJournalEntry.findFirst({
      where: { organizationId: orgId, zohoOrgId, journalNumber },
    });
    // Normalize journal lines
     
    const lines = (j.line_items || j.journal_lines || []).map((l: any) => ({
      account: l.account_name || l.account_id || '',
      debit: num(l.debit, 0),
      credit: num(l.credit, 0),
      description: str(l.description),
    }));
    const data = {
      journalNumber,
      referenceNumber: str(j.reference_number),
      date: str(j.date) || str(j.entry_date) || new Date().toISOString().slice(0, 10),
      totalDebit: num(j.total_debit, 0),
      totalCredit: num(j.total_credit, 0),
      notes: str(j.notes),
      lines: JSON.stringify(lines),
      status: str(j.status, 'posted') || 'posted',
      updatedAt: new Date(),
    };
    if (existing) { await db.zohoJournalEntry.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoJournalEntry.create({ data: { organizationId: orgId, zohoOrgId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertJournal upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Bank Accounts ────────────────────────────────────────────────────────────
 
async function upsertBankAccount(orgId: string, zohoOrgId: string, ba: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoAccountId = str(ba.account_id) || '';
    if (!zohoAccountId) { failed++; return { imported, updated, failed }; }
    const data = {
      accountName: str(ba.account_name, '') || str(ba.bank_name, '') || 'Bank Account',
      accountNumber: str(ba.account_number) || str(ba.bank_account_number),
      ifscCode: str(ba.ifsc_code),
      bankName: str(ba.bank_name),
      accountType: str(ba.account_type),
      currencyCode: str(ba.currency_code),
      balance: num(ba.balance, 0),
      availableBalance: num(ba.available_balance, 0),
      status: str(ba.status, 'active') || 'active',
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(ba.created_time),
      zohoUpdatedAt: date(ba.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoBankAccount.upsert({
      where: { organizationId_zohoOrgId_zohoAccountId: { organizationId: orgId, zohoOrgId, zohoAccountId } },
      create: { organizationId: orgId, zohoOrgId, zohoAccountId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;

    // ── Mirror into native BankAccount table so the Banking page shows real
    // Zoho bank accounts (provider='zoho_books', NOT 'mock'). Idempotent via
    // ZohoEntityMap. Without this, the Banking page auto-seeds DEMO accounts.
    try {
      await mirrorBankAccountToNativeBankAccount(orgId, zohoOrgId, zohoAccountId, ba);
    } catch (mirrorErr) {
      console.warn(`[zoho-sync] bank account mirror to native BankAccount failed for ${zohoAccountId}:`, mirrorErr instanceof Error ? mirrorErr.message : mirrorErr);
    }
  } catch (err) { failed++; console.error('[zoho-sync] upsertBankAccount upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Bank Transactions ────────────────────────────────────────────────────────
 
async function upsertBankTransaction(orgId: string, zohoOrgId: string, bt: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoTransactionId = str(bt.transaction_id) || '';
    if (!zohoTransactionId) { failed++; return { imported, updated, failed }; }
    const data = {
      bankAccountId: str(bt.bank_account_id),
      accountName: str(bt.account_name),
      amount: num(bt.amount, 0),
      transactionType: str(bt.transaction_type, 'debit') || 'debit',
      transactionDate: str(bt.date) || str(bt.transaction_date),
      description: str(bt.description),
      referenceNumber: str(bt.reference_number),
      status: str(bt.status, 'uncategorized') || 'uncategorized',
      payee: str(bt.payee),
      currencyCode: str(bt.currency_code),
      lastSyncedAt: new Date(),
      zohoCreatedAt: date(bt.created_time),
      zohoUpdatedAt: date(bt.last_modified_time),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoBankTransaction.upsert({
      where: { organizationId_zohoOrgId_zohoTransactionId: { organizationId: orgId, zohoOrgId, zohoTransactionId } },
      create: { organizationId: orgId, zohoOrgId, zohoTransactionId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] upsertBankTransaction upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Items ────────────────────────────────────────────────────────────────────
 
async function upsertItem(orgId: string, zohoOrgId: string, item: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoItemId = str(item.item_id) || '';
    if (!zohoItemId) { failed++; return { imported, updated, failed }; }
    const data = {
      name: str(item.name, '') || 'Unknown Item',
      description: str(item.description),
      itemType: str(item.item_type, 'goods') || 'goods',
      unit: str(item.unit),
      hsnOrSac: str(item.hsn_or_sac) || str(item.hsn_code),
      rate: num(item.rate, 0),
      purchaseRate: num(item.purchase_rate, 0),
      taxName: str(item.tax_name),
      taxPercentage: num(item.tax_percentage, 0),
      isTaxable: item.is_taxable !== false,
      stockOnHand: num(item.stock_on_hand, 0),
      reorderLevel: num(item.reorder_level, 0),
      status: str(item.status, 'active') || 'active',
      source: 'zoho',
      updatedAt: new Date(),
    };
    // Native Prisma .upsert() — 1 DB round-trip (was 2).
    const existing = await db.zohoItem.upsert({
      where: { organizationId_zohoOrgId_zohoItemId: { organizationId: orgId, zohoOrgId, zohoItemId } },
      create: { organizationId: orgId, zohoOrgId, zohoItemId, ...data },
      update: data,
    });
    if (existing.createdAt.getTime() === existing.updatedAt.getTime()) imported++;
    else updated++;
  } catch (err) { failed++; console.error('[zoho-sync] upsertItem upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Module table ─────────────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  { key: 'vendors', label: 'Fetching Vendors', endpoint: '/contacts?contact_type=vendor', responseKey: 'contacts', upsert: upsertVendor },
  { key: 'items', label: 'Fetching Items', endpoint: '/items', responseKey: 'items', upsert: upsertItem },
  { key: 'invoices', label: 'Fetching Invoices', endpoint: '/invoices', responseKey: 'invoices', upsert: upsertInvoice,
    // Fetch each invoice's detail to get sub_total, tax_total, cgst/sgst/igst,
    // cess, and line_items (the list endpoint only returns summary fields).
    detailPath: (inv) => str(inv.invoice_id) ? `/invoices/${inv.invoice_id}` : null,
    detailKey: 'invoice',
  },
  { key: 'bills', label: 'Fetching Bills', endpoint: '/bills', responseKey: 'bills', upsert: upsertBill,
    // Same as invoices — the list endpoint omits tax breakdown + line items.
    detailPath: (bill) => str(bill.bill_id) ? `/bills/${bill.bill_id}` : null,
    detailKey: 'bill',
  },
  { key: 'payments_received', label: 'Fetching Payments Received', endpoint: '/customerpayments', responseKey: 'customerpayments', upsert: upsertPaymentReceived },
  { key: 'payments_made', label: 'Fetching Payments Made', endpoint: '/vendorpayments', responseKey: 'vendorpayments', upsert: upsertPaymentMade },
  { key: 'creditnotes', label: 'Fetching Credit Notes', endpoint: '/creditnotes', responseKey: 'creditnotes', upsert: upsertCreditNote },
  { key: 'expenses', label: 'Fetching Expenses', endpoint: '/expenses', responseKey: 'expenses', upsert: upsertExpense },
  { key: 'taxes', label: 'Fetching Taxes', endpoint: '/settings/taxes', responseKey: 'taxes', upsert: upsertTax },
  { key: 'journals', label: 'Fetching Journals', endpoint: '/journals', responseKey: 'journals', upsert: upsertJournal },
  { key: 'bankaccounts', label: 'Fetching Bank Accounts', endpoint: '/bankaccounts', responseKey: 'bankaccounts', upsert: upsertBankAccount },
  { key: 'banktransactions', label: 'Fetching Bank Transactions', endpoint: '/banktransactions', responseKey: 'banktransactions', upsert: upsertBankTransaction },
];

// ─── Detail enrichment (invoices, bills) ─────────────────────────────────────
//
// Fetches the full detail for each record in parallel (concurrency 5) and
// merges it into the list record. The Zoho LIST endpoint returns summary
// fields only; the DETAIL endpoint returns sub_total, tax_total, cgst/sgst/igst,
// cess, line_items, billing/shipping address, custom fields, notes, etc.
//
// Non-fatal: if a detail fetch fails (404, 429, network error), the record
// is returned with only the list data — we log the failure but don't drop
// the record. This ensures a partial Zoho API outage never loses records.

const DETAIL_CONCURRENCY = 5;

async function enrichWithDetails(
  def: ModuleDef,
  records: unknown[],
  accessToken: string,
  zohoOrgId: string,
): Promise<unknown[]> {
  const detailPath = def.detailPath!;
  const detailKey = def.detailKey!;
  const results: unknown[] = new Array(records.length);

  // Process in batches of DETAIL_CONCURRENCY to avoid hammering the Zoho API.
  for (let i = 0; i < records.length; i += DETAIL_CONCURRENCY) {
    const batch = records.slice(i, i + DETAIL_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (record) => {
        const rec = record as Record<string, unknown>;
        const path = detailPath(rec);
        if (!path) return record; // no detail path → use list record as-is
        const res = await zohoGet<Record<string, unknown>>(
          path,
          accessToken,
          { organizationId: zohoOrgId },
        );
        if (res.error || res.status >= 400 || !res.data) {
          console.warn(
            `[zoho-sync] ${def.key} · detail fetch failed for ${path} · HTTP ${res.status} · ` +
              `${res.error?.slice(0, 120) ?? 'no data'} — using list record`,
          );
          return record; // fall back to list record
        }
        const detail = res.data[detailKey];
        if (!detail || typeof detail !== 'object') {
          console.warn(`[zoho-sync] ${def.key} · detail response missing key "${detailKey}" for ${path} — using list record`);
          return record;
        }
        // Merge: detail fields take priority, but list fields fill any gaps.
        // This preserves list-only fields (like last_modified_time) that some
        // detail endpoints omit.
        return { ...(record as object), ...(detail as object) };
      }),
    );
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      results[i + j] = s.status === 'fulfilled' ? s.value : batch[j];
    }
  }
  return results;
}

// ─── Error message helper ─────────────────────────────────────────────────────

function describeError(status: number, error: string | null, zohoBody: { code?: number; message?: string } | null): string {
  switch (status) {
    case 401: return 'Token expired or revoked — reconnect Zoho Books (401 Unauthorized)';
    case 403: return `Permission denied — check Zoho Books scopes (403 Forbidden)${zohoBody?.message ? ': ' + zohoBody.message : ''}`;
    case 404: return 'Endpoint not found — verify Zoho Books API version (404)';
    case 429: return 'Rate limit exceeded — Zoho Books throttled the request (429). Retry after backoff.';
    case 500: case 502: case 503: return `Zoho Books server error (${status}) — retry attempted. Try again later.`;
    default: return error || `HTTP ${status}`;
  }
}

// ─── Fetch all pages of a module ──────────────────────────────────────────────
//
// 401 AUTO-REFRESH:
//   Zoho access tokens expire after 1 hour. For large organizations a full sync
//   can take longer than that — meaning the token obtained at the start of the
//   sync expires mid-way. When a 401 is received, we call `refreshFn()` to
//   obtain a fresh access token (which transparently refreshes via
//   getValidAccessToken) and retry the page ONCE. This prevents a single token
//   expiry from failing every subsequent module.
//
//   The refreshFn is injected by runZohoFullSync so fetchModule stays pure
//   (no direct dependency on the oauth module).

async function fetchModule(
  def: ModuleDef,
  accessToken: string,
  zohoOrgId: string,
  organizationId: string,
  mode: SyncMode,
  lastSyncAt: Date | null,
  refreshFn: () => Promise<string | null>,
): Promise<SyncModuleResult> {
  const result: SyncModuleResult = {
    module: def.key, status: 'ok', fetched: 0, imported: 0, updated: 0, failed: 0,
  };

  // Mutable token — updated in-place when a 401 triggers a refresh.
  let currentToken = accessToken;

  // Build the initial URL with pagination + incremental filter
  let page = 1;
  let hasMore = true;
  const perPage = 200;

  // Track whether this endpoint supports the last_modified_time_start filter.
  // Some Zoho endpoints (journals, banktransactions) don't support it and
  // return HTTP 400 "Invalid value passed for last_modified_time_start". When
  // that happens, we retry the page without the filter (full fetch for that
  // module — safe because upsert is idempotent).
  let skipModifiedTimeFilter = false;

  while (hasMore) {
    const sep = def.endpoint.includes('?') ? '&' : '?';
    let url = `${def.endpoint}${sep}page=${page}&per_page=${perPage}`;

    // Incremental: only fetch records modified since last sync.
    // Zoho Books expects date filters in 'yyyy-MM-dd HH:mm:ss' format (SPACE
    // separator, NOT ISO 'T'). The old code used .toISOString().slice(0,19)
    // which produces '2026-07-15T13:13:30' → Zoho rejects with:
    //   "Invalid value passed for last_modified_time" (HTTP 400, code 2)
    // Fix: replace the 'T' with a space and URL-encode the result.
    // Also: not all endpoints support this param — if we get a 400 about
    // last_modified_time, we retry without it (skipModifiedTimeFilter flag).
    if (mode === 'incremental' && lastSyncAt && !skipModifiedTimeFilter) {
      const since = lastSyncAt.toISOString().slice(0, 19).replace('T', ' ');
      url += `&last_modified_time_start=${encodeURIComponent(since)}`;
    }

    console.log(`[zoho-sync] ${def.key} · page ${page} · GET ${url}`);

    let res = await zohoGet<{ code?: number; message?: string; page_context?: { has_more_page?: boolean; page?: number } } & Record<string, unknown>>(
      url,
      currentToken,
      { organizationId: zohoOrgId },
    );

    // ── 401 AUTO-REFRESH: the access token expired mid-sync. Call refreshFn
    // to obtain a fresh token (getValidAccessToken handles the refresh-token
    // grant + persists the new access token) and retry the page ONCE. If the
    // refresh also fails (e.g. refresh token revoked), treat as a hard error.
    if (res.status === 401) {
      console.warn(`[zoho-sync] ${def.key} · 401 received — attempting token refresh…`);
      const refreshed = await refreshFn();
      if (refreshed) {
        currentToken = refreshed;
        console.info(`[zoho-sync] ${def.key} · token refreshed — retrying page ${page}`);
        res = await zohoGet<{ code?: number; message?: string; page_context?: { has_more_page?: boolean; page?: number } } & Record<string, unknown>>(
          url,
          currentToken,
          { organizationId: zohoOrgId },
        );
      } else {
        console.error(`[zoho-sync] ${def.key} · refresh failed — refresh token may be revoked`);
      }
    }

    // If incremental filter caused a 400, retry this page without it.
    // The error message could be in res.error (string) or res.data.message (object).
    // Check both — the Zoho client returns res.data=null on non-OK responses
    // with the raw body text in res.error.
    if (res.status === 400 && mode === 'incremental' && !skipModifiedTimeFilter) {
      const errMsg = res.error ?? '';
      const errBody = res.data as { message?: string } | null;
      const bodyMsg = errBody?.message ?? '';
      if (errMsg.includes('last_modified_time') || bodyMsg.includes('last_modified_time')) {
        console.warn(`[zoho-sync] ${def.key} · endpoint doesn't support last_modified_time_start — retrying without filter (full fetch for this module)`);
        skipModifiedTimeFilter = true;
        continue; // retry same page without filter
      }
    }

    if (res.error || res.status >= 400) {
      result.status = 'error';
      result.httpStatus = res.status;
      result.error = describeError(res.status, res.error, res.data);
      console.error(`[zoho-sync] ${def.key} · ERROR · HTTP ${res.status} · ${result.error}`);
      return result;
    }

    const records = (res.data?.[def.responseKey] as unknown[]) ?? [];
    result.fetched += records.length;
    console.log(`[zoho-sync] ${def.key} · page ${page} · fetched ${records.length} records (cumulative: ${result.fetched})`);

    // ── Detail enrichment (invoices, bills) ──
    // The LIST endpoint returns summary fields only. For modules that declare
    // a `detailPath`, fetch each record's full detail (which includes
    // sub_total, tax_total, cgst/sgst/igst, cess, line_items) in parallel
    // (concurrency 5) and merge it into the list record before upsert.
    //
    // Non-fatal: if a detail fetch fails, the record is still upserted with
    // the summary data from the list — we just log the failure.
    let enrichedRecords = records;
    if (def.detailPath && def.detailKey && records.length > 0) {
      enrichedRecords = await enrichWithDetails(def, records, currentToken, zohoOrgId);
    }

    // Upsert each record
    for (const record of enrichedRecords) {
      try {
        const r = await def.upsert(organizationId, zohoOrgId, record);
        result.imported += r.imported;
        result.updated += r.updated;
        result.failed += r.failed;
      } catch (err) {
        result.failed++;
        console.error(`[zoho-sync] ${def.key} · upsert failed for record:`, err instanceof Error ? err.message : err);
      }
    }

    // Pagination
    const ctx = res.data?.page_context;
    hasMore = Boolean(ctx?.has_more_page);
    page = (ctx?.page ?? page) + 1;

    // Safety cap: 500 pages = 100,000 records per module
    if (page > 500) {
      console.warn(`[zoho-sync] ${def.key} · safety cap reached (500 pages)`);
      break;
    }
  }

  console.log(`[zoho-sync] ${def.key} · DONE · fetched=${result.fetched} imported=${result.imported} updated=${result.updated} failed=${result.failed}`);
  return result;
}

// ─── The main sync orchestrator ──────────────────────────────────────────────

export async function runZohoFullSync(opts: {
  organizationId: string;
  userId: string | null;
  mode: SyncMode;
}): Promise<SyncEngineResult> {
  const startedAt = new Date();
  const startTime = Date.now();

  console.log(`[zoho-sync] ═══ SYNC START ═══ org="${opts.organizationId}" user="${opts.userId ?? '(system)'}" mode="${opts.mode}"`);

  // 1. Resolve the Zoho connection: find the token row for this org to get
  //    the zohoOrgId + userId (the sync may be triggered by a system user, so
  //    we look up the most recent active token for the org).
  let resolvedUserId = opts.userId;
  let zohoOrgId = '';
  if (!resolvedUserId) {
    // Find the most recent active Zoho token for this org
    const tokenRow = await db.zohoBooksToken.findFirst({
      where: { organizationId: opts.organizationId, revokedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    resolvedUserId = tokenRow?.userId ?? null;
    zohoOrgId = tokenRow?.zohoOrgId ?? '';
    console.log(`[zoho-sync] resolved userId from token row: ${resolvedUserId ?? 'NONE'} · zohoOrgId: ${zohoOrgId || 'NONE'}`);
  }
  if (!resolvedUserId) {
    console.error(`[zoho-sync] FAILED — no active Zoho token found for org "${opts.organizationId}"`);
    return {
      ok: false,
      status: 'failed',
      mode: opts.mode,
      syncLogId: '',
      zohoOrgId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalFetched: 0, totalImported: 0, totalUpdated: 0, totalFailed: 0,
      modules: [],
      error: 'Zoho Books not connected — complete the OAuth flow first.',
    };
  }

  // Load tokens to get zohoOrgId (getValidAccessToken doesn't return it)
  const { stored } = await loadTokens(opts.organizationId, resolvedUserId);
  if (!stored) {
    console.error(`[zoho-sync] FAILED — loadTokens returned null for org="${opts.organizationId}" user="${resolvedUserId}". Token row missing, revoked, or access token decryption failed (check ZOHO_CLIENT_SECRET env var).`);
    return {
      ok: false,
      status: 'failed',
      mode: opts.mode,
      syncLogId: '',
      zohoOrgId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalFetched: 0, totalImported: 0, totalUpdated: 0, totalFailed: 0,
      modules: [],
      error: 'Zoho Books not connected — complete the OAuth flow first.',
    };
  }
  zohoOrgId = stored.zohoOrgId ?? '';
  if (!zohoOrgId) {
    console.error(`[zoho-sync] FAILED — no zohoOrgId on token row. Reconnect to select a Zoho organization.`);
    return {
      ok: false,
      status: 'failed',
      mode: opts.mode,
      syncLogId: '',
      zohoOrgId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalFetched: 0, totalImported: 0, totalUpdated: 0, totalFailed: 0,
      modules: [],
      error: 'No Zoho Books organization ID found — reconnect to select an organization.',
    };
  }

  // Get a valid access token (auto-refreshes if expired)
  console.log(`[zoho-sync] acquiring access token (auto-refresh if expired)…`);
  const tokenResult = await getValidAccessToken(opts.organizationId, resolvedUserId);
  if (!tokenResult.accessToken) {
    console.error(`[zoho-sync] FAILED — getValidAccessToken returned null: ${tokenResult.error}`);
    return {
      ok: false,
      status: 'failed',
      mode: opts.mode,
      syncLogId: '',
      zohoOrgId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalFetched: 0, totalImported: 0, totalUpdated: 0, totalFailed: 0,
      modules: [],
      error: tokenResult.error || 'Zoho Books token expired — reconnect.',
    };
  }

  const accessToken = tokenResult.accessToken;

  // 2. Create a ZohoSyncLog row (status: running)
  const syncLog = await db.zohoSyncLog.create({
    data: {
      organizationId: opts.organizationId,
      userId: resolvedUserId,
      zohoOrgId,
      status: 'running',
      mode: opts.mode,
      currentEntity: 'connecting',
      stats: '{}',
    },
  });

  const modules: SyncModuleResult[] = [];
  let totalFetched = 0, totalImported = 0, totalUpdated = 0, totalFailed = 0;
  let hadError = false;

  try {
    // 3. Module 1: Customers (reuse the Phase 4 customer sync — battle-tested)
    await db.zohoSyncLog.update({
      where: { id: syncLog.id },
      data: { currentEntity: 'customers' },
    });

    const customerResult = await syncZohoCustomersIntoDb({
      organizationId: opts.organizationId,
      userId: resolvedUserId,
      zohoOrgId,
      accessToken,
    }).then((r) => ({
      module: 'customers',
      status: (r.status === 'failed' ? 'error' : r.status === 'partial' ? 'error' : 'ok') as 'ok' | 'error' | 'skipped',
      fetched: r.totalFetched,
      imported: r.imported,
      updated: r.updated,
      failed: r.failed,
      error: r.error ?? undefined,
    })).catch((e) => ({
      module: 'customers',
      status: 'error' as const,
      fetched: 0, imported: 0, updated: 0, failed: 0,
      error: e instanceof Error ? e.message : 'Customer sync failed',
    }));

    // Also mirror customers into Client table (so GST Returns dropdown is populated)
    if (customerResult.fetched > 0) {
      const zohoCustomers = await db.zohoCustomer.findMany({
        where: { organizationId: opts.organizationId, zohoOrgId },
      });
      // Re-mirror each customer to ensure Client table is in sync
      for (const zc of zohoCustomers) {
        try {
          // Ensure the Firm bridge exists
          await db.firm.upsert({
            where: { id: opts.organizationId },
            create: { id: opts.organizationId, name: zc.companyName || zc.contactName || 'VEYRO Org', subscriptionPlan: 'enterprise', maxClients: 100000, isActive: true },
            update: { isActive: true },
          }).catch(() => {});
          const gstin = zc.gstNumber?.trim() || `ZOHO-CONTACT-${zc.zohoContactId}`;
          await db.client.upsert({
            where: { gstin },
            create: {
              gstin,
              tradeName: zc.companyName || zc.contactName,
              legalName: zc.companyName || zc.contactName,
              contactEmail: zc.email,
              contactPhone: zc.phone,
              status: zc.status || 'active',
              firmId: opts.organizationId,
            },
            update: {
              tradeName: zc.companyName || zc.contactName,
              legalName: zc.companyName || zc.contactName,
              contactEmail: zc.email,
              contactPhone: zc.phone,
              status: zc.status || 'active',
              firmId: opts.organizationId,
            },
          });
        } catch { /* best-effort mirror */ }
      }
    }

    modules.push(customerResult);
    totalFetched += customerResult.fetched;
    totalImported += customerResult.imported;
    totalUpdated += customerResult.updated;
    totalFailed += customerResult.failed;
    if (customerResult.status === 'error') hadError = true;

    // 4. Modules 2-13: fetch each remaining module
    // For incremental sync, find the last successful sync time
    let lastSyncAt: Date | null = null;
    if (opts.mode === 'incremental') {
      const lastSync = await db.zohoSyncLog.findFirst({
        where: { organizationId: opts.organizationId, zohoOrgId, status: 'completed', mode: 'full' },
        orderBy: { startedAt: 'desc' },
      });
      lastSyncAt = lastSync?.startedAt ?? null;
    }

    for (const def of MODULES) {
      // Update progress: "Fetching Invoices…"
      await db.zohoSyncLog.update({
        where: { id: syncLog.id },
        data: { currentEntity: def.key, lastEntity: def.key },
      });

      const r = await fetchModule(def, accessToken, zohoOrgId, opts.organizationId, opts.mode, lastSyncAt, async () => {
        // 401 refresh callback — called when a Zoho API page returns 401
        // (access token expired mid-sync). getValidAccessToken transparently
        // refreshes via the refresh-token grant and persists the new token.
        const fresh = await getValidAccessToken(opts.organizationId, resolvedUserId);
        return fresh.accessToken;
      });
      modules.push(r);
      totalFetched += r.fetched;
      totalImported += r.imported;
      totalUpdated += r.updated;
      totalFailed += r.failed;
      if (r.status === 'error') hadError = true;

      // Update running stats on the sync log
      await db.zohoSyncLog.update({
        where: { id: syncLog.id },
        data: {
          stats: JSON.stringify({
            modules: modules.map((m) => ({ [m.module]: { fetched: m.fetched, imported: m.imported, updated: m.updated, failed: m.failed, status: m.status } })),
            runningTotal: { fetched: totalFetched, imported: totalImported, updated: totalUpdated, failed: totalFailed },
          }),
        },
      });
    }

    // 5. Determine final status
    const status: SyncStatus = hadError ? (totalImported + totalUpdated > 0 ? 'partial' : 'failed') : 'completed';
    const completedAt = new Date();
    const durationMs = Date.now() - startTime;

    console.log(`[zoho-sync] ═══ SYNC ${status.toUpperCase()} ═══ fetched=${totalFetched} imported=${totalImported} updated=${totalUpdated} failed=${totalFailed} duration=${durationMs}ms`);

    await db.zohoSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status,
        currentEntity: 'completed',
        completedAt,
        stats: JSON.stringify({
          modules: modules.map((m) => ({ [m.module]: { fetched: m.fetched, imported: m.imported, updated: m.updated, failed: m.failed, status: m.status, error: m.error } })),
          totals: { fetched: totalFetched, imported: totalImported, updated: totalUpdated, failed: totalFailed },
        }),
      },
    });

    // Invalidate the business snapshot cache so the dashboard shows fresh data
    const { getBusinessSnapshot } = await import('@/lib/business/snapshot');
    await getBusinessSnapshot(opts.organizationId, { forceRefresh: true });

    return {
      ok: status !== 'failed',
      status,
      mode: opts.mode,
      syncLogId: syncLog.id,
      zohoOrgId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      totalFetched,
      totalImported,
      totalUpdated,
      totalFailed,
      modules,
      error: hadError ? `${modules.filter((m) => m.status === 'error').length} module(s) had errors` : null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unexpected sync error';
    await db.zohoSyncLog.update({
      where: { id: syncLog.id },
      data: { status: 'failed', currentEntity: 'failed', error: errMsg, completedAt: new Date() },
    }).catch(() => {});
    return {
      ok: false,
      status: 'failed',
      mode: opts.mode,
      syncLogId: syncLog.id,
      zohoOrgId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalFetched, totalImported, totalUpdated, totalFailed,
      modules,
      error: errMsg,
    };
  }
}

// ─── Get sync status (for UI polling) ────────────────────────────────────────

export async function getSyncStatus(organizationId: string): Promise<{
  status: SyncStatus | 'idle';
  currentEntity: string | null;
  mode: SyncMode | null;
  startedAt: string | null;
  completedAt: string | null;
  stats: Record<string, unknown>;
  lastSync: {
    status: SyncStatus;
    startedAt: string;
    completedAt: string | null;
    durationMs: number;
    totals: { fetched: number; imported: number; updated: number; failed: number };
  } | null;
}> {
  const current = await db.zohoSyncLog.findFirst({
    where: { organizationId },
    orderBy: { startedAt: 'desc' },
  });

  if (!current) {
    return {
      status: 'idle',
      currentEntity: null,
      mode: null,
      startedAt: null,
      completedAt: null,
      stats: {},
      lastSync: null,
    };
  }

  let stats: Record<string, unknown> = {};
  try { stats = JSON.parse(current.stats || '{}'); } catch { stats = {}; }

  const isRunning = current.status === 'running';
  const lastSync = !isRunning ? {
    status: current.status as SyncStatus,
    startedAt: current.startedAt.toISOString(),
    completedAt: current.completedAt?.toISOString() ?? null,
    durationMs: current.completedAt
      ? current.completedAt.getTime() - current.startedAt.getTime()
      : 0,
    totals: (stats.totals as { fetched: number; imported: number; updated: number; failed: number }) ?? { fetched: 0, imported: 0, updated: 0, failed: 0 },
  } : null;

  return {
    status: current.status as SyncStatus | 'idle',
    currentEntity: current.currentEntity,
    mode: current.mode as SyncMode | null,
    startedAt: current.startedAt.toISOString(),
    completedAt: current.completedAt?.toISOString() ?? null,
    stats,
    lastSync,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED STATUS — bridges the Phase 5 sync engine to the SyncStatusResponse
// shape the frontend (useZohoBooks hook) expects.
//
// The Phase 5 engine (runZohoFullSync) writes ZohoSyncLog.stats as:
//   { modules: [{ <moduleKey>: {fetched,imported,updated,failed,status,error} }, ...],
//     totals: {fetched,imported,updated,failed} }
//
// The frontend expects stats as Partial<Record<ZohoSyncEntity, EntitySyncStats>>
// with keys: customer|vendor|tax|bank_account|invoice|bill|expense|
// bank_transaction|journal|payment|item|creditnote and per-entity shape
// {imported,updated,failed,skipped,pages,lastError}.
//
// This function translates between the two and counts REAL records directly
// from the Zoho* Prisma tables (not ZohoEntityMap, which Phase 5 doesn't
// populate) so "Records Imported" reflects actual synced data.
// ═══════════════════════════════════════════════════════════════════════════════

// Maps Phase 5 module keys → frontend ZohoSyncEntity keys.
const MODULE_KEY_TO_ENTITY: Record<string, string> = {
  customers: 'customer',
  vendors: 'vendor',
  items: 'item',
  invoices: 'invoice',
  bills: 'bill',
  payments_received: 'payment',
  payments_made: 'payment',
  creditnotes: 'creditnote',
  expenses: 'expense',
  taxes: 'tax',
  journals: 'journal',
  bankaccounts: 'bank_account',
  banktransactions: 'bank_transaction',
};

interface UnifiedEntityStats {
  imported: number;
  updated: number;
  failed: number;
  skipped: number;
  pages: number;
  lastError: string | null;
}

interface UnifiedLastSync {
  id: string;
  status: SyncStatus;
  mode: SyncMode;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  stats: Partial<Record<string, UnifiedEntityStats>>;
  currentEntity: string | null;
}

export interface UnifiedSyncStatus {
  connected: boolean;
  organizationName: string | null;
  zohoOrgId: string | null;
  lastSync: UnifiedLastSync | null;
  recordsImported: Partial<Record<string, number>>;
  totalRecords: number;
  isRunning: boolean;
}

/**
 * Read the current sync status in the frontend's expected shape.
 *
 * @param organizationId — VEYRO org id
 * @param zohoOrgId — Zoho Books numeric org id (required to scope the log query)
 */
export async function getSyncStatusUnified(
  organizationId: string,
  zohoOrgId: string | null,
): Promise<UnifiedSyncStatus> {
  // Count real records from the Zoho* tables (org-scoped).
  const where = zohoOrgId
    ? { organizationId, zohoOrgId }
    : { organizationId };
  const [
    customers, vendors, items, invoices, bills,
    paymentsReceived, paymentsMade, creditNotes, expenses,
    taxes, journals, bankAccounts, bankTransactions,
  ] = await Promise.all([
    db.zohoCustomer.count({ where }),
    db.zohoVendor.count({ where }),
    db.zohoItem.count({ where }),
    db.zohoInvoice.count({ where }),
    db.zohoBill.count({ where }),
    db.zohoPaymentReceived.count({ where }),
    db.zohoPaymentMade.count({ where }),
    db.zohoCreditNote.count({ where }),
    db.zohoExpense.count({ where }),
    db.zohoTax.count({ where }),
    db.zohoJournalEntry.count({ where }),
    db.zohoBankAccount.count({ where }),
    db.zohoBankTransaction.count({ where }),
  ]);

  const recordsImported: Record<string, number> = {
    customer: customers,
    vendor: vendors,
    tax: taxes,
    bank_account: bankAccounts,
    invoice: invoices,
    bill: bills,
    expense: expenses,
    bank_transaction: bankTransactions,
    journal: journals,
    payment: paymentsReceived + paymentsMade,
    item: items,
    creditnote: creditNotes,
  };
  const totalRecords = Object.values(recordsImported).reduce((s, n) => s + n, 0);

  // Read the most-recent sync log (scoped to zohoOrgId when available).
  const logWhere = zohoOrgId
    ? { organizationId, zohoOrgId }
    : { organizationId };
  const current = await db.zohoSyncLog.findFirst({
    where: logWhere,
    orderBy: { startedAt: 'desc' },
  });

  if (!current) {
    return {
      connected: true,
      organizationName: null,
      zohoOrgId,
      lastSync: null,
      recordsImported,
      totalRecords,
      isRunning: false,
    };
  }

  // Parse the Phase 5 stats JSON.
  let rawStats: { modules?: Array<Record<string, {
    fetched?: number; imported?: number; updated?: number; failed?: number;
    status?: string; error?: string;
  }>>; totals?: { fetched?: number; imported?: number; updated?: number; failed?: number } } = {};
  try {
    rawStats = JSON.parse(current.stats || '{}') as typeof rawStats;
  } catch {
    rawStats = {};
  }

  // Translate the modules array → Partial<Record<entity, stats>>.
  const entityStats: Record<string, UnifiedEntityStats> = {};
  for (const entry of rawStats.modules ?? []) {
    for (const [moduleKey, s] of Object.entries(entry)) {
      const entity = MODULE_KEY_TO_ENTITY[moduleKey];
      if (!entity) continue;
      const prev = entityStats[entity] ?? {
        imported: 0, updated: 0, failed: 0, skipped: 0, pages: 0, lastError: null,
      };
      prev.imported += s.imported ?? 0;
      prev.updated += s.updated ?? 0;
      prev.failed += s.failed ?? 0;
      if (s.error && s.status === 'error') prev.lastError = s.error;
      entityStats[entity] = prev;
    }
  }

  const isRunning = current.status === 'running';
  // Always populate `lastSync` — even when running — so the UI can show live
  // progress (currentEntity, partial stats, startedAt). Previously this was
  // null during a running sync, which hid the "Fetching Customers…" indicator.
  const lastSync: UnifiedLastSync = {
    id: current.id,
    status: current.status as SyncStatus,
    mode: current.mode as SyncMode,
    startedAt: current.startedAt.toISOString(),
    completedAt: current.completedAt?.toISOString() ?? null,
    durationMs: current.completedAt
      ? current.completedAt.getTime() - current.startedAt.getTime()
      : Date.now() - current.startedAt.getTime(),
    error: current.error,
    stats: entityStats,
    currentEntity: current.currentEntity,
  };

  return {
    connected: true,
    organizationName: null, // filled in by the route from the token row
    zohoOrgId,
    lastSync,
    recordsImported,
    totalRecords,
    isRunning,
  };
}

// ─── Backfill: mirror existing Zoho* data into native tables ────────────────
//
// One-time / on-demand function that reads ALL existing ZohoInvoice,
// ZohoBankAccount, and ZohoCustomer rows for an org and mirrors them into
// the native Invoice, BankAccount, and Client tables.
//
// Use case: when the mirror functions were added AFTER a sync already ran,
// the existing Zoho data isn't mirrored yet. This function backfills the
// mirrors without requiring a full re-sync (which would need a valid token).
//
// Idempotent: safe to run multiple times (uses ZohoEntityMap for dedup).

export async function backfillMirrors(
  organizationId: string,
  zohoOrgId: string,
): Promise<{ invoices: number; bankAccounts: number; customers: number; errors: string[] }> {
  const errors: string[] = [];
  let invoiceCount = 0;
  let bankAccountCount = 0;
  let customerCount = 0;

  // 1. Mirror customers → Client (same logic as the inline mirror in runZohoFullSync)
  try {
    const customers = await db.zohoCustomer.findMany({
      where: { organizationId, zohoOrgId },
    });
    for (const zc of customers) {
      try {
        await db.firm.upsert({
          where: { id: organizationId },
          create: { id: organizationId, name: zc.companyName || zc.contactName || 'VEYRO Org', subscriptionPlan: 'enterprise', maxClients: 100000, isActive: true },
          update: { isActive: true },
        }).catch(() => {});
        const gstin = zc.gstNumber?.trim() || `ZOHO-CONTACT-${zc.zohoContactId}`;
        await db.client.upsert({
          where: { gstin },
          create: {
            gstin,
            tradeName: zc.companyName || zc.contactName,
            legalName: zc.companyName || zc.contactName,
            contactEmail: zc.email,
            contactPhone: zc.phone,
            status: zc.status || 'active',
            firmId: organizationId,
          },
          update: {
            tradeName: zc.companyName || zc.contactName,
            legalName: zc.companyName || zc.contactName,
            contactEmail: zc.email,
            contactPhone: zc.phone,
            status: zc.status || 'active',
            firmId: organizationId,
          },
        });
        customerCount++;
      } catch (e) {
        errors.push(`customer ${zc.zohoContactId}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } catch (e) {
    errors.push(`customers query: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Mirror invoices → native Invoice
  try {
    const invoices = await db.zohoInvoice.findMany({
      where: { organizationId, zohoOrgId },
    });
    for (const inv of invoices) {
      try {
        // Reconstruct the inv object from the stored ZohoInvoice row
        // (the mirror function expects the raw Zoho API shape).
        const invData = {
          invoice_id: inv.zohoInvoiceId,
          invoice_number: inv.invoiceNumber,
          customer_id: inv.customerId,
          customer_name: inv.customerName,
          status: inv.status,
          date: inv.date,
          due_date: inv.dueDate,
          sub_total: inv.subTotal,
          total: inv.total,
          balance: inv.balance,
          paid_amount: inv.paidAmount,
          cgst: inv.cgst,
          sgst: inv.sgst,
          igst: inv.igst,
          cess: inv.cess,
          tax_total: inv.totalTax,
          currency_code: inv.currencyCode,
          line_items: inv.lineItems ? JSON.parse(inv.lineItems) : [],
          last_modified_time: inv.zohoUpdatedAt?.toISOString(),
        };
        await mirrorInvoiceToNativeInvoice(organizationId, zohoOrgId, inv.zohoInvoiceId, invData);
        invoiceCount++;
      } catch (e) {
        errors.push(`invoice ${inv.zohoInvoiceId}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } catch (e) {
    errors.push(`invoices query: ${e instanceof Error ? e.message : e}`);
  }

  // 3. Mirror bank accounts → native BankAccount
  try {
    const accounts = await db.zohoBankAccount.findMany({
      where: { organizationId, zohoOrgId },
    });
    for (const ba of accounts) {
      try {
        const baData = {
          account_id: ba.zohoAccountId,
          account_name: ba.accountName,
          account_number: ba.accountNumber,
          ifsc_code: ba.ifscCode,
          bank_name: ba.bankName,
          account_type: ba.accountType,
          currency_code: ba.currencyCode,
          balance: ba.balance,
          available_balance: ba.availableBalance,
          status: ba.status,
          last_modified_time: ba.zohoUpdatedAt?.toISOString(),
        };
        await mirrorBankAccountToNativeBankAccount(organizationId, zohoOrgId, ba.zohoAccountId, baData);
        bankAccountCount++;
      } catch (e) {
        errors.push(`bank_account ${ba.zohoAccountId}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } catch (e) {
    errors.push(`bank_accounts query: ${e instanceof Error ? e.message : e}`);
  }

  console.log(`[zoho-backfill] org=${organizationId} zohoOrgId=${zohoOrgId} · customers=${customerCount} invoices=${invoiceCount} bankAccounts=${bankAccountCount} errors=${errors.length}`);
  return { invoices: invoiceCount, bankAccounts: bankAccountCount, customers: customerCount, errors };
}
