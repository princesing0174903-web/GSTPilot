// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Data Sync · Type Definitions
//
// Zero `any`. Models every Zoho Books API list-response shape we sync from,
// plus the normalized GSTPilot records the mapper produces, and the sync
// orchestrator's progress / stats / resume types.
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Entity-type registry (single source of truth) ───────────────────────────
//
// Used by the orchestrator (sequential order), the resume cursor, the
// ZohoEntityMap zohoEntityType column, and the UI's per-entity stats display.

export const ZOHO_SYNC_ENTITIES = [
  'customer',
  'vendor',
  'tax',
  'bank_account',
  'invoice',
  'bill',
  'expense',
  'bank_transaction',
  'journal',
] as const;

export type ZohoSyncEntity = (typeof ZOHO_SYNC_ENTITIES)[number];

/** Human-readable plural label for each entity, surfaced in the UI. */
export const ZOHO_SYNC_ENTITY_LABELS: Record<ZohoSyncEntity, string> = {
  customer: 'Customers',
  vendor: 'Vendors',
  tax: 'Taxes',
  bank_account: 'Bank Accounts',
  invoice: 'Invoices',
  bill: 'Bills',
  expense: 'Expenses',
  bank_transaction: 'Bank Transactions',
  journal: 'Journals',
};

// ─── Generic Zoho list-response shape ────────────────────────────────────────
//
// Every Zoho Books list endpoint returns:
//   { code: 0, message: "success", <entity_plural>: [...], page_context: {...} }
//
// We model each entity's response individually (typed arrays) so the compiler
// enforces the field names used by the mapper.

export interface ZohoPageContext {
  page?: number;
  per_page?: number;
  has_more_page?: boolean;
  report?: string;
  applied_filter?: string;
  sort_column?: string;
  sort_order?: string;
  /** Cursor token Zoho accepts as `page_token` on the next request. */
  next_token?: string;
}

// ─── Customer (contact) — Zoho Books /contacts?type=customer ─────────────────
//
// Zoho's "contact" entity covers BOTH customers and vendors (distinguished by
// the `contact_type` field). We sync them separately via the `type=customer`
// and `type=vendor` query params.

export interface ZohoContactAddr {
  attention?: string;
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_type: 'customer' | 'vendor';
  status?: string;
  source?: string;
  is_taxable?: boolean;
  gst_treatment?: string;
  gstin?: string;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  currency_code?: string;
  currency_id?: string;
  outstanding_receivable_amount?: number;
  outstanding_payable_amount?: number;
  unused_credits_receivable_amount?: number;
  unused_credits_payable_amount?: number;
  first_name?: string;
  last_name?: string;
  billing_address?: ZohoContactAddr;
  shipping_address?: ZohoContactAddr;
  contact_persons?: Array<{
    contact_person_id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    is_primary_contact?: boolean;
  }>;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoContactsResponse {
  code: number;
  message: string;
  contacts: ZohoContact[];
  page_context: ZohoPageContext;
}

// ─── Vendor (contact type=vendor) — same shape as customer ───────────────────

export type ZohoVendor = ZohoContact;
export type ZohoVendorsResponse = ZohoContactsResponse;

// ─── Invoice — Zoho Books /invoices ──────────────────────────────────────────

export interface ZohoInvoiceLineItem {
  line_item_id?: string;
  item_id?: string;
  name?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  discount?: number;
  tax_id?: string;
  tax_name?: string;
  tax_type?: string;
  tax_percentage?: number;
  item_total?: number;
  hsn_or_sac?: string;
  account_id?: string;
  account_name?: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  date?: string;
  due_date?: string;
  due_by_days?: number;
  status?: string;
  payment_status?: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  currency_code?: string;
  currency_id?: string;
  total?: number;
  sub_total?: number;
  balance?: number;
  paid?: number;
  discount?: number;
  discount_total?: number;
  tax_total?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  is_inclusive_tax?: boolean;
  line_items?: ZohoInvoiceLineItem[];
  notes?: string;
  terms?: string;
  template_id?: string;
  template_name?: string;
  place_of_supply?: string;
  gst_treatment?: string;
  gstin?: string;
  created_time?: string;
  last_modified_time?: string;
  sent?: boolean;
  void?: boolean;
  write_off?: boolean;
}

export interface ZohoInvoicesResponse {
  code: number;
  message: string;
  invoices: ZohoInvoice[];
  page_context: ZohoPageContext;
}

// ─── Bill — Zoho Books /bills ────────────────────────────────────────────────

export interface ZohoBillLineItem {
  line_item_id?: string;
  item_id?: string;
  name?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  tax_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  item_total?: number;
  hsn_or_sac?: string;
  account_id?: string;
  account_name?: string;
}

export interface ZohoBill {
  bill_id: string;
  bill_number: string;
  date?: string;
  due_date?: string;
  due_by_days?: number;
  status?: string;
  payment_status?: string;
  vendor_id?: string;
  vendor_name?: string;
  currency_code?: string;
  total?: number;
  sub_total?: number;
  balance?: number;
  paid?: number;
  discount?: number;
  tax_total?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  line_items?: ZohoBillLineItem[];
  notes?: string;
  place_of_supply?: string;
  gst_treatment?: string;
  gstin?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoBillsResponse {
  code: number;
  message: string;
  bills: ZohoBill[];
  page_context: ZohoPageContext;
}

// ─── Expense — Zoho Books /expenses ──────────────────────────────────────────

export interface ZohoExpense {
  expense_id: string;
  date?: string;
  total?: number;
  sub_total?: number;
  tax_total?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  paid_through_account_id?: string;
  paid_through_account_name?: string;
  payment_mode?: string;
  reference_number?: string;
  description?: string;
  vendor_id?: string;
  vendor_name?: string;
  customer_id?: string;
  customer_name?: string;
  category_id?: string;
  category_name?: string;
  status?: string;
  is_inclusive_tax?: boolean;
  is_billable?: boolean;
  currency_code?: string;
  created_time?: string;
  last_modified_time?: string;
  line_items?: Array<{
    line_item_id?: string;
    account_id?: string;
    account_name?: string;
    description?: string;
    amount?: number;
    tax_id?: string;
    tax_name?: string;
    tax_percentage?: number;
  }>;
}

export interface ZohoExpensesResponse {
  code: number;
  message: string;
  expenses: ZohoExpense[];
  page_context: ZohoPageContext;
}

// ─── Bank Account — Zoho Books /bankaccounts ─────────────────────────────────

export interface ZohoBankAccount {
  account_id: string;
  account_name: string;
  account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  account_type?: string;
  currency_code?: string;
  currency_id?: string;
  current_balance?: number;
  available_balance?: number;
  uncleared_balance?: number;
  status?: string;
  is_default?: boolean;
  is_sub_account?: boolean;
  parent_account_id?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoBankAccountsResponse {
  code: number;
  message: string;
  bankaccounts: ZohoBankAccount[];
  page_context: ZohoPageContext;
}

// ─── Bank Transaction — Zoho Books /banktransactions ─────────────────────────

export interface ZohoBankTransaction {
  transaction_id: string;
  transaction_type?: string;
  date?: string;
  amount?: number;
  bank_account_id?: string;
  bank_account_name?: string;
  customer_id?: string;
  customer_name?: string;
  vendor_id?: string;
  vendor_name?: string;
  description?: string;
  reference_number?: string;
  debit_or_credit?: 'debit' | 'credit';
  exchange_rate?: number;
  currency_code?: string;
  status?: string;
  offset_account_name?: string;
  payee?: string;
  unused?: boolean;
  matched?: boolean;
  reconciliation_status?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoBankTransactionsResponse {
  code: number;
  message: string;
  banktransactions: ZohoBankTransaction[];
  page_context: ZohoPageContext;
}

// ─── Journal — Zoho Books /journals ──────────────────────────────────────────

export interface ZohoJournalLine {
  journal_line_id?: string;
  account_id?: string;
  account_name?: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface ZohoJournal {
  journal_id: string;
  journal_number?: string;
  reference_number?: string;
  date?: string;
  notes?: string;
  total?: number;
  status?: string;
  journal_type?: string;
  line_items?: ZohoJournalLine[];
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoJournalsResponse {
  code: number;
  message: string;
  journals: ZohoJournal[];
  page_context: ZohoPageContext;
}

// ─── Tax — Zoho Books /settings/taxes ────────────────────────────────────────

export interface ZohoTax {
  tax_id: string;
  tax_name: string;
  tax_percentage?: number;
  tax_type?: string;
  is_default?: boolean;
  is_editable?: boolean;
  tax_authority_id?: string;
  tax_authority_name?: string;
  status?: string;
  description?: string;
  created_time?: string;
  last_modified_time?: string;
}

export interface ZohoTaxesResponse {
  code: number;
  message: string;
  taxes: ZohoTax[];
  page_context: ZohoPageContext;
}

// ─── Normalized GSTPilot record payloads (mapper output) ─────────────────────
//
// The mapper produces these normalized payloads. The sync services upsert them
// into the corresponding Prisma models. NEVER raw Zoho JSON — always the
// normalized shape.

export interface NormalizedClient {
  gstin: string;
  tradeName: string;
  legalName: string | null;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  entityType: string;
  status: string;
}

export interface NormalizedVendor {
  name: string;
  gstin: string | null;
  category: string | null;
  state: string | null;
  stateCode: string | null;
  status: string;
  outstanding: number;
  totalBilled: number;
  metadata: string; // JSON — { zohoContactId, zohoOrgId, source: 'zoho', ... }
}

export interface NormalizedInvoice {
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin: string | null;
  buyerName: string | null;
  invoiceType: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  gstAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string | null;
  paymentStatus: string;
  status: string;
}

export interface NormalizedPurchaseBill {
  clientId: string | null;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentStatus: string;
  category: string | null;
}

export interface NormalizedExpense {
  clientId: string | null;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;
  paymentMode: string | null;
  status: string;
}

export interface NormalizedBankAccount {
  bankName: string;
  accountMasked: string;
  accountType: string;
  ifsc: string | null;
  balance: number;
  availableBalance: number;
  status: string;
}

export interface NormalizedBankTransaction {
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  referenceNo: string | null;
  matched: boolean;
}

export interface NormalizedJournalEntry {
  journalNumber: string | null;
  referenceNumber: string | null;
  date: string;
  totalDebit: number;
  totalCredit: number;
  notes: string | null;
  lines: string; // JSON-stringified array of { account, debit, credit, description }
  status: string;
}

// ─── Sync orchestrator types ─────────────────────────────────────────────────

export type SyncMode = 'full' | 'incremental';
export type SyncStatus = 'running' | 'completed' | 'failed' | 'partial';

export interface EntitySyncStats {
  imported: number;
  updated: number;
  failed: number;
  skipped: number;
  /** Cumulative count of pages fetched for this entity (for diagnostics). */
  pages: number;
  /** Last error message if any page failed permanently (after retries). */
  lastError: string | null;
}

export type SyncStats = Record<ZohoSyncEntity, EntitySyncStats>;

/** Resume context — read from the most-recent running ZohoSyncLog. */
export interface ResumeContext {
  syncLogId: string;
  lastEntity: ZohoSyncEntity | null;
  lastCursor: string | null;
  /** Per-entity high-water-marks (last_modified_time) — used for incremental. */
  watermarks: Partial<Record<ZohoSyncEntity, string>>;
}

/** Per-entity sync result returned by each service's sync function. */
export interface EntitySyncResult {
  entity: ZohoSyncEntity;
  stats: EntitySyncStats;
  /** Updated high-water-mark (max last_modified_time seen) — persisted for next run. */
  watermark: string | null;
  /** If the entity was interrupted mid-way, the cursor to resume from. */
  resumeCursor: string | null;
  error: string | null;
}

/** Public sync-status returned by GET /api/integrations/zoho/sync/status. */
export interface SyncStatusResponse {
  connected: boolean;
  organizationName: string | null;
  zohoOrgId: string | null;
  lastSync: {
    id: string;
    status: SyncStatus;
    mode: SyncMode;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    error: string | null;
    stats: Partial<Record<ZohoSyncEntity, EntitySyncStats>>;
  } | null;
  /** Aggregate record counts currently in the database (from ZohoEntityMap). */
  recordsImported: Partial<Record<ZohoSyncEntity, number>>;
  totalRecords: number;
  /** True if a sync is currently running (for the UI spinner). */
  isRunning: boolean;
}

/** Result of POST /api/integrations/zoho/sync. */
export interface TriggerSyncResponse {
  ok: boolean;
  syncLogId: string;
  mode: SyncMode;
  status: SyncStatus;
  startedAt: string;
  stats: Partial<Record<ZohoSyncEntity, EntitySyncStats>>;
  error: string | null;
}

// ─── Common sync options ─────────────────────────────────────────────────────

export interface SyncOptions {
  /** Organization ID (PlatformOrganization.id) — required. */
  organizationId: string;
  /** User ID — required for audit logging; null for system runs. */
  userId: string | null;
  /** User email — best-effort audit logging. */
  userEmail?: string | null;
  /** Zoho Books numeric org ID — required (multi-tenant). */
  zohoOrgId: string;
  /** Valid Zoho access token (resolved upstream via getValidAccessToken). */
  accessToken: string;
  /** Sync mode: full = ignore watermarks, incremental = use last_modified_time. */
  mode: SyncMode;
  /** If true, attempt to resume an interrupted sync (ignores `mode` if a
   * running log exists). */
  resume?: boolean;
  /** Hard cap on total entities to import per sync (safety valve). Default: 10000. */
  maxRecordsPerEntity?: number;
  /** Optional abort signal (e.g., from the route handler's request). */
  abortSignal?: AbortSignal;
}
