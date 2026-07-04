// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Type Definitions
//
// The single source of truth for the GST data model. Every field maps 1:1 to a
// Firestore collection. All types are PURE (no Firebase imports) so they are
// safe to import from both client and server code.
//
// Provider pattern:
//   • IGSTProvider (see provider.ts) — the contract every GSTN backend implements
//   • MockGSTProvider — deterministic simulated responses (default)
//   • FutureOfficialGSTProvider — placeholder that throws NotImplementedError
//   • Switch to production later by changing ONE provider in registry.ts
//
// Multi-tenant: every document carries `organizationId`. Every query filters on
// it. Users can never access another organization's GST data.
//
// Security: session tokens are encrypted with AES-256-GCM (server-only key)
// before being stored in Firestore. The client reads the encrypted blob and
// passes it back to the server during sync operations — the client can NEVER
// decrypt it.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Auth Status ──────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a GST connection.
 * Drives what UI affordances are available (connect / enter OTP / sync / refresh).
 */
export type GSTAuthStatus =
  | 'disconnected'      // no connection exists
  | 'otp_requested'     // OTP sent by GSTN, awaiting user input
  | 'session_active'    // session valid — sync enabled
  | 'session_expired'   // session expired — refresh or re-auth required
  | 'error';            // last operation failed — see lastError

// ─── GST Connection (gst_connections collection) ──────────────────────────────

/**
 * The GST connection document — one per organization per GSTIN.
 * Stored in Firestore `gst_connections/{connectionId}`.
 */
export interface GSTConnection {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  /** 15-character GSTIN. */
  gstin: string;
  /** Legal name from GSTIN lookup (denormalized for display). */
  legalName: string;
  /** Trade name from GSTIN lookup. */
  tradeName: string;
  /** First 2 digits of GSTIN — the state code. */
  stateCode: string;
  /** GST portal username entered by the user. */
  username: string;
  /** Current auth state — drives the connect/sync UI. */
  authStatus: GSTAuthStatus;
  /** ISO timestamp of the last successful sync. */
  lastSync: string | null;
  /** ISO timestamp when the current session expires. */
  sessionExpiry: string | null;
  /**
   * AES-256-GCM encrypted session blob (tokens + metadata).
   * Stored in Firestore — org members can READ this field (rules allow it) but
   * they CANNOT decrypt it without the server-only master key.
   * The client passes this back to the server during sync operations.
   */
  encryptedSession: string | null;
  /** Human-readable last error message (NOT the raw provider error). */
  lastError: string | null;
  /** User who created the connection. */
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

// ─── GST Profile (gst_profiles collection) ────────────────────────────────────

/**
 * Full GST profile fetched after connecting.
 * Stored in Firestore `gst_profiles/{profileId}`.
 */
export interface GSTProfile {
  id: string;
  organizationId: string;
  /** Links back to the connection. */
  connectionId: string;
  gstin: string;
  legalName: string;
  tradeName: string;
  /** e.g. 'Private Limited Company', 'Proprietorship', 'LLP'. */
  businessConstitution: string;
  /** ISO date of GST registration. */
  registrationDate: string;
  /** 'Regular' | 'Composition' | 'Casual Taxable Person' | etc. */
  taxpayerType: string;
  principalAddress: string;
  /** Additional places of business (array of addresses). */
  additionalPlaceOfBusiness: string[];
  state: string;
  stateCode: string;
  /** 'Central' | 'State' | 'Centre & State'. */
  jurisdiction: string;
  /** 'Active' | 'Suspended' | 'Cancelled'. */
  status: string;
  /** 'monthly' | 'quarterly'. */
  filingFrequency: 'monthly' | 'quarterly';
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

// ─── GST Returns (gst_returns collection) ─────────────────────────────────────

export type GSTReturnType = 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B' | 'GSTR-9' | 'GSTR-9C';

export type GSTReturnStatus =
  | 'draft'        // prepared but not filed
  | 'filed'        // filed, awaiting acknowledgment
  | 'acknowledged' // filed + acknowledged by GSTN
  | 'overdue'      // past due date, not filed
  | 'not_filed';   // not yet filed, not yet overdue

/**
 * A single GST return filing record.
 * Stored in Firestore `gst_returns/{returnId}`.
 */
export interface GSTReturn {
  id: string;
  organizationId: string;
  connectionId: string;
  returnType: GSTReturnType;
  /** e.g. '2025-26'. */
  financialYear: string;
  /** e.g. '042025' (MMYYYY) monthly, 'Q1-2025-26' quarterly. */
  period: string;
  status: GSTReturnStatus;
  /** ISO date the return was filed (null if not filed). */
  filingDate: string | null;
  /** ISO date the return is due. */
  dueDate: string | null;
  /** GSTN acknowledgment number (null if not acknowledged). */
  ackNo: string | null;
  ackDate: string | null;
  totalTaxableValue: number;
  totalTax: number;
  /** Input Tax Credit (for GSTR-2B / GSTR-3B). */
  totalItc: number;
  netPayable: number;
  igstPayable: number;
  cgstPayable: number;
  sgstPayable: number;
  cessPayable: number;
  /** The full JSON payload from GSTN (return-type-specific structure). */
  jsonPayload: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── GST Notices (gst_notices collection) ─────────────────────────────────────

export type GSTNoticeType = 'notice' | 'order' | 'communication';
export type GSTNoticePriority = 'low' | 'medium' | 'high' | 'urgent';
export type GSTNoticeStatus =
  | 'open'
  | 'acknowledged'
  | 'responded'
  | 'resolved'
  | 'closed';

/**
 * A GST regulatory notice / order / communication.
 * Stored in Firestore `gst_notices/{noticeId}`.
 * Separate from the existing `notices` collection (which is for general
 * regulatory notices) — this collection is specifically for GSTN-sourced notices.
 */
export interface GSTNotice {
  id: string;
  organizationId: string;
  connectionId: string;
  noticeType: GSTNoticeType;
  /** GSTN reference number for the notice. */
  referenceNumber: string;
  subject: string;
  /** ISO date the notice was issued. */
  issueDate: string;
  /** ISO date by which a response is due (null if none). */
  dueDate: string | null;
  priority: GSTNoticePriority;
  status: GSTNoticeStatus;
  /** Issuing GST authority (e.g. 'Central Tax, Ward 5'). */
  issuingAuthority: string;
  description: string;
  /** Full notice content (type-specific structure). */
  content: Record<string, unknown>;
  /** URL to the notice document (if downloadable). */
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── GST Ledgers (gst_ledgers collection) ─────────────────────────────────────

export type GSTLedgerType = 'cash' | 'credit' | 'liability';

/** A single ledger transaction row. */
export interface GSTLedgerEntry {
  date: string;
  description: string;
  referenceNumber: string;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total: number;
  /** 'debit' decreases balance, 'credit' increases balance. */
  type: 'debit' | 'credit';
  /** Running balance after this entry. */
  balance: number;
}

/**
 * A GST ledger snapshot — Electronic Cash / Credit / Liability.
 * Stored in Firestore `gst_ledgers/{ledgerId}`.
 */
export interface GSTLedger {
  id: string;
  organizationId: string;
  connectionId: string;
  ledgerType: GSTLedgerType;
  /** ISO date this ledger snapshot is valid as of. */
  asOfDate: string;
  /** Current balances by tax head. */
  igstBalance: number;
  cgstBalance: number;
  sgstBalance: number;
  cessBalance: number;
  totalBalance: number;
  /** Transaction history (most recent first, capped at 100 entries). */
  entries: GSTLedgerEntry[];
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Sync Jobs (gst_sync_jobs collection) ─────────────────────────────────────

export type GSTSyncType = 'returns' | 'notices' | 'ledgers' | 'profile' | 'full';
export type GSTSyncTrigger = 'manual' | 'automatic' | 'background' | 'retry';
export type GSTSyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * A sync job record — tracks every sync operation for observability + retries.
 * Stored in Firestore `gst_sync_jobs/{jobId}`.
 */
export interface GSTSyncJob {
  id: string;
  organizationId: string;
  connectionId: string;
  type: GSTSyncType;
  trigger: GSTSyncTrigger;
  status: GSTSyncStatus;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  /** Summary of what was synced (null until job completes). */
  result: {
    returnsSynced?: number;
    noticesSynced?: number;
    ledgersSynced?: number;
    profileSynced?: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Service Input / Result Types ─────────────────────────────────────────────

export interface ConnectGSTNInput {
  organizationId: string;
  gstin: string;
  username: string;
  createdBy: { uid: string; name: string; email: string };
}

export interface VerifyOTPInput {
  organizationId: string;
  gstin: string;
  otp: string;
}

export interface SyncReturnsInput {
  organizationId: string;
  /** Encrypted session blob (read from the connection doc). */
  encryptedSession: string;
  gstin: string;
  /** If omitted, syncs the current + previous period. */
  period?: string;
  /** Restrict to specific return types. Default: all. */
  returnTypes?: GSTReturnType[];
}

export interface SyncNoticesInput {
  organizationId: string;
  encryptedSession: string;
  gstin: string;
}

export interface SyncLedgersInput {
  organizationId: string;
  encryptedSession: string;
  gstin: string;
}

/** Result of initiating a connection (OTP requested). */
export interface ConnectResult {
  /** Provider transaction id — used to correlate the OTP. */
  txnId: string;
  /** Masked contact (email/phone) the OTP was sent to. */
  otpSentTo: string;
  message: string;
}

/** Result of verifying an OTP — contains the encrypted session. */
export interface VerifyOTPResult {
  /** AES-256-GCM encrypted session blob — safe to store in Firestore. */
  encryptedSession: string;
  /** ISO timestamp when the session expires. */
  sessionExpiry: string;
  /** Initial profile data fetched during session creation. */
  profile: Partial<GSTProfile>;
}

/** Result of a public GSTIN verification (no session needed). */
export interface VerifyGSTINResult {
  gstin: string;
  legalName: string;
  tradeName: string;
  stateCode: string;
  status: string;
  businessConstitution: string;
  taxpayerType: string;
  registrationDate: string;
}

/** Result of a sync operation. */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
}

/** Result of a session refresh. */
export interface RefreshSessionResult {
  encryptedSession: string;
  sessionExpiry: string;
}

// ─── Aggregated Dashboard Stats ───────────────────────────────────────────────

/**
 * Aggregated GST state for the dashboard — computed from real-time Firestore data.
 * This is what `useGSTDashboard()` returns.
 */
export interface GSTDashboardStats {
  connection: GSTConnection | null;
  profile: GSTProfile | null;
  /** Latest filing for each return type. */
  filingStatus: {
    'GSTR-1': GSTReturn | null;
    'GSTR-3B': GSTReturn | null;
    'GSTR-2B': GSTReturn | null;
    'GSTR-9': GSTReturn | null;
    'GSTR-9C': GSTReturn | null;
  };
  /** Returns that are overdue or not yet filed. */
  pendingReturns: GSTReturn[];
  /** Current net GST liability (from liability ledger). */
  gstLiability: number;
  cashLedger: GSTLedger | null;
  creditLedger: GSTLedger | null;
  liabilityLedger: GSTLedger | null;
  /** Most recent 5 notices. */
  latestNotices: GSTNotice[];
  /** Recent sync jobs (most recent 10). */
  recentSyncJobs: GSTSyncJob[];
  /** True if a sync is currently running. */
  isSyncing: boolean;
}
