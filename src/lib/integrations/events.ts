// ═══════════════════════════════════════════════════════════════════════════════
// events.ts — EventStream helpers for the Sync Engine™
//
// Every time the Sync Engine pulls new data from a connected system, it writes
// an EventStream row here. Oracle reads these events to build a continuous
// understanding of the business ("Payment Received", "GST Filed", "Notice
// Received", etc.).
//
// Events are the bridge between raw data sync and Oracle's intelligence:
//   sync adapter pulls data → writes domain rows → writes EventStream rows
//   → Oracle reads EventStream to understand what changed
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'

export type EventType =
  | 'invoice_created'
  | 'payment_received'
  | 'payment_sent'
  | 'gst_filed'
  | 'notice_received'
  | 'expense_added'
  | 'bank_transaction'
  | 'email_received'
  | 'document_synced'
  | 'whatsapp_message'
  | 'sync_completed'
  | 'sync_failed'
  | 'connector_connected'
  | 'connector_disconnected'

export type EventSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface CreateEventInput {
  type: EventType
  source: string // provider key: 'gstn' | 'hdfc' | 'gmail' | 'razorpay' | ...
  title: string
  clientId?: string
  invoiceId?: string
  paymentId?: string
  noticeId?: string
  returnId?: string
  payload?: Record<string, unknown>
  severity?: EventSeverity
}

/**
 * Write a single business event to the EventStream. Fire-and-forget — the
 * caller should `await` only if it needs the event id.
 */
export async function writeEvent(input: CreateEventInput): Promise<string> {
  try {
    const event = await db.eventStream.create({
      data: {
        type: input.type,
        source: input.source,
        title: input.title,
        clientId: input.clientId ?? null,
        invoiceId: input.invoiceId ?? null,
        paymentId: input.paymentId ?? null,
        noticeId: input.noticeId ?? null,
        returnId: input.returnId ?? null,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        severity: input.severity ?? 'info',
      },
    })
    return event.id
  } catch (err) {
    // Event writing must never break a sync run — log and continue.
    console.error('[events] Failed to write event:', err)
    return ''
  }
}

/**
 * Write multiple events in a single DB call. Used when a sync pulls many
 * records at once (e.g. 50 bank transactions).
 */
export async function writeEvents(inputs: CreateEventInput[]): Promise<number> {
  if (inputs.length === 0) return 0
  try {
    const result = await db.eventStream.createMany({
      data: inputs.map((input) => ({
        type: input.type,
        source: input.source,
        title: input.title,
        clientId: input.clientId ?? null,
        invoiceId: input.invoiceId ?? null,
        paymentId: input.paymentId ?? null,
        noticeId: input.noticeId ?? null,
        returnId: input.returnId ?? null,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        severity: input.severity ?? 'info',
      })),
    })
    return result.count
  } catch (err) {
    console.error('[events] Failed to batch-write events:', err)
    return 0
  }
}

/**
 * List recent events, most-recent first. Used by the Finance page's event feed
 * and by Oracle to understand what changed recently.
 */
export async function listEvents(
  limit = 50,
  filter?: { source?: string; type?: string; severity?: string }
): Promise<Array<{
  id: string
  type: string
  source: string
  title: string
  severity: string
  clientId: string | null
  payload: string | null
  processed: boolean
  createdAt: Date
}>> {
  return db.eventStream.findMany({
    where: {
      ...(filter?.source ? { source: filter.source } : {}),
      ...(filter?.type ? { type: filter.type } : {}),
      ...(filter?.severity ? { severity: filter.severity } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    select: {
      id: true,
      type: true,
      source: true,
      title: true,
      severity: true,
      clientId: true,
      payload: true,
      processed: true,
      createdAt: true,
    },
  })
}
