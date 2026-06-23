import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedPayments } from '@/lib/invoices/payments'

// GET /api/payments — Fetch all Payments (customer collections + vendor settlements)
export async function GET() {
  try {
    const payments = await db.payment.findMany({
      orderBy: { paymentDate: 'desc' },
    })

    if (!payments || payments.length === 0) {
      return NextResponse.json({ payments: seedPayments() })
    }

    return NextResponse.json({ payments })
  } catch (error) {
    console.error('GET /api/payments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

// POST /api/payments — Record a new payment and reconcile against an invoice
// or purchase bill when one is referenced.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clientId,
      partyName,
      partyType,
      amount,
      paymentDate,
      paymentMode,
      referenceNo,
      invoiceId,
      purchaseBillId,
      notes,
    } = body ?? {}

    if (!partyName || !partyType || amount === undefined || !paymentDate || !paymentMode) {
      return NextResponse.json(
        { error: 'partyName, partyType, amount, paymentDate and paymentMode are required' },
        { status: 400 }
      )
    }

    const paymentAmount = Number(amount) || 0

    // Create the payment record
    const payment = await db.payment.create({
      data: {
        clientId: clientId ?? null,
        invoiceId: invoiceId ?? null,
        purchaseBillId: purchaseBillId ?? null,
        partyName,
        partyType,
        amount: paymentAmount,
        paymentDate,
        paymentMode,
        referenceNo: referenceNo ?? null,
        status: 'completed',
        reconciled: false,
        notes: notes ?? null,
      },
    })

    // If invoiceId provided — recompute Invoice paidAmount + balanceAmount + paymentStatus
    if (invoiceId) {
      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
      if (invoice) {
        const newPaid = (invoice.paidAmount ?? 0) + paymentAmount
        const total = invoice.totalAmount ?? 0
        const balance = Math.max(0, total - newPaid)
        let paymentStatus = 'unpaid'
        if (balance <= 0) paymentStatus = 'paid'
        else if (newPaid > 0) paymentStatus = 'partial'
        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaid,
            balanceAmount: balance,
            paymentStatus,
            paymentDate: paymentStatus === 'paid' ? paymentDate : invoice.paymentDate,
            paymentMode: paymentMode ?? invoice.paymentMode,
          },
        })
      }
    }

    // If purchaseBillId provided — recompute PurchaseBill similarly
    if (purchaseBillId) {
      const bill = await db.purchaseBill.findUnique({ where: { id: purchaseBillId } })
      if (bill) {
        const newPaid = (bill.paidAmount ?? 0) + paymentAmount
        const total = bill.totalAmount ?? 0
        const balance = Math.max(0, total - newPaid)
        let paymentStatus = 'unpaid'
        let status = bill.status
        if (balance <= 0) {
          paymentStatus = 'paid'
          status = 'paid'
        } else if (newPaid > 0) {
          paymentStatus = 'partial'
          status = 'partial'
        }
        await db.purchaseBill.update({
          where: { id: purchaseBillId },
          data: {
            paidAmount: newPaid,
            balanceAmount: balance,
            paymentStatus,
            status,
          },
        })
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'Payment Recorded',
        entity: 'payment',
        entityId: payment.id,
        details: `${partyType === 'vendor' ? 'Vendor' : 'Customer'} payment ₹${paymentAmount} — ${partyName}${invoiceId ? ` (invoice ${invoiceId})` : ''}${purchaseBillId ? ` (bill ${purchaseBillId})` : ''}`,
      },
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error('POST /api/payments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record payment' },
      { status: 500 }
    )
  }
}
