// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — GSP (GST Suvidha Provider) Interface for GSTR-2B
// ═══════════════════════════════════════════════════════════════════════════════
//
// IGSPProvider is the SINGLE contract every GSP backend must implement.
// We ship a MockGSPProvider (deterministic simulated GSTR-2B data) by default.
// Production providers (MastersIndia, Clarity, ClearTax, GST Suvidha) plug in
// by implementing this interface and registering in the registry.
//
// The interface is PURE (no Firebase, no Node `crypto`) — safe to import from
// both client and server. Implementations live in `server/` and are only ever
// imported by API routes.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single GSTR-2B invoice record as returned by the GSP.
 * This is the canonical shape we compare purchase invoices against.
 */
export interface GSTR2BRecord {
  /** Supplier GSTIN (the vendor you purchased from). */
  supplierGSTIN: string;
  /** Supplier legal name (optional, for display). */
  supplierName?: string;
  /** Invoice number as filed by the supplier in GSTR-1. */
  invoiceNo: string;
  /** Invoice date — ISO string YYYY-MM-DD. */
  invoiceDate?: string;
  /** Taxable value (before tax). */
  taxableValue: number;
  /** Integrated GST (inter-state). */
  igst: number;
  /** Central GST (intra-state). */
  cgst: number;
  /** State GST (intra-state). */
  sgst: number;
  /** Cess. */
  cess: number;
  /** Total ITC available for this invoice. */
  itcAvailable: number;
  /** Whether ITC is eligible (some invoices are blocked). */
  itcEligible: boolean;
  /** Document type (invoice / debit note / credit note). */
  docType?: string;
  /** Upload status from GSTN. */
  uploadStatus?: string;
}

/**
 * The result of fetching GSTR-2B for a GSTIN + period.
 */
export interface GSTR2BFetchResult {
  gstin: string;
  period: string; // YYYY-MM
  records: GSTR2BRecord[];
  /** Total count returned by the GSP. */
  totalRecords: number;
  /** When the GSTR-2B was last updated on GSTN (if known). */
  generatedAt?: string;
  /** Whether this is live data or mock/simulated. */
  isLive: boolean;
  /** Optional provider-specific metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * The decrypted GSP session (auth credentials).
 * The service layer encrypts this with AES-256-GCM before persisting.
 */
export interface GSPSession {
  /** OAuth access token or API key. */
  accessToken: string;
  /** Optional refresh token. */
  refreshToken?: string;
  /** The GSP client identifier. */
  clientId: string;
  /** ISO timestamp when the token expires. */
  expiresAt: string;
  /** Provider-specific metadata (scope, user id, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Connection test result.
 */
export interface GSPConnectionTest {
  ok: boolean;
  provider: string;
  message: string;
  latencyMs?: number;
}

/**
 * The contract every GSP backend implements.
 *
 * Every method receives a `GSPSession` (except testConnection) and returns
 * plain data. Implementations MUST throw typed errors (see errors.ts) so
 * callers can distinguish auth failures, rate limits, and GSTN outages.
 */
export interface IGSPProvider {
  /** Unique provider key (e.g. "mastersindia", "mock"). */
  readonly key: string;
  /** Human-readable name. */
  readonly displayName: string;

  /**
   * Test whether the configured credentials are valid.
   * Called from the Settings page "Test Connection" button.
   */
  testConnection(config: {
    clientId?: string;
    clientSecret?: string;
    apikey?: string;
    apiEndpoint?: string;
  }): Promise<GSPConnectionTest>;

  /**
   * Authenticate with the GSP and return a session.
   * For OAuth providers this exchanges the auth code for tokens.
   * For API-key providers this simply validates the key.
   */
  authenticate(config: {
    clientId?: string;
    clientSecret?: string;
    apikey?: string;
    authEndpoint?: string;
  }): Promise<GSPSession>;

  /**
   * Download GSTR-2B for a given GSTIN + period.
   * The period is YYYY-MM (e.g. "2026-03" for March 2026).
   * Returns the full list of supplier invoices visible in GSTR-2B.
   */
  fetchGSTR2B(session: GSPSession, gstin: string, period: string): Promise<GSTR2BFetchResult>;
}
