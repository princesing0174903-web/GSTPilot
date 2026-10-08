// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — Provider Interface
//
// IBankProvider is the SINGLE contract every banking backend must implement.
// Today we ship two live implementations:
//   • MockBankProvider — deterministic simulated responses (default)
//   • Future*Provider  — five placeholders that throw NotImplementedError
//
// All existing pages communicate ONLY through this interface (via the service
// layer). Switching to a production provider later means changing exactly ONE
// env var in registry.ts — no UI or service code changes.
//
// IMPORTANT: This interface is PURE (no Firebase, no Node `crypto` imports) so
// it is safe to import from both client and server code. The implementations
// live in `server/` and are only ever imported by API routes.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BankAccountSnapshot,
  BankProviderName,
  BankTransaction,
  ConnectBankResult,
  CompleteConnectionResult,
  FetchAccountsResult,
  FetchTransactionsResult,
  RefreshConnectionResult,
} from './types';

/**
 * The decrypted connection object passed between the provider and the service
 * layer. The service encrypts this with AES-256-GCM before persisting to
 * Firestore. This type is intentionally NOT exported to client code — only the
 * server sees decrypted connections.
 */
export interface BankSession {
  /** The auth / access token returned by the provider after consent. */
  accessToken: string;
  /** Optional refresh token for consent renewal. */
  refreshToken?: string;
  /** The provider this session belongs to. */
  provider: BankProviderName;
  /** The masked account number this session can access. */
  accountNumberMasked: string;
  /** The IFSC of the account. */
  ifsc: string;
  /** ISO timestamp when the consent / token expires. */
  expiresAt: string;
  /** Provider-specific metadata (FIU id, consent handle, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * The contract every banking backend implements.
 *
 * Every method (except connect / healthCheck) receives a `BankSession` and
 * returns plain data — never Firestore documents. The SERVICE layer is
 * responsible for persisting results to Firestore and encrypting sessions.
 *
 * Implementations MUST throw the typed errors from `./errors.ts` so callers can
 * branch on `instanceof` for proper UX.
 */
export interface IBankProvider {
  /** Human-readable provider name (e.g. 'Mock Banking', 'Account Aggregator'). */
  readonly name: string;
  /** The provider identifier. */
  readonly provider: BankProviderName;
  /** Whether this provider makes real network calls to a bank / AA. */
  readonly isLive: boolean;

  /**
   * Initiate a bank connection. For AA providers this kicks off the consent
   * flow; for direct-bank providers (RazorpayX) this validates credentials.
   * Does NOT require a session.
   * Throws: ValidationError, RateLimitError, BankUnavailableError, TimeoutError.
   */
  connect(input: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountType: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
    consentHandle?: string;
  }): Promise<ConnectBankResult>;

  /**
   * Complete the connection after consent is granted (AA flow) or after
   * credential validation (direct flow). Returns the session + initial snapshot.
   * Does NOT require a session.
   * Throws: ConsentRejectedError, AuthenticationError.
   */
  completeConnection(connectionRef: string): Promise<{
    session: BankSession;
    snapshot: BankAccountSnapshot;
  }>;

  /**
   * Refresh an existing connection using a refresh token.
   * Throws: ConnectionExpiredError (if refresh token also expired), AuthenticationError.
   */
  refreshConnection(session: BankSession): Promise<{ session: BankSession }>;

  /**
   * Disconnect — invalidate the consent / token server-side.
   * Idempotent: should not throw if the session is already invalid.
   */
  disconnect(session: BankSession): Promise<void>;

  /**
   * Fetch the current account balances (available + current).
   * Throws: ConnectionExpiredError, BankUnavailableError.
   */
  fetchAccounts(session: BankSession): Promise<FetchAccountsResult>;

  /**
   * Sync bank transactions for a date range.
   * If `from` is omitted, syncs the last 30 days (incremental sync uses
   * `from` = lastSync).
   * Throws: ConnectionExpiredError, BankUnavailableError, TimeoutError.
   */
  fetchTransactions(
    session: BankSession,
    options?: { from?: string; to?: string },
  ): Promise<FetchTransactionsResult>;

  /**
   * Health check — used by the scheduler to verify the provider is reachable.
   * Returns true if the provider is operational.
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Re-export the result types so consumers can import everything from the
 * provider module without reaching into `./types`.
 */
export type {
  BankAccountSnapshot,
  BankProviderName,
  BankTransaction,
  ConnectBankResult,
  CompleteConnectionResult,
  FetchAccountsResult,
  FetchTransactionsResult,
  RefreshConnectionResult,
} from './types';
