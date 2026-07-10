import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculatePurchaseTotals } from '@/lib/invoices/purchases'
import { graphEvents } from '@/lib/graph/live-update'

// GET /api/purchases — Fetch all Purchase Bills (vendor invoices)
// Returns an empty array when no purchase bills exist (real empty state — no mock data).
export async function GET() {
  try {
    const purchases = await db.purchaseBill.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { tradeName: true, gstin: true } },
      },
    })

    return NextResponse.json({ purchases: purchases ?? [] })
  } catch (error) {
    console.error('GET /api/purchases error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch purchase bills' },
      { status: 500 }
    )
  }
}

// POST /api/purchases — Record a new Purchase Bill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clientId,
      vendorName,
      vendorGstin,
      invoiceNo,
      invoiceDate,
      dueDate,
      taxableValue,
      cgstRate,
      sgstRate,
      igstRate,
      cess,
      category,
      hsnCode,
      notes,
    } = body ?? {}

    if (!vendorName || !invoiceNo || !invoiceDate || taxableValue === undefined) {
      return NextResponse.json(
        { error: 'vendorName, invoiceNo, invoiceDate and taxableValue are required' },
        { status: 400 }
      )
    }

    // Server-side computation of gst + total + balance
    const taxable = Number(taxableValue) || 0
    const totals = calculatePurchaseTotals(
      taxable,
      Number(cgstRate) || 0,
      Number(sgstRate) || 0,
      Number(igstRate) || 0
    )
    const cessVal = Number(cess) || 0
    const gstAmount = Math.round((totals.gstAmount + cessVal) * 100) / 100
    const totalAmount = Math.round((totals.totalAmount + cessVal) * 100) / 100

    const purchase = await db.purchaseBill.create({
      data: {
        clientId: clientId ?? null,
        vendorName,
        vendorGstin: vendorGstin ?? null,
        invoiceNo,
        invoiceDate,
        dueDate: dueDate ?? null,
        taxableValue: taxable,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        cess: cessVal,
        gstAmount,
        totalAmount,
        paidAmount: 0,
        balanceAmount: totalAmount,
        status: 'recorded',
        paymentStatus: 'unpaid',
        category: category ?? null,
        hsnCode: hsnCode ?? null,
        notes: notes ?? null,
        ocrExtracted: false,
      },
      include: {
        client: { select: { tradeName: true, gstin: true } },
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'Purchase Bill Recorded',
        entity: 'purchase_bill',
        entityId: purchase.id,
        details: `Vendor ${vendorName} invoice ${invoiceNo} recorded (₹${totalAmount})`,
      },
    })

    // ── Real Business Graph Engine™ — auto-create vendor node + ITC node + live events ──
    graphEvents.vendorCreated(purchase.id, vendorName)
    if (gstAmount > 0) {
      graphEvents.itcClaimed(purchase.id, gstAmount)
    }

    return NextResponse.json({ purchase }, { status: 201 })
  } catch (error) {
    console.error('POST /api/purchases error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create purchase bill' },
      { status: 500 }
    )
  }
}
