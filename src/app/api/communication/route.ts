import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { InvoiceCloudInvoice } from '@/lib/invoices/types'
import {
  AI_ENGINE_STAGES,
  RECOVERY_STAGES,
  detectEvents,
  runCollectionRecovery,
  getAiEngineStats,
} from '@/lib/communication/ai-engine'
import {
  REPORT_TYPES,
  getReportStats,
} from '@/lib/communication/reports'
import {
  getWhatsAppStats,
} from '@/lib/communication/whatsapp'
import {
  getEmailStats,
} from '@/lib/communication/email'
import {
  getSMSStats,
} from '@/lib/communication/sms'
import {
  getNotificationStats,
} from '@/lib/communication/notifications'
import type {
  CommunicationLog,
  CommunicationEventType,
  LogStatus,
  CommunicationChannel,
  TriggerSource,
} from '@/lib/communication/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a Prisma CommunicationLog row to the CommunicationLog engine type. */
function mapLogRow(row: {
  id: string
  clientId: string | null
  channel: string
  eventType: string
  recipient: string
  recipientName: string | null
  templateName: string | null
  messagePreview: string
  status: string
  triggerSource: string
  metadata: string | null
  createdAt: Date
}): CommunicationLog {
  return {
    id: row.id,
    clientId: row.clientId,
    channel: row.channel as CommunicationChannel,
    eventType: row.eventType as CommunicationEventType,
    recipient: row.recipient,
    recipientName: row.recipientName,
    templateName: row.templateName,
    messagePreview: row.messagePreview,
    status: row.status as LogStatus,
    triggerSource: row.triggerSource as TriggerSource,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Normalise DB invoice rows into the InvoiceCloudInvoice shape expected by
 * the collection recovery engine. Mirrors the mapping in
 * /api/receivables/route.ts exactly (the engine layer is the same).
 */
function mapInvoiceRow(r: {
  id: string
  clientId: string
  invoiceNumber: string
  invoiceDate: string
  sellerGstin: string
  buyerGstin: string | null
  buyerName: string | null
  invoiceType: string
  gstr1Section: string
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  totalAmount: number
  hsnCode: string | null
  reverseCharge: boolean
  status: string
  matchStatus: string
  riskLevel: string
  riskScore: number
  aiExplanation: string | null
  notes: string | null
  period: string | null
  assignedTo: string | null
  createdAt: Date
  updatedAt: Date
  dueDate: string | null
  gstAmount: number
  paidAmount: number
  balanceAmount: number
  paymentStatus: string
  paymentMode: string | null
  paymentDate: string | null
  recurring: boolean
  recurringCycle: string | null
  notesFinance: string | null
  sentToCustomer: boolean
  sentAt: Date | null
}): InvoiceCloudInvoice {
  return {
    id: r.id,
    clientId: r.clientId,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    sellerGstin: r.sellerGstin,
    buyerGstin: r.buyerGstin ?? null,
    buyerName: r.buyerName ?? null,
    invoiceType: r.invoiceType,
    gstr1Section: r.gstr1Section,
    taxableValue: r.taxableValue,
    cgst: r.cgst,
    sgst: r.sgst,
    igst: r.igst,
    cess: r.cess,
    totalAmount: r.totalAmount,
    hsnCode: r.hsnCode ?? null,
    reverseCharge: r.reverseCharge,
    status: r.status,
    matchStatus: r.matchStatus,
    riskLevel: r.riskLevel,
    riskScore: r.riskScore,
    aiExplanation: r.aiExplanation ?? null,
    notes: r.notes ?? null,
    period: r.period ?? null,
    assignedTo: r.assignedTo ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    dueDate: r.dueDate ?? null,
    gstAmount: r.gstAmount,
    paidAmount: r.paidAmount,
    balanceAmount: r.balanceAmount,
    paymentStatus: r.paymentStatus,
    paymentMode: r.paymentMode ?? null,
    paymentDate: r.paymentDate ?? null,
    recurring: r.recurring,
    recurringCycle: r.recurringCycle ?? null,
    notesFinance: r.notesFinance ?? null,
    sentToCustomer: r.sentToCustomer,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
  }
}

// ─── GET /api/communication ───────────────────────────────────────────────────
// The flagship aggregation endpoint for the Communication Cloud™.
// Pulls together AI Engine stats, Collection Recovery pipeline, Report
// Distribution, channel summary, recent activity, and live event detection
// into a single dashboard payload.
export async function GET() {
  try {
    // ── 1. AI Engine logs + stats ────────────────────────────────────────────
    const logRows = await db.communicationLog.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const logs: CommunicationLog[] = (logRows ?? []).map(mapLogRow)

    const aiStats = getAiEngineStats(logs)
    const recentLogs = logs.slice(0, 10)

    // ── 2. Collection Recovery ───────────────────────────────────────────────
    const invoiceRows = await db.invoice.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const invoices: InvoiceCloudInvoice[] = (invoiceRows ?? []).map(mapInvoiceRow)

    const recovery = runCollectionRecovery(invoices)

    // ── 3. Report Distribution ───────────────────────────────────────────────
    // No ReportDistribution Prisma model — return real empty state (no mock data).
    const distributions: Parameters<typeof getReportStats>[0] = []
    const reportStats = getReportStats(distributions)

    // ── 4. Channel summary ───────────────────────────────────────────────────
    // Aggregate counts + delivery stats across all 4 channels. When a DB
    // table is empty the stats reflect a real empty state (no mock data).
    const [waRows, emRows, smsRows, notifRows] = await Promise.all([
      db.whatsAppMessage.findMany({ orderBy: { createdAt: 'desc' } }),
      db.emailMessage.findMany({ orderBy: { createdAt: 'desc' } }),
      db.sMSMessage.findMany({ orderBy: { createdAt: 'desc' } }),
      db.notification.findMany({
        where: { dismissed: false },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const whatsappStats = getWhatsAppStats(
      (waRows ?? []).map((r) => ({
            id: r.id,
            clientId: r.clientId,
            recipientName: r.recipientName,
            recipientPhone: r.recipientPhone,
            templateName: r.templateName,
            messageType: r.messageType,
            messageBody: r.messageBody,
            mediaUrl: r.mediaUrl,
            caption: r.caption,
            category: r.category as Parameters<typeof getWhatsAppStats>[0][number]['category'],
            status: r.status as Parameters<typeof getWhatsAppStats>[0][number]['status'],
            errorMessage: r.errorMessage,
            sentAt: r.sentAt ? r.sentAt.toISOString() : null,
            deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
            readAt: r.readAt ? r.readAt.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          }))
    )

    const emailStats = getEmailStats(
      (emRows ?? []).map((r) => ({
            id: r.id,
            clientId: r.clientId,
            recipientName: r.recipientName,
            recipientEmail: r.recipientEmail,
            templateName: r.templateName,
            subject: r.subject,
            bodyHtml: r.bodyHtml,
            bodyText: r.bodyText,
            category: r.category as Parameters<typeof getEmailStats>[0][number]['category'],
            attachments: r.attachments,
            status: r.status as Parameters<typeof getEmailStats>[0][number]['status'],
            errorMessage: r.errorMessage,
            sentAt: r.sentAt ? r.sentAt.toISOString() : null,
            deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
            openedAt: r.openedAt ? r.openedAt.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          }))
    )

    const smsStats = getSMSStats(
      (smsRows ?? []).map((r) => ({
            id: r.id,
            clientId: r.clientId,
            recipientName: r.recipientName,
            recipientPhone: r.recipientPhone,
            message: r.message,
            category: r.category as Parameters<typeof getSMSStats>[0][number]['category'],
            status: r.status as Parameters<typeof getSMSStats>[0][number]['status'],
            errorMessage: r.errorMessage,
            sentAt: r.sentAt ? r.sentAt.toISOString() : null,
            deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          }))
    )

    const notificationStats = getNotificationStats(
      (notifRows ?? []).map((r) => ({
              id: r.id,
              userId: r.userId,
              clientId: r.clientId,
              type: r.type as Parameters<typeof getNotificationStats>[0][number]['type'],
              category: r.category,
              title: r.title,
              message: r.message,
              actionUrl: r.actionUrl,
              isRead: r.isRead,
              priority: r.priority as Parameters<typeof getNotificationStats>[0][number]['priority'],
              dismissed: r.dismissed,
              scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
              sentAt: r.sentAt ? r.sentAt.toISOString() : null,
              readAt: r.readAt ? r.readAt.toISOString() : null,
              createdAt: r.createdAt.toISOString(),
              updatedAt: r.updatedAt.toISOString(),
            }))
    )

    const channelSummary = {
      whatsapp: whatsappStats,
      email: emailStats,
      sms: smsStats,
      notifications: notificationStats,
    }

    // ── 5. Detected events (live event detection) ───────────────────────────
    const detectedEvents = detectEvents({ invoices })

    // ── 6. AI Engine stages (from the engine export) ─────────────────────────
    const stages = AI_ENGINE_STAGES.map((stage) => ({
      stage,
      label: stage
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
    }))

    return NextResponse.json({
      aiEngine: {
        stats: aiStats,
        stages,
        recentLogs,
      },
      collectionRecovery: {
        summary: recovery.summary,
        pipeline: recovery.pipeline,
        recoveredAmount: recovery.recoveredAmount,
        escalatedCount: recovery.escalatedCount,
      },
      reportDistribution: {
        distributions,
        stats: reportStats,
        reportTypes: REPORT_TYPES,
      },
      channelSummary,
      detectedEvents,
      recoveryStages: RECOVERY_STAGES,
    })
  } catch (error) {
    console.error('GET /api/communication error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to aggregate communication data' },
      { status: 500 }
    )
  }
}
