// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Provider Interface
//
// IERPProvider is the SINGLE contract every ERP / accounting backend implements.
// Today we ship five implementations per ERP:
//   • Mock<ERP>Provider     — deterministic simulated responses (default)
//   • Future<ERP>Provider   — throws NotImplementedError (placeholder)
//
// All existing pages communicate ONLY through this interface (via the service
// layer). Switching to a production ERP later means changing exactly ONE env
// var in registry.ts — no UI or service code changes.
//
// IMPORTANT: This interface is PURE (no Firebase, no Node `crypto` imports) so
// it is safe to import from both client and server code. The implementations
// live in `server/` and are only ever imported by API routes.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CompleteERPConnectionResult,
  ConnectERPInput,
  ConnectERPResult,
  ERPCustomer,
  ERPInventoryItem,
  ERPInvoice,
  ERPLedger,
  ERPPayment,
  ERPProviderName,
  ERPBankTransaction,
  ERPSyncJobType,
  ERPSyncResult,
  ERPTax,
  ERPVendor,
  RefreshERPConnectionResult,
} from './types';

/**
 * The decrypted session object passed between the provider and the service
 * layer. The service encrypts this with AES-256-GCM before persisting to
 * Firestore. This type is intentionally NOT exported to client code — only the
 * server sees decrypted sessions.
 */
export interface ERPSession {
  /** The auth / access token (OAuth) or session token (Tally). */
  accessToken: string;
  /** Optional refresh token for token renewal. */
  refreshToken?: string;
  /** The provider this session belongs to. */
  provider: ERPProviderName;
  /** The company id this session can access. */
  companyId: string;
  /** The company name (denormalized for display). */
  companyName: string;
  /** ISO timestamp when the token/session expires. */
  expiresAt: string;
  /** Provider-specific metadata (host/port for Tally, realm id for QBO, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Options for sync operations. `from` enables incremental sync — providers
 * should only return records modified on/after this date.
 */
export interface ERPSyncOptions {
  /** ISO date — incremental sync cursor (only records modified on/after). */
  from?: string;
  /** ISO date — sync up to this date (default: now). */
  to?: string;
  /** Max records to fetch (provider-specific default). */
  limit?: number;
}

/**
 * The contract every ERP / accounting backend implements.
 *
 * Every method (except connect / completeConnection / healthCheck) receives an
 * `ERPSession` and returns plain data — never Firestore documents. The SERVICE
 * layer is responsible for persisting results to Firestore and encrypting
 * sessions.
 *
 * Implementations MUST throw the typed errors from `./errors.ts` so callers can
 * branch on `instanceof` for proper UX.
 */
export interface IERPProvider {
  /** Human-readable provider name (e.g. 'Mock Tally Prime'). */
  readonly name: string;
  /** The provider identifier. */
  readonly provider: ERPProviderName;
  /** Whether this provider makes real network calls to the ERP. */
  readonly isLive: boolean;

  // ─── Connection lifecycle ──────────────────────────────────────────────────

  /**
   * Initiate an ERP connection. For Tally this validates the local HTTP
   * endpoint; for Zoho/QuickBooks this kicks off OAuth; for Busy this opens the
   * local export. Does NOT require a session.
   * Throws: ValidationError, RateLimitError, ERPUnavailableError, TimeoutError.
   */
  connect(input: Omit<ConnectERPInput, 'organizationId' | 'createdBy'>): Promise<ConnectERPResult>;

  /**
   * Complete the connection (post-OAuth callback / post-validation). Returns
   * the encrypted session + company info. Does NOT require a session.
   * Throws: AuthRejectedError, TokenExpiredError.
   */
  completeConnection(connectionRef: string): Promise<{
    session: ERPSession;
    companyInfo: CompleteERPConnectionResult['companyInfo'];
  }>;

  /**
   * Refresh an existing session using a refresh token.
   * Throws: TokenExpiredError (if refresh token also expired), AuthRejectedError.
   */
  refreshSession(session: ERPSession): Promise<{ session: ERPSession }>;

  /**
   * Disconnect — invalidate the token server-side.
   * Idempotent: should not throw if the session is already invalid.
   */
  disconnect(session: ERPSession): Promise<void>;

  // ─── Sync operations (all require a session) ───────────────────────────────

  /**
   * Sync customers. Returns the list fetched (the service persists them).
   */
  syncCustomers(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPCustomer[] }>;

  /**
   * Sync vendors / suppliers.
   */
  syncVendors(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPVendor[] }>;

  /**
   * Sync invoices (sales + purchase). The service splits by invoiceType.
   */
  syncInvoices(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }>;

  /**
   * Sync sales vouchers (ERP-specific sales register).
   */
  syncSales(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }>;

  /**
   * Sync purchase vouchers (ERP-specific purchase register).
   */
  syncPurchases(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }>;

  /**
   * Sync expense entries (expense vouchers / bills).
   */
  syncExpenses(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPInvoice[] }>;

  /**
   * Sync inventory / stock items.
   */
  syncInventory(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPInventoryItem[] }>;

  /**
   * Sync the chart of accounts (ledgers).
   */
  syncLedgers(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPLedger[] }>;

  /**
   * Sync payment / receipt vouchers.
   */
  syncPayments(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPPayment[] }>;

  /**
   * Sync bank transactions (bank book entries).
   */
  syncBankTransactions(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPBankTransaction[] }>;

  /**
   * Sync tax summaries (GST output/input by rate).
   */
  syncTaxes(session: ERPSession, options?: ERPSyncOptions): Promise<{ records: ERPTax[] }>;

  // ─── Diagnostics ───────────────────────────────────────────────────────────

  /** Health check — used by the scheduler to verify the provider is reachable. */
  healthCheck(): Promise<boolean>;
}

/**
 * Re-export the result types so consumers can import everything from the
 * provider module without reaching into `./types`.
 */
export type {
  CompleteERPConnectionResult,
  ConnectERPInput,
  ConnectERPResult,
  ERPCustomer,
  ERPInventoryItem,
  ERPInvoice,
  ERPLedger,
  ERPPayment,
  ERPProviderName,
  ERPBankTransaction,
  ERPSyncJobType,
  ERPSyncResult,
  ERPTax,
  ERPVendor,
  RefreshERPConnectionResult,
} from './types';
