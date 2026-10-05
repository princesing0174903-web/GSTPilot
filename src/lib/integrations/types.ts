// ═══════════════════════════════════════════════════════════════════════════════
// types.ts — Shared types for the Integrations layer (Task BACKEND-INTEGRATIONS-1)
//
// This module is the single source of truth for:
//   • ProviderKey union (gstn | gmail | drive | whatsapp | banks | razorpay | excel | clients)
//   • Connection-shaped type (mirrors the Prisma `Connection` model)
//   • Per-provider credentials interfaces (the JSON shape that gets encrypted)
//   • Adapter input types for invoices / payments / transactions / etc.
//   • SyncResult + SyncLogEntry (what adapters return from a sync run)
//   • IntegrationNotConfiguredError (thrown by every adapter when creds are missing)
//
// NO fake data lives here. Every adapter that needs credentials throws
// IntegrationNotConfiguredError if its required credential fields are absent.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Provider registry ──────────────────────────────────────────────────────────
// Real Data Connectors™ — 7 categories, 20+ connectors.
// Each key maps to an adapter (real or generic health-check) in registry.ts.
export type ProviderKey =
  // Government
  | 'gstn'
  // Banking (Account Aggregator pattern, one key per bank for per-card status)
  | 'banks'
  | 'hdfc'
  | 'icici'
  | 'sbi'
  | 'axis'
  | 'kotak'
  | 'indusind'
  // Communication
  | 'gmail'
  | 'outlook'
  | 'whatsapp'
  // Storage
  | 'drive'
  | 'excel'
  // Payments
  | 'razorpay'
  | 'cashfree'
  | 'payu'
  | 'stripe'
  // Accounting
  | 'tally'
  | 'zoho_books'
  | 'quickbooks'
  // Business Systems
  | 'clients'

// ─── Connection shape (mirrors Prisma `Connection` model, minus DB internals) ──
export interface ConnectionRecord {
  id: string
  firmId: string | null
  provider: ProviderKey
  label: string | null
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  credentialsEnc: string | null
  metadata: string | null
  lastSyncAt: Date | null
  lastSyncStatus: 'success' | 'error' | 'partial' | null
  lastSyncError: string | null
  lastSyncSummary: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Per-provider credential shapes ─────────────────────────────────────────────
// Each interface lists the JSON keys the adapter expects to find after
// decrypting `credentialsEnc`. Any adapter may store extra keys (it just
// won't read them). When any REQUIRED field is missing, the adapter throws
// IntegrationNotConfiguredError — it never silently no-ops or fabricates data.

export interface GstnCredentials {
  gspCode?: string
  clientId?: string
  clientSecret?: string
  gstinUsername?: string
  authToken?: string
  refreshToken?: string
  tokenExpiresAt?: string // ISO
}

export interface GmailCredentials {
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string // ISO
  emailAddress?: string
  scope?: string
}

export interface DriveCredentials {
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string // ISO
  rootFolderId?: string
}

export interface WhatsappCredentials {
  phoneNumberId?: string
  wabaId?: string // WhatsApp Business Account id
  accessToken?: string
  verifyToken?: string
  webhookSecret?: string
}

export interface BanksCredentials {
  bankName?: string
  accountNumber?: string // last 4 digits
  ifsc?: string
  apiKey?: string
  apiSecret?: string
  aggregatorName?: string // "anubhav" | "onemoney" | "setu" | ...
}

export interface RazorpayCredentials {
  keyId?: string
  keySecret?: string
  webhookSecret?: string
  accountId?: string
}

// ─── Real Data Connectors™ — new credential shapes ────────────────────────────

export interface OutlookCredentials {
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string // ISO
  emailAddress?: string
}

export interface CashfreeCredentials {
  appId?: string
  secretKey?: string
  environment?: 'TEST' | 'PROD'
  apiVersion?: string
}

export interface PayUCredentials {
  merchantKey?: string
  merchantSalt?: string
  environment?: 'TEST' | 'LIVE'
}

export interface StripeCredentials {
  secretKey?: string
  publishableKey?: string
  accountId?: string
}

export interface TallyCredentials {
  serverUrl?: string // e.g. http://192.168.1.10:9000
  company?: string // Tally company name
  apiKey?: string
}

export interface ZohoBooksCredentials {
  accessToken?: string
  refreshToken?: string
  organizationId?: string
  dataCenter?: string // 'in' | 'com' | 'eu' | 'au'
}

export interface QuickBooksCredentials {
  accessToken?: string
  refreshToken?: string
  companyId?: string
  environment?: 'sandbox' | 'production'
}

/** Per-bank credentials (HDFC, ICICI, SBI, Axis, Kotak, IndusInd). */
export interface BankConnectorCredentials extends BanksCredentials {
  bankKey?: string // 'hdfc' | 'icici' | 'sbi' | 'axis' | 'kotak' | 'indusind'
}

export interface ExcelCredentials {
  /** Local-only — no credentials required. Kept as an object for shape parity. */
  readonly _local?: true
}

export interface ClientsCredentials {
  /** Internal — no credentials required. Kept as an object for shape parity. */
  readonly _internal?: true
}

// Map provider → credentials shape. Used by adapters to safely cast the
// decrypted JSON blob into the right shape.
export interface CredentialsByProvider {
  gstn: GstnCredentials
  gmail: GmailCredentials
  drive: DriveCredentials
  whatsapp: WhatsappCredentials
  banks: BanksCredentials
  razorpay: RazorpayCredentials
  excel: ExcelCredentials
  clients: ClientsCredentials
  // Real Data Connectors™
  outlook: OutlookCredentials
  cashfree: CashfreeCredentials
  payu: PayUCredentials
  stripe: StripeCredentials
  tally: TallyCredentials
  zoho_books: ZohoBooksCredentials
  quickbooks: QuickBooksCredentials
  hdfc: BankConnectorCredentials
  icici: BankConnectorCredentials
  sbi: BankConnectorCredentials
  axis: BankConnectorCredentials
  kotak: BankConnectorCredentials
  indusind: BankConnectorCredentials
}

// A decrypted credential blob is just a Record<string, unknown> until the
// adapter narrows it to its own interface. We expose this loose type so the
// crypto helper doesn't have to know about every provider.
export type DecryptedCredentials = Record<string, unknown>

// ─── Sync result + log ──────────────────────────────────────────────────────────
export interface SyncLogEntry {
  step: string
  status: 'success' | 'error' | 'partial' | 'skipped'
  count?: number
  message?: string
}

export interface SyncResult {
  recordsPulled: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  log: SyncLogEntry[]
  summary: string // human-readable, e.g. "Pulled 12 invoices, 3 notices"
}

// ─── Adapter input types (what an adapter upserts into Prisma) ──────────────────
// These are deliberately provider-agnostic so the sync orchestrator can pass
// the same shape regardless of whether the row came from GSTN, Excel, etc.

export interface ParsedInvoice {
  invoiceNumber: string
  invoiceDate?: string // ISO date or free-text
  sellerGstin: string
  buyerGstin?: string
  buyerName?: string
  invoiceType?: string
  taxableValue?: number
  cgst?: number
  sgst?: number
  igst?: number
  cess?: number
  totalAmount?: number
  hsnCode?: string
  period?: string
  source?: string
  sourceRef?: string
}

export interface ParsedClient {
  gstin: string
  tradeName: string
  legalName?: string
  address?: string
  state?: string
  stateCode?: string
  contactEmail?: string
  contactPhone?: string
  entityType?: string
}

export interface ParsedPayment {
  clientId?: string
  invoiceId?: string
  source?: string
  sourceRef?: string
  direction?: 'in' | 'out'
  amount: number
  currency?: string
  method?: string
  status?: string
  referenceNo?: string
  description?: string
  paidAt?: Date | string
}

export interface ParsedReturn {
  clientId?: string
  returnType: string
  period: string
  financialYear?: string
  status?: string
  filedDate?: string
  ackNo?: string
  totalTaxableValue?: number
  totalTax?: number
  source?: string
  sourceRef?: string
}

export interface ParsedNotice {
  clientId?: string
  noticeType?: string
  noticeNumber?: string
  noticeDate?: string
  subject: string
  description?: string
  priority?: string
  source?: string
  sourceRef?: string
}

export interface ParsedBankTransaction {
  bankAccountId?: string
  clientId?: string
  date: Date | string
  description?: string
  amount: number
  direction?: 'in' | 'out'
  balanceAfter?: number
  referenceNo?: string
  counterparty?: string
  counterpartyAccount?: string
  counterpartyIfsc?: string
  rawPayload?: unknown
}

export interface ParsedBankAccount {
  bankName: string
  accountNumber: string
  accountNumberMasked?: string
  ifsc?: string
  accountType?: string
  accountHolder?: string
  currentBalance?: number
  availableBalance?: number
  currency?: string
}

export interface ParsedGmailMessage {
  messageId: string
  threadId?: string
  fromAddress?: string
  toAddress?: string
  subject?: string
  snippet?: string
  bodyPlain?: string
  bodyHtml?: string
  hasAttachment?: boolean
  attachmentNames?: string[]
  labels?: string[]
  receivedAt?: Date | string
  rawPayload?: unknown
}

export interface ParsedDriveFile {
  driveFileId: string
  name: string
  mimeType?: string
  size?: number
  webViewLink?: string
  thumbnailLink?: string
  md5Checksum?: string
  parents?: string[]
  rawPayload?: unknown
}

export interface ParsedWhatsAppMessage {
  direction?: 'in' | 'out'
  fromPhone?: string
  toPhone?: string
  templateName?: string
  templateLanguage?: string
  body: string
  status?: string
  waMessageId?: string
  receivedAt?: Date | string
  sentAt?: Date | string
  rawPayload?: unknown
}

// ─── Errors ─────────────────────────────────────────────────────────────────────

/**
 * Thrown when an adapter is invoked but its connection has no credentials
 * (or the credentials are incomplete). The sync orchestrator catches this and
 * ends the SyncJob with status="error" + `requiresConfiguration: true` so the
 * caller (UI/API) can prompt the user to configure the integration.
 *
 * CRITICAL: This is the ONLY acceptable failure mode for an unconfigured
 * adapter. Adapters MUST NOT fabricate fake data to mask a missing config.
 */
export class IntegrationNotConfiguredError extends Error {
  readonly provider: ProviderKey
  readonly requiresConfiguration = true

  constructor(provider: ProviderKey, message?: string) {
    super(
      message ??
        `${provider.toUpperCase()} integration is not configured. Add credentials to enable this adapter.`,
    )
    this.name = 'IntegrationNotConfiguredError'
    this.provider = provider
  }
}

/**
 * Thrown when the adapter HAS credentials but the live third-party API
 * call fails (network, auth, rate limit, etc.). Distinct from
 * IntegrationNotConfiguredError so the orchestrator can surface the right
 * error message ("Re-auth required" vs "Configure first").
 */
export class IntegrationAuthError extends Error {
  readonly provider: ProviderKey

  constructor(provider: ProviderKey, message: string) {
    super(`${provider.toUpperCase()} auth error: ${message}`)
    this.name = 'IntegrationAuthError'
    this.provider = provider
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Type guard — true if `v` is a non-null object with at least one key. */
export function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.keys(v as Record<string, unknown>).length > 0
  )
}

/** Narrow the decrypted credential blob into a specific provider's shape. */
export function asCredentials<P extends ProviderKey>(
  provider: P,
  raw: DecryptedCredentials,
): CredentialsByProvider[P] {
  // The raw blob is already shape-compatible; we just assert the type. The
  // adapter is responsible for validating its own required fields.
  void provider
  return raw as unknown as CredentialsByProvider[P]
}
