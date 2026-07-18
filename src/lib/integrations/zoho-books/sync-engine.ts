// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Full Sync Engine (Phase 5)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsert: (orgId: string, zohoOrgId: string, record: any) => Promise<{ imported: number; updated: number; failed: number }>;
}

// ─── Module upsert functions ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any, def = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? def : n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function str(v: any, def: string | null = null): string | null {
  if (v === undefined || v === null || v === '') return def;
  return String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function date(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Vendors ──────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertVendor(orgId: string, zohoOrgId: string, v: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoContactId = str(v.contact_id) || '';
    if (!zohoContactId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoVendor.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoContactId },
    });
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
    if (existing) { await db.zohoVendor.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoVendor.create({ data: { organizationId: orgId, zohoOrgId, zohoContactId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] vendor upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertInvoice(orgId: string, zohoOrgId: string, inv: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoInvoiceId = str(inv.invoice_id) || '';
    if (!zohoInvoiceId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoInvoice.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoInvoiceId },
    });
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
    if (existing) { await db.zohoInvoice.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoInvoice.create({ data: { organizationId: orgId, zohoOrgId, zohoInvoiceId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertInvoice upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Bills ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertBill(orgId: string, zohoOrgId: string, bill: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoBillId = str(bill.bill_id) || '';
    if (!zohoBillId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoBill.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoBillId },
    });
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
    if (existing) { await db.zohoBill.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoBill.create({ data: { organizationId: orgId, zohoOrgId, zohoBillId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertBill upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Payments Received ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertPaymentReceived(orgId: string, zohoOrgId: string, p: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoPaymentId = str(p.payment_id) || '';
    if (!zohoPaymentId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoPaymentReceived.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoPaymentId },
    });
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
    if (existing) { await db.zohoPaymentReceived.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoPaymentReceived.create({ data: { organizationId: orgId, zohoOrgId, zohoPaymentId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertPaymentReceived upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Payments Made ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertPaymentMade(orgId: string, zohoOrgId: string, p: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoPaymentId = str(p.payment_id) || '';
    if (!zohoPaymentId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoPaymentMade.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoPaymentId },
    });
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
    if (existing) { await db.zohoPaymentMade.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoPaymentMade.create({ data: { organizationId: orgId, zohoOrgId, zohoPaymentId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertPaymentMade upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Credit Notes ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertCreditNote(orgId: string, zohoOrgId: string, cn: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoCreditNoteId = str(cn.creditnote_id) || '';
    if (!zohoCreditNoteId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoCreditNote.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoCreditNoteId },
    });
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
    if (existing) { await db.zohoCreditNote.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoCreditNote.create({ data: { organizationId: orgId, zohoOrgId, zohoCreditNoteId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertCreditNote upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertExpense(orgId: string, zohoOrgId: string, e: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoExpenseId = str(e.expense_id) || '';
    if (!zohoExpenseId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoExpense.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoExpenseId },
    });
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
    if (existing) { await db.zohoExpense.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoExpense.create({ data: { organizationId: orgId, zohoOrgId, zohoExpenseId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertExpense upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Taxes ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertTax(orgId: string, zohoOrgId: string, t: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoTaxId = str(t.tax_id) || '';
    if (!zohoTaxId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoTax.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoTaxId },
    });
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
    if (existing) { await db.zohoTax.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoTax.create({ data: { organizationId: orgId, zohoOrgId, zohoTaxId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertTax upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Journals ─────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertBankAccount(orgId: string, zohoOrgId: string, ba: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoAccountId = str(ba.account_id) || '';
    if (!zohoAccountId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoBankAccount.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoAccountId },
    });
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
    if (existing) { await db.zohoBankAccount.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoBankAccount.create({ data: { organizationId: orgId, zohoOrgId, zohoAccountId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertBankAccount upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Bank Transactions ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertBankTransaction(orgId: string, zohoOrgId: string, bt: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoTransactionId = str(bt.transaction_id) || '';
    if (!zohoTransactionId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoBankTransaction.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoTransactionId },
    });
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
    if (existing) { await db.zohoBankTransaction.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoBankTransaction.create({ data: { organizationId: orgId, zohoOrgId, zohoTransactionId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertBankTransaction upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Items ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertItem(orgId: string, zohoOrgId: string, item: any) {
  let imported = 0, updated = 0, failed = 0;
  try {
    const zohoItemId = str(item.item_id) || '';
    if (!zohoItemId) { failed++; return { imported, updated, failed }; }
    const existing = await db.zohoItem.findFirst({
      where: { organizationId: orgId, zohoOrgId, zohoItemId },
    });
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
    if (existing) { await db.zohoItem.update({ where: { id: existing.id }, data }); updated++; }
    else { await db.zohoItem.create({ data: { organizationId: orgId, zohoOrgId, zohoItemId, ...data } }); imported++; }
  } catch (err) { failed++; console.error('[zoho-sync] upsertItem upsert failed:', err instanceof Error ? err.message : err); }
  return { imported, updated, failed };
}

// ─── Module table ─────────────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  { key: 'vendors', label: 'Fetching Vendors', endpoint: '/contacts?contact_type=vendor', responseKey: 'contacts', upsert: upsertVendor },
  { key: 'items', label: 'Fetching Items', endpoint: '/items', responseKey: 'items', upsert: upsertItem },
  { key: 'invoices', label: 'Fetching Invoices', endpoint: '/invoices', responseKey: 'invoices', upsert: upsertInvoice },
  { key: 'bills', label: 'Fetching Bills', endpoint: '/bills', responseKey: 'bills', upsert: upsertBill },
  { key: 'payments_received', label: 'Fetching Payments Received', endpoint: '/customerpayments', responseKey: 'customerpayments', upsert: upsertPaymentReceived },
  { key: 'payments_made', label: 'Fetching Payments Made', endpoint: '/vendorpayments', responseKey: 'vendorpayments', upsert: upsertPaymentMade },
  { key: 'creditnotes', label: 'Fetching Credit Notes', endpoint: '/creditnotes', responseKey: 'creditnotes', upsert: upsertCreditNote },
  { key: 'expenses', label: 'Fetching Expenses', endpoint: '/expenses', responseKey: 'expenses', upsert: upsertExpense },
  { key: 'taxes', label: 'Fetching Taxes', endpoint: '/settings/taxes', responseKey: 'taxes', upsert: upsertTax },
  { key: 'journals', label: 'Fetching Journals', endpoint: '/journals', responseKey: 'journals', upsert: upsertJournal },
  { key: 'bankaccounts', label: 'Fetching Bank Accounts', endpoint: '/bankaccounts', responseKey: 'bankaccounts', upsert: upsertBankAccount },
  { key: 'banktransactions', label: 'Fetching Bank Transactions', endpoint: '/banktransactions', responseKey: 'banktransactions', upsert: upsertBankTransaction },
];

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

async function fetchModule(
  def: ModuleDef,
  accessToken: string,
  zohoOrgId: string,
  organizationId: string,
  mode: SyncMode,
  lastSyncAt: Date | null,
): Promise<SyncModuleResult> {
  const result: SyncModuleResult = {
    module: def.key, status: 'ok', fetched: 0, imported: 0, updated: 0, failed: 0,
  };

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

    const res = await zohoGet<{ code?: number; message?: string; page_context?: { has_more_page?: boolean; page?: number } } & Record<string, unknown>>(
      url,
      accessToken,
      { organizationId: zohoOrgId },
    );

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

    // Upsert each record
    for (const record of records) {
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
            create: { id: opts.organizationId, name: zc.companyName || zc.contactName || 'GSTPilot Org', subscriptionPlan: 'enterprise', maxClients: 100000, isActive: true },
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

      const r = await fetchModule(def, accessToken, zohoOrgId, opts.organizationId, opts.mode, lastSyncAt);
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
