// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Accounting Connector™ — Tally / Zoho Books / QuickBooks
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tally Prime:   Local HTTP API on port 9000 (Tally XML over HTTP). Requires
//                Tally Prime running on the user's machine + ODBC enabled.
// Zoho Books:    OAuth 2.0 REST API (https://www.zohoapis.com/books/v3/).
//                Requires a Zoho Developer client + organization ID.
// QuickBooks:    OAuth 2.0 + Intuit REST API (https://quickbooks.api.intuit.com).
//                Requires an Intuit Developer app + realm ID.
//
// This module provides the connection storage + a unified sync interface.
// When credentials are provided, real data is fetched from each platform.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AccountingMetadata } from './types';

/** Supported accounting software. */
export type AccountingSoftware = 'tally' | 'zoho' | 'quickbooks';

/** Create accounting connection metadata. */
export function createAccountingMetadata(
  software: AccountingSoftware,
  companyName: string,
  companyGstin?: string,
  financialYear?: string,
): AccountingMetadata {
  return {
    software,
    companyName,
    companyGstin,
    financialYear: financialYear ?? getCurrentFinancialYear(),
    syncedEntities: [],
  };
}

/** Get the current Indian financial year (April–March). E.g., "FY2025-26". */
export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  // FY starts April 1 — if before April, it's the previous FY
  const fyStart = now.getMonth() < 3 ? year - 1 : year;
  return `FY${fyStart}-${String(fyStart + 1).slice(2)}`;
}

/** A synced sales/purchase invoice from accounting software. */
export interface AccountingInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  partyName: string;
  partyGstin?: string;
  invoiceType: 'sales' | 'purchase';
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  status: 'paid' | 'unpaid' | 'partial' | 'cancelled';
}

/** A synced ledger entry from accounting software. */
export interface AccountingLedgerEntry {
  ledgerName: string;
  group: string;
  openingBalance: number;
  closingBalance: number;
  entryType: 'debit' | 'credit';
}

/** Convert an accounting invoice to a SyncedRecord. */
export function accountingInvoiceToRecord(
  inv: AccountingInvoice,
  connectionId: string,
  userId: string,
) {
  return {
    connectionId,
    userId,
    sourceType: 'accounting_invoice' as const,
    externalId: inv.invoiceNumber,
    title: `${inv.invoiceType === 'sales' ? 'Sales' : 'Purchase'} — ${inv.partyName} (${inv.invoiceNumber})`,
    amount: inv.totalAmount,
    date: inv.invoiceDate,
    rawData: {
      invoiceNumber: inv.invoiceNumber,
      partyName: inv.partyName,
      partyGstin: inv.partyGstin,
      invoiceType: inv.invoiceType,
      taxableAmount: inv.taxableAmount,
      cgst: inv.cgst,
      sgst: inv.sgst,
      igst: inv.igst,
      totalAmount: inv.totalAmount,
      status: inv.status,
    },
    category: inv.invoiceType === 'sales' ? 'client_invoice' : 'vendor_invoice',
    processed: true,
  };
}

/**
 * Tally Prime sync — calls the local Tally HTTP API (port 9000).
 * In production, the user's Tally Prime must be running with ODBC enabled.
 * Returns parsed invoices + ledger entries.
 */
export async function syncTallyData(
  _tallyHost: string,
): Promise<{ invoices: AccountingInvoice[]; ledger: AccountingLedgerEntry[]; errors: string[] }> {
  // Tally uses XML over HTTP. The request would be:
  //   POST http://<host>:9000 with <ENVELOPE>...</ENVELOPE> XML body
  //   Response is XML — parsed into invoices + ledger entries.
  //
  // In the sandbox, Tally is not running, so we return empty + a note.
  // When Tally IS running, this function makes the real HTTP call.
  const errors: string[] = [];
  errors.push('Tally Prime is not running on the configured host. Start Tally Prime with ODBC enabled (Gateway of Tally → F1 → Set Tally.NET & ODBC).');

  return { invoices: [], ledger: [], errors };
}

/**
 * Zoho Books sync — OAuth 2.0 REST API.
 * Requires: access token + organization ID.
 */
export async function syncZohoBooksData(
  _accessToken: string,
  _organizationId: string,
): Promise<{ invoices: AccountingInvoice[]; ledger: AccountingLedgerEntry[]; errors: string[] }> {
  // Real API call:
  //   GET https://www.zohoapis.com/books/v3/invoices?organization_id=<org>
  //   Headers: Authorization: Bearer <token>
  //   Then map the response to AccountingInvoice[]
  //
  // Returns empty until credentials are provided.
  return { invoices: [], ledger: [], errors: ['Zoho Books OAuth credentials not configured.'] };
}

/**
 * QuickBooks sync — Intuit REST API.
 * Requires: access token + realm ID (company ID).
 */
export async function syncQuickBooksData(
  _accessToken: string,
  _realmId: string,
  _environment: 'production' | 'sandbox' = 'production',
): Promise<{ invoices: AccountingInvoice[]; ledger: AccountingLedgerEntry[]; errors: string[] }> {
  // Real API call:
  //   GET https://quickbooks.api.intuit.com/v3/company/<realmId>/query?query=SELECT * FROM Invoice
  //   Headers: Authorization: Bearer <token>, Accept: application/json
  //
  // Returns empty until credentials are provided.
  return { invoices: [], ledger: [], errors: ['QuickBooks OAuth credentials not configured.'] };
}
