import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  seedEmailMessages,
  getEmailStats,
} from '@/lib/communication/email'
import { graphEvents } from '@/lib/graph/live-update'
import type {
  EmailMessage,
  EmailCategory,
  CommunicationEventType,
} from '@/lib/communication/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map an email category to a CommunicationEventType for the CommunicationLog
 * audit trail.
 */
function categoryToEventType(category: string): CommunicationEventType {
  switch (category) {
    case 'invoice':
      return 'invoice_due'
    case 'gst_notice':
      return 'gst_deadline'
    case 'collection':
      return 'overdue'
    case 'report':
      return 'report_delivery'
    case 'payslip':
      return 'payroll'
    case 'forecast':
      return 'cash_shortage'
    default:
      return 'escalation'
  }
}

/** Normalise a Prisma EmailMessage row into the EmailMessage engine type. */
function mapRow(row: {
  id: string
  clientId: string | null
  recipientName: string | null
  recipientEmail: string
  templateName: string | null
  subject: string
  bodyHtml: string
  bodyText: string | null
  category: string
  attachments: string | null
  status: string
  errorMessage: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  openedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): EmailMessage {
  return {
    id: row.id,
    clientId: row.clientId,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    templateName: row.templateName,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    category: row.category as EmailCategory,
    attachments: row.attachments,
    status: row.status as EmailMessage['status'],
    errorMessage: row.errorMessage,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    openedAt: row.openedAt ? row.openedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ─── GET /api/email ───────────────────────────────────────────────────────────
// Fetch emails from DB (orderBy createdAt desc). Falls back to seedEmailMessages()
// when the DB is empty. Returns { messages, stats }.
export async function GET() {
  try {
    const rows = await db.emailMessage.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const messages: EmailMessage[] =
      rows && rows.length > 0 ? rows.map(mapRow) : seedEmailMessages()

    const stats = getEmailStats(messages)

    return NextResponse.json({ messages, stats })
  } catch (error) {
    console.error('GET /api/email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}

// ─── POST /api/email ──────────────────────────────────────────────────────────
// Send an email. Body:
//   { recipientEmail, recipientName?, clientId?, templateName?,
//     subject, bodyHtml, bodyText?, category?, attachments? }
// Creates an emailMessage (status='sent', sentAt=now), a communicationLog
// (channel='email', triggerSource='manual'), and an auditLog entry.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      recipientEmail,
      recipientName,
      clientId,
      templateName,
      subject,
      bodyHtml,
      bodyText,
      category,
      attachments,
    } = body ?? {}

    if (!recipientEmail || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: 'recipientEmail, subject and bodyHtml are required' },
        { status: 400 }
      )
    }

    const now = new Date()
    const finalCategory = (category ?? 'general') as EmailCategory

    // 1. Create the Email message record
    const message = await db.emailMessage.create({
      data: {
        clientId: clientId ?? null,
        recipientName: recipientName ?? null,
        recipientEmail: String(recipientEmail),
        templateName: templateName ?? null,
        subject: String(subject),
        bodyHtml: String(bodyHtml),
        bodyText: bodyText ?? null,
        category: finalCategory,
        attachments:
          typeof attachments === 'string'
            ? attachments
            : attachments
              ? JSON.stringify(attachments)
              : null,
        status: 'sent',
        errorMessage: null,
        sentAt: now,
        deliveredAt: null,
        openedAt: null,
      },
    })

    // 2. Create a CommunicationLog audit-trail entry
    const eventType = categoryToEventType(finalCategory)
    const messagePreview = String(bodyText ?? subject).slice(0, 200)
    await db.communicationLog.create({
      data: {
        clientId: clientId ?? null,
        channel: 'email',
        eventType,
        recipient: String(recipientEmail),
        recipientName: recipientName ?? null,
        templateName: templateName ?? null,
        messagePreview,
        status: 'sent',
        triggerSource: 'manual',
        metadata: JSON.stringify({ category: finalCategory, subject }),
      },
    })

    // 3. Audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'Email Sent',
        entity: 'email_message',
        entityId: message.id,
        details: `Email sent to ${recipientEmail} — subject: "${subject}" (${finalCategory})`,
      },
    })

    // ── Real Business Graph Engine™ — live event: email sent ──
    graphEvents.emailSent(message.id, String(recipientEmail), String(subject))

    return NextResponse.json({ message: mapRow(message) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}
