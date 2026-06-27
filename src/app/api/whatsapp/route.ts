import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  seedWhatsAppMessages,
  getWhatsAppStats,
} from '@/lib/communication/whatsapp'
import { graphEvents } from '@/lib/graph/live-update'
import type {
  WhatsAppMessage,
  WhatsAppCategory,
  CommunicationEventType,
} from '@/lib/communication/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a WhatsApp message category to a CommunicationEventType for the
 * CommunicationLog audit trail.
 */
function categoryToEventType(category: string): CommunicationEventType {
  switch (category) {
    case 'invoice':
      return 'payment_received'
    case 'reminder':
      return 'invoice_due'
    case 'gst_notice':
      return 'gst_deadline'
    case 'collection':
      return 'overdue'
    case 'report':
      return 'report_delivery'
    case 'payslip':
      return 'payroll'
    case 'otp':
      return 'otp'
    default:
      return 'escalation'
  }
}

/** Normalise a Prisma WhatsAppMessage row into the WhatsAppMessage engine type. */
function mapRow(row: {
  id: string
  clientId: string | null
  recipientName: string | null
  recipientPhone: string
  templateName: string | null
  messageType: string
  messageBody: string
  mediaUrl: string | null
  caption: string | null
  category: string
  status: string
  errorMessage: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
}): WhatsAppMessage {
  return {
    id: row.id,
    clientId: row.clientId,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    templateName: row.templateName,
    messageType: row.messageType,
    messageBody: row.messageBody,
    mediaUrl: row.mediaUrl,
    caption: row.caption,
    category: row.category as WhatsAppCategory,
    status: row.status as WhatsAppMessage['status'],
    errorMessage: row.errorMessage,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ─── GET /api/whatsapp ────────────────────────────────────────────────────────
// Fetch WhatsApp messages from DB (orderBy createdAt desc). Falls back to
// seedWhatsAppMessages() when the DB is empty. Returns { messages, stats }.
export async function GET() {
  try {
    const rows = await db.whatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const messages: WhatsAppMessage[] =
      rows && rows.length > 0 ? rows.map(mapRow) : seedWhatsAppMessages()

    const stats = getWhatsAppStats(messages)

    return NextResponse.json({ messages, stats })
  } catch (error) {
    console.error('GET /api/whatsapp error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch WhatsApp messages' },
      { status: 500 }
    )
  }
}

// ─── POST /api/whatsapp ───────────────────────────────────────────────────────
// Send a WhatsApp message. Body:
//   { recipientPhone, recipientName?, clientId?, templateName?,
//     messageBody, category?, messageType? }
// Creates a whatsappMessage (status='sent', sentAt=now), a communicationLog
// (channel='whatsapp', triggerSource='manual'), and an auditLog entry.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      recipientPhone,
      recipientName,
      clientId,
      templateName,
      messageBody,
      category,
      messageType,
    } = body ?? {}

    if (!recipientPhone || !messageBody) {
      return NextResponse.json(
        { error: 'recipientPhone and messageBody are required' },
        { status: 400 }
      )
    }

    const now = new Date()
    const finalCategory = (category ?? 'general') as WhatsAppCategory

    // 1. Create the WhatsApp message record
    const message = await db.whatsAppMessage.create({
      data: {
        clientId: clientId ?? null,
        recipientName: recipientName ?? null,
        recipientPhone: String(recipientPhone),
        templateName: templateName ?? null,
        messageType: messageType ?? 'text',
        messageBody: String(messageBody),
        mediaUrl: null,
        caption: null,
        category: finalCategory,
        status: 'sent',
        errorMessage: null,
        sentAt: now,
        deliveredAt: null,
        readAt: null,
      },
    })

    // 2. Create a CommunicationLog audit-trail entry
    const eventType = categoryToEventType(finalCategory)
    const messagePreview = String(messageBody).slice(0, 200)
    await db.communicationLog.create({
      data: {
        clientId: clientId ?? null,
        channel: 'whatsapp',
        eventType,
        recipient: String(recipientPhone),
        recipientName: recipientName ?? null,
        templateName: templateName ?? null,
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
        action: 'WhatsApp Message Sent',
        entity: 'whatsapp_message',
        entityId: message.id,
        details: `WhatsApp message sent to ${recipientPhone} (${finalCategory}) — ${messagePreview.slice(0, 80)}`,
      },
    })

    // ── Real Business Graph Engine™ — live event: WhatsApp sent ──
    graphEvents.whatsappSent(message.id, String(recipientPhone), String(messageBody))

    return NextResponse.json({ message: mapRow(message) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/whatsapp error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send WhatsApp message' },
      { status: 500 }
    )
  }
}
