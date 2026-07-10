import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getPayablesSummary,
  dueThisWeek,
  dueNextWeek,
  prioritizePayments,
  cashAllocationPlan,
} from '@/lib/invoices/payables'
import type { PurchaseBill } from '@/lib/invoices/types'

// GET /api/payables — Payables Engine™ aggregation endpoint
// Returns: summary (total payable, overdue, due this/next week),
// supplier aging, payment priorities, cash allocation plan, and
// upcoming supplier payments. Returns real empty state when the DB is empty
// (no mock data).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const availableCashParam = searchParams.get('availableCash')
    const availableCash = availableCashParam ? Number(availableCashParam) : 500000

    const rows = await db.purchaseBill.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { tradeName: true, gstin: true } } },
    })

    // Normalise DB rows into the PurchaseBill shape expected by the payables
    // engine. The PurchaseBill model carries dueDate, gstAmount, paidAmount,
    // balanceAmount, paymentStatus, etc.
    const bills: PurchaseBill[] = (rows ?? []).map((r) => ({
      id: r.id,
      clientId: r.clientId ?? null,
      vendorName: r.vendorName,
      vendorGstin: r.vendorGstin ?? null,
      invoiceNo: r.invoiceNo,
      invoiceDate: r.invoiceDate,
      dueDate: r.dueDate ?? null,
      taxableValue: r.taxableValue,
      cgst: r.cgst,
      sgst: r.sgst,
      igst: r.igst,
      cess: r.cess,
      gstAmount: r.gstAmount,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      balanceAmount: r.balanceAmount,
      status: r.status,
      paymentStatus: r.paymentStatus,
      category: r.category ?? null,
      hsnCode: r.hsnCode ?? null,
      notes: r.notes ?? null,
      ocrExtracted: r.ocrExtracted,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))

    const summary = getPayablesSummary(bills)
    const thisWeek = dueThisWeek(bills)
    const nextWeek = dueNextWeek(bills)
    const priorities = prioritizePayments(bills)
    const allocation = cashAllocationPlan(bills, availableCash)

    // Supplier aging — group outstanding balance by vendor
    const supplierMap = new Map<string, { vendor: string; amount: number; count: number; oldestDue: string | null }>()
    for (const b of bills) {
      if (b.balanceAmount <= 0) continue
      const key = b.vendorName
      const entry = supplierMap.get(key) ?? { vendor: b.vendorName, amount: 0, count: 0, oldestDue: null }
      entry.amount += b.balanceAmount
      entry.count += 1
      if (b.dueDate && (!entry.oldestDue || b.dueDate < entry.oldestDue)) {
        entry.oldestDue = b.dueDate
      }
      supplierMap.set(key, entry)
    }
    const supplierAging = [...supplierMap.values()]
      .map((e) => ({
        ...e,
        amount: Math.round(e.amount * 100) / 100,
        daysOverdue: e.oldestDue
          ? Math.max(0, Math.floor((Date.now() - new Date(e.oldestDue).getTime()) / 86400000))
          : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Upcoming payables — next 14 days, sorted by due date
    const upcoming = bills
      .filter((b) => {
        if (!b.dueDate || b.balanceAmount <= 0) return false
        const due = new Date(b.dueDate).getTime()
        const now = Date.now()
        const horizon = now + 14 * 86400000
        return due >= now && due <= horizon
      })
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
      .slice(0, 15)
      .map((b) => ({
        id: b.id,
        vendorName: b.vendorName,
        invoiceNo: b.invoiceNo,
        dueDate: b.dueDate,
        balanceAmount: b.balanceAmount,
        paymentStatus: b.paymentStatus,
        daysToDue: b.dueDate
          ? Math.ceil((new Date(b.dueDate).getTime() - Date.now()) / 86400000)
          : 0,
      }))

    return NextResponse.json({
      summary,
      supplierAging,
      upcoming,
      dueThisWeek: thisWeek.map((b) => ({
        id: b.id,
        vendorName: b.vendorName,
        invoiceNo: b.invoiceNo,
        dueDate: b.dueDate,
        balanceAmount: b.balanceAmount,
      })),
      dueNextWeekCount: nextWeek.length,
      dueNextWeekAmount: nextWeek.reduce((s, b) => s + b.balanceAmount, 0),
      priorities: priorities.slice(0, 15),
      cashAllocation: allocation,
      availableCash,
      totalBills: bills.length,
    })
  } catch (error) {
    console.error('GET /api/payables error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute payables' },
      { status: 500 }
    )
  }
}
