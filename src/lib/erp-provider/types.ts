// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Type Definitions
//
// The single source of truth for the ERP data model. Every field maps 1:1 to a
// Firestore collection. All types are PURE (no Firebase imports) so they are
// safe to import from both client and server code.
//
// Provider pattern:
//   • IERPProvider (see provider.ts) — the contract every ERP backend implements
//   • MockTallyProvider / MockZohoBooksProvider / MockBusyProvider / MockQuickBooksProvider
//     — deterministic simulated responses (default)
//   • FutureTallyProvider / FutureZohoBooksProvider / FutureBusyProvider / FutureQuickBooksProvider
//     — placeholders that throw NotImplementedError
//   • Switch to production later by changing ONE provider in registry.ts
//
// Multi-tenant: every document carries `organizationId`. Every query filters on
// it. Users can never access another organization's ERP data.
//
// Security: ERP access/refresh tokens + company credentials are encrypted with
// AES-256-GCM (server-only key) before being stored in Firestore. The client
// reads the encrypted blob and passes it back to the server during sync
// operations — the client can NEVER decrypt it.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Provider Identifiers ─────────────────────────────────────────────────────

/**
 * The set of supported ERP / accounting provider backends.
 * Today only the four 'mock' variants are live; the 'future' variants throw
 * NotImplementedError until implemented.
 */
export type ERPProviderName =
  | 'tally'           // Tally Prime (local HTTP XML API)
  | 'zoho_books'      // Zoho Books (OAuth 2.0 REST)
  | 'busy'            // Busy Accounting (local export / REST)
  | 'quickbooks';     // QuickBooks Online (OAuth 2.0 REST)

// ─── Connection Status ────────────────────────────────────────────────────────

/**
 * Lifecycle status of an ERP connection.
 * Drives what UI affordances are available (connect / sync / refresh).
 */
export type ERPConnectionStatus =
  | 'disconnected'    // no connection exists
  | 'connecting'      // connection initiated, awaiting completion
  | 'connected'       // connection active — sync enabled
  | 'expired'         // token/session expired — refresh or re-connect
  | 'error';          // last operation failed — see lastError

// ─── ERP Connection (erp_connections collection) ──────────────────────────────

/**
 * The ERP connection document — one per organization per provider+company.
 * Stored in Firestore `erp_connections/{connectionId}`.
 */
export interface ERPConnection {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  /** Which provider backend services this connection. */
  provider: ERPProviderName;
  /** Company name as registered in the ERP. */
  companyName: string;
  /** Company ID inside the ERP (Tally company id, Zoho org id, etc.). */
  companyId: string;
  /** GSTIN of the company (for cross-linking with GST data). */
  companyGstin: string | null;
  /** Current connection status — drives the connect/sync UI. */
  connectionStatus: ERPConnectionStatus;
  /** ISO timestamp of the last successful sync. */
  lastSync: string | null;
  /** Sync progress 0..100 (for in-progress syncs). */
  syncProgress: number;
  /**
   * AES-256-GCM encrypted connection blob (access/refresh tokens + credentials).
   * Stored in Firestore — org members can READ this field (rules allow it) but
   * they CANNOT decrypt it without the server-only master key.
   * The client passes this back to the server during sync operations.
   */
  encryptedConnection: string | null;
  /** ISO timestamp when the current token/session expires. */
  tokenExpiry: string | null;
  /** Human-readable last error message (NOT the raw provider error). */
  lastError: string | null;
  /** Summary of last sync result (records synced per entity). */
  lastSyncSummary: ERPSyncSummary | null;
  /** User who created the connection. */
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

/** Summary of a sync run — stored on the connection for quick display. */
export interface ERPSyncSummary {
  customers?: number;
  vendors?: number;
  invoices?: number;
  sales?: number;
  purchases?: number;
  expenses?: number;
  inventory?: number;
  ledgers?: number;
  payments?: number;
  bankTransactions?: number;
  taxes?: number;
  errors?: number;
  syncedAt: string;
}

// ─── ERP Sync Jobs (erp_sync_jobs collection) ─────────────────────────────────

export type ERPSyncJobType =
  | 'customers'
  | 'vendors'
  | 'invoices'
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'inventory'
  | 'ledgers'
  | 'payments'
  | 'bank_transactions'
  | 'taxes'
  | 'full';

export type ERPSyncTrigger = 'manual' | 'automatic' | 'background' | 'retry' | 'incremental';
export type ERPSyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'interrupted';

/**
 * A sync job record — tracks every ERP sync operation for observability + retries.
 * Stored in Firestore `erp_sync_jobs/{jobId}`.
 */
export interface ERPSyncJob {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  jobType: ERPSyncJobType;
  status: ERPSyncStatus;
  trigger: ERPSyncTrigger;
  startedAt: string | null;
  completedAt: string | null;
  recordsProcessed: number;
  errors: string[];
  retryCount: number;
  maxRetries: number;
  /** Incremental sync cursor (ISO date — next sync resumes from here). */
  syncCursor: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP Customer (erp_customers collection) ──────────────────────────────────

/**
 * A customer synced from the ERP — mapped to GSTPilot's Client entity.
 * Stored in Firestore `erp_customers/{customerId}`.
 */
export interface ERPCustomer {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  /** The ERP's internal id for this customer. */
  erpCustomerId: string;
  /** GSTPilot client id (set after data-mapper links them). */
  mappedClientId: string | null;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  /** Outstanding receivable balance from this customer (INR). */
  outstandingBalance: number;
  /** Total sales to this customer (lifetime, INR). */
  totalSales: number;
  /** ISO date of the last transaction with this customer. */
  lastTransactionDate: string | null;
  /** Whether this customer is active in the ERP. */
  active: boolean;
  /** Raw ERP payload (provider-specific). */
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP Vendor (erp_vendors collection) ──────────────────────────────────────

/**
 * A vendor / supplier synced from the ERP.
 * Stored in Firestore `erp_vendors/{vendorId}`.
 */
export interface ERPVendor {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  erpVendorId: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  /** Outstanding payable balance to this vendor (INR). */
  outstandingPayable: number;
  /** Total purchases from this vendor (lifetime, INR). */
  totalPurchases: number;
  lastTransactionDate: string | null;
  active: boolean;
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP Invoice (erp_invoices collection) ────────────────────────────────────

export type ERPInvoiceType = 'sales' | 'purchase';

/**
 * An invoice synced from the ERP — mapped to GSTPilot's Invoice entity.
 * Stored in Firestore `erp_invoices/{invoiceId}`.
 */
export interface ERPInvoice {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  /** The ERP's invoice number. */
  erpInvoiceNumber: string;
  /** GSTPilot invoice id (set after data-mapper links them). */
  mappedInvoiceId: string | null;
  invoiceType: ERPInvoiceType;
  /** Customer (sales) or vendor (purchase) name. */
  partyName: string;
  partyGstin: string | null;
  /** ISO date of the invoice. */
  invoiceDate: string;
  /** ISO due date (null if not applicable). */
  dueDate: string | null;
  subtotal: number;
  /** Total tax (IGST+CGST+SGST+CESS). */
  taxAmount: number;
  grandTotal: number;
  /** Amount still outstanding. */
  balanceDue: number;
  /** 'paid' | 'unpaid' | 'partial' | 'overdue'. */
  status: 'paid' | 'unpaid' | 'partial' | 'overdue' | 'cancelled';
  /** Line items (provider-specific shape). */
  lineItems: ERPLineItem[];
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** A single line item on an ERP invoice. */
export interface ERPLineItem {
  itemCode: string | null;
  description: string;
  hsn: string | null;
  quantity: number;
  rate: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total: number;
}

// ─── ERP Inventory (erp_inventory collection) ─────────────────────────────────

/**
 * An inventory item synced from the ERP.
 * Stored in Firestore `erp_inventory/{itemId}`.
 */
export interface ERPInventoryItem {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  erpItemId: string;
  itemCode: string;
  name: string;
  hsn: string | null;
  unit: string | null;
  /** Stock quantity (current). */
  quantity: number;
  /** Stock value at cost (INR). */
  stockValue: number;
  /** Selling price per unit (INR). */
  salePrice: number;
  /** Purchase cost per unit (INR). */
  purchasePrice: number;
  /** Reorder level (when to restock). */
  reorderLevel: number;
  /** Godown / warehouse location. */
  godown: string | null;
  /** 'in_stock' | 'low_stock' | 'out_of_stock' | 'excess'. */
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'excess';
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP Ledger (erp_ledgers collection) ──────────────────────────────────────

export type ERPLedgerType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'income'
  | 'expense'
  | 'bank'
  | 'cash'
  | 'tax'
  | 'sundry_debtor'
  | 'sundry_creditor';

/**
 * A ledger account synced from the ERP (chart of accounts).
 * Stored in Firestore `erp_ledgers/{ledgerId}`.
 */
export interface ERPLedger {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  erpLedgerId: string;
  name: string;
  ledgerType: ERPLedgerType;
  /** GSTIN if this is a party ledger. */
  gstin: string | null;
  /** Opening balance (INR, debit positive). */
  openingBalance: number;
  /** Closing balance (INR, debit positive). */
  closingBalance: number;
  /** ISO date the closing balance is as of. */
  asOfDate: string;
  /** Parent group (e.g. 'Current Assets', 'Indirect Expenses'). */
  parentGroup: string | null;
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP Payment (erp_payments collection) ────────────────────────────────────

export type ERPPaymentType = 'receipt' | 'payment' | 'contra' | 'journal';

/**
 * A payment / receipt entry synced from the ERP.
 * Stored in Firestore `erp_payments/{paymentId}`.
 */
export interface ERPPayment {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  erpVoucherNumber: string;
  paymentType: ERPPaymentType;
  /** ISO date of the payment. */
  date: string;
  /** Amount (INR). */
  amount: number;
  /** Debit ledger name. */
  debitLedger: string;
  /** Credit ledger name. */
  creditLedger: string;
  /** Mode: cash / bank / upi / cheque. */
  mode: 'cash' | 'bank' | 'upi' | 'cheque' | 'other';
  /** Reference / instrument number (cheque no, UTR, etc.). */
  referenceNumber: string | null;
  /** Narration / description. */
  narration: string | null;
  /** Linked invoice number(s) if any. */
  linkedInvoiceNumbers: string[];
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP Bank Transaction (erp_bank_transactions collection) ──────────────────

/**
 * A bank transaction entry synced from the ERP (bank book).
 * Stored in Firestore `erp_bank_transactions/{bankTxnId}`.
 */
export interface ERPBankTransaction {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  /** ISO date the transaction posted. */
  date: string;
  /** Bank ledger name (e.g. 'HDFC Bank A/c'). */
  bankLedger: string;
  description: string;
  /** Transaction amount (always positive — see `type`). */
  amount: number;
  /** Direction: credit (money in) or debit (money out). */
  type: 'credit' | 'debit';
  /** Running balance after this transaction (if known). */
  balance: number | null;
  /** Reference / instrument number. */
  referenceNumber: string | null;
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── ERP Tax (erp_taxes collection) ───────────────────────────────────────────

/**
 * A tax summary synced from the ERP (GST output/input liability by rate).
 * Stored in Firestore `erp_taxes/{taxId}`.
 */
export interface ERPTax {
  id: string;
  organizationId: string;
  connectionId: string;
  provider: ERPProviderName;
  /** Tax head: IGST / CGST / SGST / CESS. */
  taxHead: 'IGST' | 'CGST' | 'SGST' | 'CESS';
  /** Tax rate (e.g. 5, 12, 18, 28). */
  rate: number;
  /** 'output' (sales tax liability) or 'input' (ITC). */
  direction: 'output' | 'input';
  /** Total taxable value (INR). */
  taxableValue: number;
  /** Total tax amount (INR). */
  taxAmount: number;
  /** Period this summary covers (e.g. '042025'). */
  period: string;
  raw: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Service Input / Result Types ─────────────────────────────────────────────

export interface ConnectERPInput {
  organizationId: string;
  provider: ERPProviderName;
  companyName: string;
  companyId: string;
  companyGstin?: string;
  /** Provider-specific credentials (Tally host/port, OAuth tokens, etc.). */
  credentials: Record<string, string>;
  createdBy: { uid: string; name: string; email: string };
}

/** Result of initiating an ERP connection. */
export interface ConnectERPResult {
  /** Provider connection reference. */
  connectionRef: string;
  /** Masked company name (for display). */
  companyNameMasked: string;
  /** Initial company info from the ERP. */
  companyInfo: ERPCompanyInfo;
  message: string;
}

/** Company-level info fetched during connect. */
export interface ERPCompanyInfo {
  companyName: string;
  companyId: string;
  gstin: string | null;
  financialYear: string | null;
  /** ISO timestamp when the token/session expires. */
  tokenExpiry: string;
}

/** Result of completing an ERP connection (encrypted session). */
export interface CompleteERPConnectionResult {
  encryptedConnection: string;
  tokenExpiry: string;
  companyInfo: ERPCompanyInfo;
}

/** Result of a sync operation. */
export interface ERPSyncResult {
  success: boolean;
  jobType: ERPSyncJobType;
  recordsSynced: number;
  errors: string[];
}

/** Result of a token refresh. */
export interface RefreshERPConnectionResult {
  encryptedConnection: string;
  tokenExpiry: string;
}

// ─── Aggregated ERP Stats (for dashboard + Oracle) ────────────────────────────

/**
 * Aggregated ERP state — computed from real-time Firestore data.
 * This is what `useERP()` returns as `summary`.
 */
export interface ERPSummary {
  /** Number of connected ERP integrations. */
  connectedERPs: number;
  /** List of connected providers (e.g. ['tally', 'zoho_books']). */
  connectedProviders: ERPProviderName[];
  /** Total revenue (Σ of sales invoices' grandTotal). */
  totalRevenue: number;
  /** Total expenses (Σ of purchases + expense invoices). */
  totalExpenses: number;
  /** Net profit (revenue - expenses). */
  netProfit: number;
  /** Total outstanding receivables (Σ customers' outstandingBalance). */
  outstandingReceivables: number;
  /** Total outstanding payables (Σ vendors' outstandingPayable). */
  outstandingPayables: number;
  /** Total inventory stock value (INR). */
  inventoryValue: number;
  /** Cash position (Σ of bank + cash ledgers' closingBalance). */
  cashPosition: number;
  /** Count of low/out-of-stock items. */
  lowStockItems: number;
  /** Count of overdue invoices. */
  overdueInvoices: number;
  /** Tax liability (output tax - input tax) for current period. */
  netTaxLiability: number;
  /** Customer count. */
  customerCount: number;
  /** Vendor count. */
  vendorCount: number;
  /** Inventory item count. */
  inventoryItemCount: number;
  /** Whether at least one ERP is connected. */
  isConnected: boolean;
  /** Most recent 10 invoices (for the dashboard feed). */
  recentInvoices: ERPInvoice[];
  /** Top 5 customers by total sales. */
  topCustomers: Array<{ name: string; totalSales: number }>;
  /** Top 5 vendors by total purchases. */
  topVendors: Array<{ name: string; totalPurchases: number }>;
}
