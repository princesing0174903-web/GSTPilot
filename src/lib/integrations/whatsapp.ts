// ═══════════════════════════════════════════════════════════════════════════════
// whatsapp.ts — WhatsApp Cloud API v18 adapter
//
// Provider: WhatsApp Cloud API (https://developers.facebook.com/docs/whatsapp/cloud-api)
// Endpoint: `https://graph.facebook.com/v18.0/{phone_number_id}/messages`
// Auth: System User access token (permanent) + verify token (for webhook)
//
// STATUS: PLACEHOLDER. Method signatures + types defined. Throws
// IntegrationNotConfiguredError without creds. Throws Error('WhatsApp
// adapter requires live Meta creds...') with creds but unwired API.
//
// To make this adapter live:
//   1. Create a Meta for Developers app + WhatsApp Business Cloud API.
//   2. Add a System User and generate a permanent access token.
//   3. Configure the webhook verify token + subscription.
//   4. Set env vars: WHATSAPP_APP_ID, WHATSAPP_APP_SECRET (for webhook sig).
//   5. Wire sendMessage() / sendTemplate() / markAsRead() to the Graph API.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  asCredentials,
  IntegrationNotConfiguredError,
  type ConnectionRecord,
  type DecryptedCredentials,
  type WhatsappCredentials,
  type ParsedWhatsAppMessage,
} from './types'
import { decryptCredentials, safeEqual } from './crypto'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface WhatsappMessageResponse {
  waMessageId: string
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
}

export interface WhatsappTemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters: Array<Record<string, unknown>>
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function loadCredentials(conn: ConnectionRecord): WhatsappCredentials {
  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError('whatsapp')
  }
  let raw: DecryptedCredentials
  try {
    raw = decryptCredentials(conn.credentialsEnc)
  } catch {
    throw new IntegrationNotConfiguredError(
      'whatsapp',
      'WhatsApp credentials are present but could not be decrypted. Re-configure the integration.',
    )
  }
  const creds = asCredentials('whatsapp', raw)
  if (!creds.phoneNumberId || !creds.accessToken) {
    throw new IntegrationNotConfiguredError(
      'whatsapp',
      'WhatsApp credentials are incomplete. Required: phoneNumberId, accessToken.',
    )
  }
  return creds
}

function requireMetaEnv(): { appSecret: string } {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    throw new Error(
      'WhatsApp adapter requires live Meta creds — configure WHATSAPP_APP_SECRET env var for webhook signature verification.',
    )
  }
  return { appSecret }
}

// ─── Public adapter methods ─────────────────────────────────────────────────────

/**
 * POST `https://graph.facebook.com/v18.0/{phoneNumberId}/messages`
 * with `{ messaging_product: 'whatsapp', to, type: 'text', text: { body } }`.
 */
export async function sendMessage(
  conn: ConnectionRecord,
  to: string,
  body: string,
): Promise<WhatsappMessageResponse> {
  const creds = loadCredentials(conn)
  void creds
  void to
  void body
  // TODO: const res = await fetch(`https://graph.facebook.com/v18.0/${creds.phoneNumberId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }) })
  throw new Error(
    'WhatsApp sendMessage() is not yet implemented. Wire the live POST to graph.facebook.com/v18.0/{phone_number_id}/messages.',
  )
}

/**
 * POST same endpoint with `{ type: 'template', template: { name, language: { code }, components } }`.
 */
export async function sendTemplate(
  conn: ConnectionRecord,
  to: string,
  templateName: string,
  language = 'en_US',
  components: WhatsappTemplateComponent[] = [],
): Promise<WhatsappMessageResponse> {
  const creds = loadCredentials(conn)
  void creds
  void to
  void templateName
  void language
  void components
  throw new Error(
    'WhatsApp sendTemplate() is not yet implemented. Wire the live POST with type=template.',
  )
}

/**
 * POST `.../messages` with `{ messaging_product: 'whatsapp', status: 'read', message_id }`.
 */
export async function markAsRead(
  conn: ConnectionRecord,
  messageId: string,
): Promise<void> {
  const creds = loadCredentials(conn)
  void creds
  void messageId
  throw new Error(
    'WhatsApp markAsRead() is not yet implemented. Wire the live POST with status=read.',
  )
}

/**
 * Webhook verification handshake — Meta GETs the webhook URL with
 * `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. We compare the
 * verify token against the stored one and return the challenge.
 *
 * Returns the challenge string if verification succeeds, null otherwise.
 */
export function verifyWebhook(
  conn: ConnectionRecord,
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined,
): string | null {
  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError('whatsapp')
  }
  let raw: DecryptedCredentials
  try {
    raw = decryptCredentials(conn.credentialsEnc)
  } catch {
    throw new IntegrationNotConfiguredError(
      'whatsapp',
      'WhatsApp credentials are present but could not be decrypted.',
    )
  }
  const creds = asCredentials('whatsapp', raw)
  if (!creds.verifyToken) {
    throw new IntegrationNotConfiguredError(
      'whatsapp',
      'WhatsApp webhook verify token is not configured.',
    )
  }
  if (mode !== 'subscribe' || !token || !challenge) return null
  if (!safeEqual(token, creds.verifyToken)) return null
  return challenge
}

/**
 * Parse an inbound webhook payload into ParsedWhatsAppMessage rows for
 * upsert. Webhook payloads have shape:
 *   `{ entry: [{ changes: [{ value: { messages: [{ from, id, text: { body }, timestamp }] }] }] }`
 */
export function parseWebhookPayload(
  payload: unknown,
): ParsedWhatsAppMessage[] {
  if (!payload || typeof payload !== 'object') return []
  const entry = (payload as { entry?: unknown }).entry
  if (!Array.isArray(entry)) return []
  const out: ParsedWhatsAppMessage[] = []
  for (const e of entry) {
    const changes = (e as { changes?: unknown }).changes
    if (!Array.isArray(changes)) continue
    for (const c of changes) {
      const value = (c as { value?: unknown }).value
      if (!value || typeof value !== 'object') continue
      const messages = (value as { messages?: unknown }).messages
      if (!Array.isArray(messages)) continue
      for (const m of messages) {
        const msg = m as {
          id?: string
          from?: string
          timestamp?: string
          text?: { body?: string }
        }
        out.push({
          direction: 'in',
          fromPhone: msg.from,
          waMessageId: msg.id,
          body: msg.text?.body ?? '',
          receivedAt: msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000)
            : new Date(),
          rawPayload: m,
        })
      }
    }
  }
  return out
}
