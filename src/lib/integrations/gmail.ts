// ═══════════════════════════════════════════════════════════════════════════════
// gmail.ts — Gmail API v1 adapter
//
// Provider: Gmail API v1 (https://developers.google.com/gmail/api)
// Endpoint: `gmail.googleapis.com/gmail/v1/users/me/...`
// Auth: OAuth 2.0 access token + refresh token (Google Cloud project)
//
// STATUS: PLACEHOLDER. Full method signatures + types defined. Throws
// IntegrationNotConfiguredError when the Connection has no creds. Throws
// Error('Gmail adapter requires live Google OAuth creds...') when creds are
// present but the live API call hasn't been wired yet. NO fake data.
//
// To make this adapter live:
//   1. Create a Google Cloud project + OAuth consent screen.
//   2. Add the gmail.readonly + gmail.send scopes.
//   3. Set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
//      GOOGLE_REDIRECT_URI (used by the OAuth callback route).
//   4. Implement `refreshAccessToken()` to call
//      `https://oauth2.googleapis.com/token` with the refresh token.
//   5. Wire the GET methods below to the Gmail API.
//   6. Implement `parseInvoiceFromEmail()` heuristic to extract invoice rows
//      from email body/attachments.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  asCredentials,
  IntegrationNotConfiguredError,
  type ConnectionRecord,
  type DecryptedCredentials,
  type GmailCredentials,
  type ParsedGmailMessage,
  type ParsedInvoice,
} from './types'
import { decryptCredentials } from './crypto'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ListMessagesOptions {
  q?: string // Gmail search query, e.g. "subject:invoice newer_than:7d"
  maxResults?: number
  pageToken?: string
}

export interface GmailMessageRow {
  id: string
  threadId: string
  snippet: string
}

export interface GmailMessageDetail {
  id: string
  threadId: string
  labelIds: string[]
  from: string
  to: string
  subject: string
  snippet: string
  bodyPlain: string
  bodyHtml: string
  receivedAt: Date
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number }>
  raw: Record<string, unknown> // the raw Gmail message resource
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function loadCredentials(conn: ConnectionRecord): GmailCredentials {
  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError('gmail')
  }
  let raw: DecryptedCredentials
  try {
    raw = decryptCredentials(conn.credentialsEnc)
  } catch {
    throw new IntegrationNotConfiguredError(
      'gmail',
      'Gmail credentials are present but could not be decrypted. Re-configure the integration.',
    )
  }
  const creds = asCredentials('gmail', raw)
  if (!creds.accessToken && !creds.refreshToken) {
    throw new IntegrationNotConfiguredError(
      'gmail',
      'Gmail credentials are incomplete. Required: accessToken or refreshToken.',
    )
  }
  return creds
}

function requireGoogleOauthEnv(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Gmail adapter requires live Google OAuth creds — configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI env vars.',
    )
  }
  return { clientId, clientSecret, redirectUri }
}

/**
 * Refresh the access token using the stored refresh token. Returns the new
 * access token + expiry. When wired, the sync orchestrator should call this
 * before any listMessages / getMessage call.
 *
 * TODO: POST `https://oauth2.googleapis.com/token` with
 * `{ client_id, client_secret, refresh_token, grant_type: 'refresh_token' }`.
 */
export async function refreshAccessToken(conn: ConnectionRecord): Promise<{
  accessToken: string
  expiresAt: string
}> {
  const creds = loadCredentials(conn)
  const oauth = requireGoogleOauthEnv()
  void creds
  void oauth
  throw new Error(
    'Gmail refreshAccessToken() is not yet implemented. Wire the OAuth2 token refresh POST to enable Gmail sync.',
  )
}

// ─── Public adapter methods ─────────────────────────────────────────────────────

/**
 * GET `/gmail/v1/users/me/messages?q={q}&maxResults={n}&pageToken={t}`
 * — list message stubs (id + threadId + snippet). Use getMessage() to fetch
 * the full body for each.
 */
export async function listMessages(
  conn: ConnectionRecord,
  opts: ListMessagesOptions = {},
): Promise<{ messages: GmailMessageRow[]; nextPageToken?: string }> {
  const creds = loadCredentials(conn)
  const oauth = requireGoogleOauthEnv()
  void creds
  void oauth
  void opts
  // TODO: const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(opts.q ?? '')}&maxResults=${opts.maxResults ?? 50}`, { headers: { Authorization: `Bearer ${creds.accessToken}` } })
  throw new Error(
    'Gmail listMessages() is not yet implemented. Wire the live GET to /gmail/v1/users/me/messages.',
  )
}

/**
 * GET `/gmail/v1/users/me/messages/{id}?format=full` — full message detail
 * including headers + body parts + attachment metadata.
 */
export async function getMessage(
  conn: ConnectionRecord,
  id: string,
): Promise<GmailMessageDetail> {
  const creds = loadCredentials(conn)
  const oauth = requireGoogleOauthEnv()
  void creds
  void oauth
  void id
  throw new Error(
    'Gmail getMessage() is not yet implemented. Wire the live GET to /gmail/v1/users/me/messages/{id}.',
  )
}

/**
 * Heuristic invoice extractor. Scans the subject + body for invoice-like
 * patterns (invoice number, GSTIN, total amount, due date). Returns null if
 * no confident match. The sync orchestrator only upserts when this returns
 * a non-null result.
 *
 * Implemented as a pure heuristic — does NOT call the Gmail API. Ready to
 * use today; just needs the message body to scan.
 */
export function parseInvoiceFromEmail(msg: GmailMessageDetail): ParsedInvoice | null {
  const haystack = `${msg.subject}\n${msg.bodyPlain}`.toLowerCase()

  // Quick reject — must mention "invoice" or "tax invoice" or "gst"
  if (!haystack.includes('invoice') && !haystack.includes('gst')) {
    return null
  }

  // GSTIN regex: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
  const gstinMatch = /[a-z0-9]{15}/i.exec(msg.bodyPlain.replace(/\s+/g, ''))
  const sellerGstin = gstinMatch && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(gstinMatch[0])
    ? gstinMatch[0].toUpperCase()
    : ''

  // Invoice number — common patterns: "Invoice #1234", "Invoice No: 1234", "INV-2025-001"
  const invNoMatch =
    /invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-/]{3,20})/i.exec(msg.bodyPlain)
  const invoiceNumber = invNoMatch?.[1] ?? ''

  // Total amount — "Total: ₹12,345.00" or "Grand Total 12345"
  const totalMatch =
    /(?:total|grand total|amount due)\s*[:\-]?\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i.exec(
      msg.bodyPlain,
    )
  const totalAmount = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : 0

  // Need at least a seller GSTIN or an invoice number to be confident.
  if (!sellerGstin && !invoiceNumber) return null

  return {
    invoiceNumber: invoiceNumber || `email-${msg.id}`,
    sellerGstin: sellerGstin || 'UNKNOWN',
    invoiceDate: msg.receivedAt.toISOString().slice(0, 10),
    totalAmount,
    source: 'gmail',
    sourceRef: msg.id,
  }
}

/**
 * Convenience — pulls messages matching `opts.q`, fetches each detail, and
 * returns the parsed list ready for the sync orchestrator to upsert into
 * GmailMessage + (optionally) Invoice.
 */
export async function pullMessages(
  conn: ConnectionRecord,
  opts: ListMessagesOptions = {},
): Promise<ParsedGmailMessage[]> {
  const { messages } = await listMessages(conn, opts)
  const out: ParsedGmailMessage[] = []
  for (const m of messages) {
    const detail = await getMessage(conn, m.id)
    out.push({
      messageId: detail.id,
      threadId: detail.threadId,
      fromAddress: detail.from,
      toAddress: detail.to,
      subject: detail.subject,
      snippet: detail.snippet,
      bodyPlain: detail.bodyPlain,
      bodyHtml: detail.bodyHtml,
      hasAttachment: detail.attachments.length > 0,
      attachmentNames: detail.attachments.map((a) => a.filename),
      labels: detail.labelIds,
      receivedAt: detail.receivedAt,
      rawPayload: detail.raw,
    })
  }
  return out
}

/**
 * POST `/gmail/v1/users/me/messages/send` — send an email through the
 * connected account.
 */
export async function sendEmail(
  conn: ConnectionRecord,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const creds = loadCredentials(conn)
  const oauth = requireGoogleOauthEnv()
  void creds
  void oauth
  void to
  void subject
  void body
  throw new Error(
    'Gmail sendEmail() is not yet implemented. Wire the live POST to /gmail/v1/users/me/messages/send.',
  )
}
