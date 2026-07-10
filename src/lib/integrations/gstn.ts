// ═══════════════════════════════════════════════════════════════════════════════
// gstn.ts — GSTN (Goods & Services Tax Network) adapter
//
// Provider: GSTN API v1.0 (https://developer.gst.gov.in/api/)
// Endpoint: api.gstn.org.in (via a licensed GSP — Gateway Service Provider)
// Auth: GSP-issued OTP + JWT (gsp.otp → authToken / refreshToken)
//
// STATUS: PLACEHOLDER. Full method signatures + types are defined so the
// sync orchestrator can be wired today. When called without credentials the
// adapter throws IntegrationNotConfiguredError. When called WITH credentials
// the adapter throws Error('GSTN adapter requires GSP credentials and a live
// GSP partner — configure GSP_CODE, GSTN_GSP_BASE_URL env vars') because the
// actual GSP integration requires a licensed partner (e.g. Cleartax, Masters
// India, Tax GX) and a signed GSP agreement. NO fake data is returned.
//
// To make this adapter live:
//   1. Sign up with a GSP and obtain `clientId`, `clientSecret`, `gspCode`.
//   2. Set env vars: GSTN_GSP_BASE_URL, GSTN_GSP_CODE, GSTN_GSP_CLIENT_ID,
//      GSTN_GSP_CLIENT_SECRET.
//   3. Implement `authenticate()` to call the GSP's `/auth/v1.0/otp` + `/auth/v1.0/token`
//      endpoints and store `authToken`/`refreshToken` in the encrypted Connection.
//   4. Implement the GET methods below to call the live GSTN endpoints.
//   5. Replace each `throw new Error(...)` in the data-fetch methods with the
//      actual fetch + parse logic.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  asCredentials,
  IntegrationNotConfiguredError,
  type ConnectionRecord,
  type DecryptedCredentials,
  type GstnCredentials,
  type ParsedNotice,
  type ParsedReturn,
} from './types'
import { decryptCredentials } from './crypto'

// ─── Types (returned by GSTN endpoints) ─────────────────────────────────────────
// These mirror the GSTN public API spec at https://developer.gst.gov.in/api/.

export interface GstnAuthToken {
  authToken: string
  expiresAt: string // ISO
  refreshToken?: string
}

export interface TaxpayerInfo {
  gstin: string
  legalName: string
  tradeName: string
  status: string // "Active" | "Cancelled" | "Suspended" | "Provisional"
  entityType: string
  businessType: string
  state: string
  stateCode: string
  registrationDate: string
  constitution: string
  addresses: Array<{
    addressType: string
    address: string
    city: string
    state: string
    pincode: string
  }>
}

export interface GstnReturn {
  returnType: string // "GSTR1" | "GSTR3B" | "GSTR2B" | ...
  financialYear: string
  period: string // "042025" → April 2025
  status: string // "Filed" | "Not Filed" | "Ready" | ...
  filingDate?: string
  ackNo?: string
  arn?: string
}

export interface FilingDetails {
  returnType: string
  financialYear: string
  period: string
  status: string
  filingDate?: string
  ackNo?: string
  arn?: string
  totalTaxableValue: number
  totalTax: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  // The full JSON payload returned by GSTN for the filing.
  payload: Record<string, unknown>
}

export interface GstnNotice {
  noticeId: string
  noticeType: string // "ASMT-10" | "ASMT-11" | "DRC-01" | "DRC-01A" | ...
  noticeNumber: string
  noticeDate: string
  subject: string
  description?: string
  dueDate?: string
  status?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Decrypt and validate the connection's credentials. Throws
 * IntegrationNotConfiguredError if the connection has no credentials blob or
 * is missing required fields.
 */
function loadCredentials(conn: ConnectionRecord): GstnCredentials {
  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError('gstn')
  }
  let raw: DecryptedCredentials
  try {
    raw = decryptCredentials(conn.credentialsEnc)
  } catch {
    throw new IntegrationNotConfiguredError(
      'gstn',
      'GSTN credentials are present but could not be decrypted. Re-configure the integration.',
    )
  }
  const creds = asCredentials('gstn', raw)
  // Required: at least the GSP client id + a gstin username to authenticate.
  if (!creds.clientId || !creds.gstinUsername) {
    throw new IntegrationNotConfiguredError(
      'gstn',
      'GSTN credentials are incomplete. Required: clientId, gstinUsername (and a GSP code).',
    )
  }
  return creds
}

/**
 * The adapter requires both per-Connection credentials AND process-level env
 * vars for the GSP partner (the GSP is a single firm-wide configuration).
 * This helper checks both.
 */
function requireGspEnv(): { baseUrl: string; gspCode: string; clientId: string; clientSecret: string } {
  const baseUrl = process.env.GSTN_GSP_BASE_URL
  const gspCode = process.env.GSTN_GSP_CODE
  const clientId = process.env.GSTN_GSP_CLIENT_ID
  const clientSecret = process.env.GSTN_GSP_CLIENT_SECRET

  if (!baseUrl || !gspCode || !clientId || !clientSecret) {
    throw new Error(
      'GSTN adapter requires GSP credentials and a live GSP partner — configure GSTN_GSP_BASE_URL, GSTN_GSP_CODE, GSTN_GSP_CLIENT_ID, GSTN_GSP_CLIENT_SECRET env vars.',
    )
  }
  return { baseUrl, gspCode, clientId, clientSecret }
}

// ─── Public adapter methods ─────────────────────────────────────────────────────

/**
 * Authenticate with the GSP. The GSTN auth flow is OTP-based:
 *   1. POST `/auth/v1.0/otp` with `{ username, gstin, client_id, client_secret, state }` → triggers an SMS OTP to the registered mobile.
 *   2. POST `/auth/v1.0/token` with the OTP → returns `{ auth_token, expires_in, refresh_token }`.
 *
 * This is a placeholder — when wired, store the resulting `authToken` and
 * `refreshToken` back into the Connection's encrypted credentials.
 */
export async function authenticate(
  conn: ConnectionRecord,
  _otp?: string,
): Promise<GstnAuthToken> {
  const creds = loadCredentials(conn)
  void creds
  const gsp = requireGspEnv()

  // TODO: Implement OTP / token exchange against `${gsp.baseUrl}/auth/v1.0/otp` + `/auth/v1.0/token`.
  // TODO: Cache the returned authToken in `creds.authToken` and persist back to the Connection.
  throw new Error(
    `GSTN authenticate() is not yet implemented. GSP base URL configured: ${gsp.baseUrl}. Wire the OTP + token exchange to enable GSTN sync.`,
  )
}

/**
 * GET `/api/taxpayerapi/v1.0/taxpayers/{gstin}` — basic taxpayer details
 * (legal name, trade name, status, registration date, addresses).
 */
export async function getTaxpayerDetails(
  conn: ConnectionRecord,
  gstin: string,
): Promise<TaxpayerInfo> {
  const creds = loadCredentials(conn)
  const gsp = requireGspEnv()

  // TODO: const res = await fetch(`${gsp.baseUrl}/api/taxpayerapi/v1.0/taxpayers/${gstin}`, { headers: { 'Authorization': `Bearer ${creds.authToken}`, 'gsp-code': gsp.gspCode } })
  void creds
  void gstin
  throw new Error(
    'GSTN getTaxpayerDetails() is not yet implemented. Wire the live GET to /api/taxpayerapi/v1.0/taxpayers/{gstin}.',
  )
}

/**
 * GET `/api/returns/v1.0/returns` — list of returns for a GSTIN + financial year.
 * Returns the upstream GstnReturn shape; the sync orchestrator maps these
 * into ParsedReturn rows for upsert into GSTRFiling.
 */
export async function getReturnsList(
  conn: ConnectionRecord,
  gstin: string,
  fy: string,
): Promise<GstnReturn[]> {
  const creds = loadCredentials(conn)
  const gsp = requireGspEnv()
  void creds
  void gstin
  void fy
  // TODO: fetch + parse. Empty array on no data.
  throw new Error(
    `GSTN getReturnsList() is not yet implemented. Wire the live GET to ${gsp.baseUrl}/api/returns/v1.0/returns.`,
  )
}

/**
 * GET `/api/returns/v1.0/returns?return_type={r}&fy={fy}&ret_period={period}`
 * — full filing details including the line-item JSON payload.
 */
export async function getReturnFilingDetails(
  conn: ConnectionRecord,
  gstin: string,
  returnType: string,
  fy: string,
  period: string,
): Promise<FilingDetails> {
  const creds = loadCredentials(conn)
  const gsp = requireGspEnv()
  void creds
  void gstin
  void returnType
  void fy
  void period
  throw new Error(
    'GSTN getReturnFilingDetails() is not yet implemented. Wire the live GET to /api/returns/v1.0/returns with return_type, fy, ret_period.',
  )
}

/**
 * GET `/api/notices/v1.0/notice` — notices issued to the taxpayer by GSTN.
 * Maps each upstream notice into a ParsedNotice for upsert into Notice.
 */
export async function getNotices(
  conn: ConnectionRecord,
  gstin: string,
): Promise<ParsedNotice[]> {
  const creds = loadCredentials(conn)
  const gsp = requireGspEnv()
  void creds
  void gstin
  // TODO: fetch + parse.
  throw new Error(
    `GSTN getNotices() is not yet implemented. Wire the live GET to ${gsp.baseUrl}/api/notices/v1.0/notice.`,
  )
}

/**
 * Convenience — returns a list of ParsedReturn rows ready for the sync
 * orchestrator to upsert into GSTRFiling. Pulls getReturnsList() then
 * optionally fetches filing details for each. Returns empty array when
 * the upstream has no returns for the period.
 */
export async function pullReturns(
  conn: ConnectionRecord,
  gstin: string,
  fy: string,
): Promise<ParsedReturn[]> {
  const upstream = await getReturnsList(conn, gstin, fy)
  // Map upstream → ParsedReturn (no fetch of details for now — keeps the
  // initial sync lightweight. Detail fetch happens on-demand in the UI.)
  return upstream.map((r) => ({
    returnType: r.returnType,
    period: r.period,
    financialYear: r.financialYear,
    status: r.status,
    filedDate: r.filingDate,
    ackNo: r.ackNo,
    source: 'gstn',
    sourceRef: r.arn ?? r.ackNo,
  }))
}

/**
 * Download the full JSON payload for a single return (e.g. the GSTR-1 with
 * all B2B invoices). Used for reconciliation imports.
 */
export async function downloadReturn(
  conn: ConnectionRecord,
  gstin: string,
  returnType: string,
  fy: string,
  period: string,
): Promise<Record<string, unknown>> {
  const details = await getReturnFilingDetails(conn, gstin, returnType, fy, period)
  return details.payload
}
