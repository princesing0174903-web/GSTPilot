import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  computeAging,
  getReceivablesSummary,
  detectOverdue,
  scheduleReminders,
  forecastCollections,
} from '@/lib/invoices/receivables'
import type { InvoiceCloudInvoice } from '@/lib/invoices/types'

// GET /api/receivables — Receivables Engine™ aggregation endpoint
// Returns: summary (outstanding, overdue, collection rate, DSO, forecast),
// aging buckets, overdue invoices, reminder schedule, collection forecast,
// and top defaulters. Returns real empty state when the DB is empty (no mock data).
export async function GET() {
  try {
    const rows = await db.invoice.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Normalise DB rows into the InvoiceCloudInvoice shape expected by the
    // receivables engine. The Invoice model carries the Invoice Cloud™
    // financial fields (dueDate, gstAmount, paidAmount, balanceAmount,
    // paymentStatus, recurring, etc.) so the mapping is direct.
    const invoices: InvoiceCloudInvoice[] = (rows ?? []).map((r) => ({
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
    }))

    const summary = getReceivablesSummary(invoices)
    const aging = computeAging(invoices)
    const overdue = detectOverdue(invoices)
    const reminders = scheduleReminders(invoices)
    const collectionForecast = forecastCollections(invoices)

    // Top defaulters — outstanding balance descending, top 10
    const topDefaulters = [...invoices]
      .filter((i) => i.balanceAmount > 0 && i.status !== 'cancelled' && i.status !== 'draft')
      .sort((a, b) => b.balanceAmount - a.balanceAmount)
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        buyerName: i.buyerName ?? 'Unknown',
        balanceAmount: i.balanceAmount,
        dueDate: i.dueDate ?? null,
        paymentStatus: i.paymentStatus,
        daysOverdue: i.dueDate
          ? Math.max(0, Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000))
          : 0,
      }))

    return NextResponse.json({
      summary,
      aging,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + i.balanceAmount, 0),
      reminders,
      collectionForecast,
      topDefaulters,
      totalInvoices: invoices.length,
    })
  } catch (error) {
    console.error('GET /api/receivables error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute receivables' },
      { status: 500 }
    )
  }
}
