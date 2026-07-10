// ═══════════════════════════════════════════════════════════════════════════════
// razorpay.ts — Razorpay X API adapter
//
// Provider: Razorpay X API (https://razorpay.com/docs/api/)
// Endpoint: `https://api.razorpay.com/v1/...`
// Auth: HTTP Basic with `keyId:keySecret`
//
// STATUS: PLACEHOLDER. Method signatures + types defined. Throws
// IntegrationNotConfiguredError without creds. Throws Error('Razorpay adapter
// requires live API keys...') with creds but unwired API. NO fake data.
//
// To make this adapter live:
//   1. Sign up at Razorpay, generate API keys (key_id + key_secret).
//   2. Configure `keyId`, `keySecret`, `webhookSecret`, `accountId` in the
//      Connection (the account id is your Razorpay X account id, used for
//      payouts).
//   3. Wire listPayments / listPayouts / listSettlements to the live API.
//   4. Wire verifyWebhookSignature() against X-Razorpay-Signature header.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac } from 'node:crypto'

import {
  asCredentials,
  IntegrationNotConfiguredError,
  type ConnectionRecord,
  type DecryptedCredentials,
  type ParsedPayment,
  type RazorpayCredentials,
} from './types'
import { decryptCredentials, safeEqual } from './crypto'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface RazorpayListOptions {
  from?: number // unix timestamp
  to?: number // unix timestamp
  count?: number
  skip?: number
}

export interface RazorpayPayment {
  id: string
  entity: 'payment'
  amount: number // in paise
  currency: string
  status: string // 'captured' | 'authorized' | 'failed' | 'refunded'
  method: string // 'upi' | 'card' | 'netbanking' | 'wallet' | ...
  order_id?: string
  invoice_id?: string
  email?: string
  contact?: string
  fee?: number
  tax?: number
  created_at: number // unix seconds
  raw: Record<string, unknown>
}

export interface RazorpayPayout {
  id: string
  entity: 'payout'
  account_id?: string
  amount: number // in paise
  currency: string
  status: string // 'queued' | 'processing' | 'processed' | 'reversed' | 'failed'
  method: string // 'upi' | 'netbanking' | ...
  utr?: string
  narration?: string
  created_at: number
  raw: Record<string, unknown>
}

export interface RazorpaySettlement {
  id: string
  entity: 'settlement'
  amount: number // in paise
  currency: string
  status: string // 'processed' | 'pending'
  created_at: number
  raw: Record<string, unknown>
}

export interface CreatePayoutPayload {
  account_number: string
  amount: number // in paise
  currency?: string
  mode: 'upi' | 'imps' | 'rtgs' | 'neft'
  purpose?: string
  fund_account_id?: string
  narration?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function loadCredentials(conn: ConnectionRecord): RazorpayCredentials {
  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError('razorpay')
  }
  let raw: DecryptedCredentials
  try {
    raw = decryptCredentials(conn.credentialsEnc)
  } catch {
    throw new IntegrationNotConfiguredError(
      'razorpay',
      'Razorpay credentials are present but could not be decrypted. Re-configure the integration.',
    )
  }
  const creds = asCredentials('razorpay', raw)
  if (!creds.keyId || !creds.keySecret) {
    throw new IntegrationNotConfiguredError(
      'razorpay',
      'Razorpay credentials are incomplete. Required: keyId, keySecret.',
    )
  }
  return creds
}

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1'

/**
 * Build the HTTP Basic auth header value (`Basic base64(keyId:keySecret)`).
 */
function authHeader(creds: RazorpayCredentials): string {
  const raw = `${creds.keyId}:${creds.keySecret}`
  return 'Basic ' + Buffer.from(raw).toString('base64')
}

// ─── Public adapter methods ─────────────────────────────────────────────────────

/**
 * GET `/payments` — list payments. Returns parsed RazorpayPayment[].
 */
export async function listPayments(
  conn: ConnectionRecord,
  opts: RazorpayListOptions = {},
): Promise<RazorpayPayment[]> {
  const creds = loadCredentials(conn)
  void creds
  void opts
  // TODO: const qs = new URLSearchParams({ from: String(opts.from ?? 0), to: String(opts.to ?? Math.floor(Date.now()/1000)), count: String(opts.count ?? 100), skip: String(opts.skip ?? 0) })
  //       const res = await fetch(`${RAZORPAY_BASE_URL}/payments?${qs}`, { headers: { Authorization: authHeader(creds) } })
  throw new Error(
    `Razorpay listPayments() is not yet implemented. Wire the live GET to ${RAZORPAY_BASE_URL}/payments.`,
  )
}

/**
 * GET `/payments/{id}` — fetch a single payment by id.
 */
export async function getPaymentById(
  conn: ConnectionRecord,
  id: string,
): Promise<RazorpayPayment> {
  const creds = loadCredentials(conn)
  void creds
  void id
  throw new Error(
    `Razorpay getPaymentById() is not yet implemented. Wire the live GET to ${RAZORPAY_BASE_URL}/payments/{id}.`,
  )
}

/**
 * GET `/payouts` — list payouts from Razorpay X.
 */
export async function listPayouts(
  conn: ConnectionRecord,
  opts: RazorpayListOptions = {},
): Promise<RazorpayPayout[]> {
  const creds = loadCredentials(conn)
  void creds
  void opts
  throw new Error(
    `Razorpay listPayouts() is not yet implemented. Wire the live GET to ${RAZORPAY_BASE_URL}/payouts.`,
  )
}

/**
 * GET `/settlements` — list settlements (reporting-only; the settlement is
 * the net amount Razorpay credits to your bank account each day).
 */
export async function listSettlements(
  conn: ConnectionRecord,
  opts: RazorpayListOptions = {},
): Promise<RazorpaySettlement[]> {
  const creds = loadCredentials(conn)
  void creds
  void opts
  throw new Error(
    `Razorpay listSettlements() is not yet implemented. Wire the live GET to ${RAZORPAY_BASE_URL}/settlements.`,
  )
}

/**
 * POST `/payouts` — create a new payout from Razorpay X.
 */
export async function createPayout(
  conn: ConnectionRecord,
  payload: CreatePayoutPayload,
): Promise<RazorpayPayout> {
  const creds = loadCredentials(conn)
  void creds
  void payload
  throw new Error(
    `Razorpay createPayout() is not yet implemented. Wire the live POST to ${RAZORPAY_BASE_URL}/payouts.`,
  )
}

/**
 * Verify the `X-Razorpay-Signature` header against the raw webhook body.
 * Razorpay signs the body with HMAC-SHA256 using the webhook secret.
 *
 * This is a REAL implementation — it's pure crypto, no external API call.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqual(expected, signature)
}

/**
 * Convenience — pulls recent payments + payouts and converts them into
 * ParsedPayment rows for the sync orchestrator to upsert into Payment.
 * Razorpay amounts are in paise; we convert to rupees (Float) here.
 */
export async function pullPayments(
  conn: ConnectionRecord,
  opts: RazorpayListOptions = {},
): Promise<ParsedPayment[]> {
  const [payments, payouts] = await Promise.all([
    listPayments(conn, opts),
    listPayouts(conn, opts),
  ])
  const out: ParsedPayment[] = []
  for (const p of payments) {
    out.push({
      source: 'razorpay',
      sourceRef: p.id,
      direction: 'in',
      amount: p.amount / 100, // paise → rupees
      currency: p.currency,
      method: p.method,
      status: p.status === 'captured' ? 'cleared' : p.status,
      description: p.email ?? p.contact ?? p.id,
      paidAt: new Date(p.created_at * 1000),
    })
  }
  for (const p of payouts) {
    out.push({
      source: 'razorpay',
      sourceRef: p.id,
      direction: 'out',
      amount: p.amount / 100,
      currency: p.currency,
      method: p.method,
      status: p.status === 'processed' ? 'cleared' : p.status,
      referenceNo: p.utr ?? undefined,
      description: p.narration ?? p.id,
      paidAt: new Date(p.created_at * 1000),
    })
  }
  return out
}

// Re-export for adapters that build the auth header.
export { authHeader, RAZORPAY_BASE_URL }
