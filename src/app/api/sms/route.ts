import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  seedSMSMessages,
  getSMSStats,
} from '@/lib/communication/sms'
import type {
  SMSMessage,
  SMSCategory,
  CommunicationEventType,
} from '@/lib/communication/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map an SMS category to a CommunicationEventType for the CommunicationLog
 * audit trail.
 */
function categoryToEventType(category: string): CommunicationEventType {
  switch (category) {
    case 'otp':
      return 'otp'
    case 'gst_alert':
      return 'gst_deadline'
    case 'payment_reminder':
      return 'invoice_due'
    case 'due_date':
      return 'invoice_due'
    case 'collection':
      return 'overdue'
    default:
      return 'escalation'
  }
}

/** Normalise a Prisma SMSMessage row into the SMSMessage engine type. */
function mapRow(row: {
  id: string
  clientId: string | null
  recipientName: string | null
  recipientPhone: string
  message: string
  category: string
  status: string
  errorMessage: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}): SMSMessage {
  return {
    id: row.id,
    clientId: row.clientId,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    message: row.message,
    category: row.category as SMSCategory,
    status: row.status as SMSMessage['status'],
    errorMessage: row.errorMessage,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ─── GET /api/sms ─────────────────────────────────────────────────────────────
// Fetch SMS messages from DB (orderBy createdAt desc). Falls back to
// seedSMSMessages() when the DB is empty. Returns { messages, stats }.
export async function GET() {
  try {
    const rows = await db.sMSMessage.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const messages: SMSMessage[] =
      rows && rows.length > 0 ? rows.map(mapRow) : seedSMSMessages()

    const stats = getSMSStats(messages)

    return NextResponse.json({ messages, stats })
  } catch (error) {
    console.error('GET /api/sms error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch SMS messages' },
      { status: 500 }
    )
  }
}

// ─── POST /api/sms ────────────────────────────────────────────────────────────
// Send an SMS. Body:
//   { recipientPhone, recipientName?, clientId?, message, category? }
// Creates an sMSMessage (status='sent', sentAt=now), a communicationLog
// (channel='sms', triggerSource='manual'), and an auditLog entry.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      recipientPhone,
      recipientName,
      clientId,
      message,
      category,
    } = body ?? {}

    if (!recipientPhone || !message) {
      return NextResponse.json(
        { error: 'recipientPhone and message are required' },
        { status: 400 }
      )
    }

    const now = new Date()
    const finalCategory = (category ?? 'general') as SMSCategory

    // 1. Create the SMS message record
    const smsMessage = await db.sMSMessage.create({
      data: {
        clientId: clientId ?? null,
        recipientName: recipientName ?? null,
        recipientPhone: String(recipientPhone),
        message: String(message),
        category: finalCategory,
        status: 'sent',
        errorMessage: null,
        sentAt: now,
        deliveredAt: null,
      },
    })

    // 2. Create a CommunicationLog audit-trail entry
    const eventType = categoryToEventType(finalCategory)
    const messagePreview = String(message).slice(0, 200)
    await db.communicationLog.create({
      data: {
        clientId: clientId ?? null,
        channel: 'sms',
        eventType,
        recipient: String(recipientPhone),
        recipientName: recipientName ?? null,
        templateName: null,
        messagePreview,
        status: 'sent',
        triggerSource: 'manual',
        metadata: JSON.stringify({ category: finalCategory }),
      },
    })

    // 3. Audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'SMS Sent',
        entity: 'sms_message',
        entityId: smsMessage.id,
        details: `SMS sent to ${recipientPhone} (${finalCategory}) — ${messagePreview.slice(0, 80)}`,
      },
    })

    return NextResponse.json({ message: mapRow(smsMessage) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/sms error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send SMS' },
      { status: 500 }
    )
  }
}
