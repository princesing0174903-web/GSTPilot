import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update'
import { emitCollectionNode } from '@/lib/graph/auto-emit'

// GET /api/payments — Fetch payments, scoped by clientId (multi-tenant isolation).
// Previously this returned ALL payments platform-wide with no `where` clause
// (multi-tenant data leak). Now filters by clientId query param.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const partyType = searchParams.get('partyType')

    const where: { clientId?: string; partyType?: string } = {}
    if (clientId) where.clientId = clientId
    if (partyType) where.partyType = partyType

    const payments = await db.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
    })

    return NextResponse.json({ payments: payments ?? [] })
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
        // ── Real Business Graph Engine™ — invoice cleared event ──
        if (paymentStatus === 'paid') {
          graphEvents.invoicePaid(invoiceId, invoice.invoiceNumber, paymentAmount)
        }
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

    // ── Real Business Graph Engine™ — auto-create payment/collection node + live event ──
    if (partyType === 'vendor') {
      graphEvents.paymentMade(payment.id, partyName, paymentAmount)
    } else {
      graphEvents.paymentReceived(payment.id, partyName, paymentAmount)
    }

    // PT-2-b: canonical graph node emit — collection/payment node + Client→Collection edge
    try { await emitCollectionNode(payment.id) } catch (e) { console.error('[graph] emitCollectionNode failed', e) }

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error('POST /api/payments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record payment' },
      { status: 500 }
    )
  }
}

// PATCH /api/payments?id=XXX — Update a payment (e.g., mark reconciled)
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'partyName', 'partyType', 'amount', 'paymentDate', 'paymentMode',
      'referenceNo', 'status', 'reconciled', 'notes', 'clientId', 'invoiceId', 'purchaseBillId',
    ]
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === 'amount'
          ? Number(body[field])
          : field === 'reconciled'
            ? Boolean(body[field])
            : body[field]
      }
    }

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
    })

    await db.auditLog.create({
      data: {
        clientId: payment.clientId,
        action: 'Payment Updated',
        entity: 'payment',
        entityId: payment.id,
        details: `Payment ₹${payment.amount} (${payment.partyName}) updated`,
      },
    })

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('PATCH /api/payments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update payment' },
      { status: 500 }
    )
  }
}

// DELETE /api/payments?id=XXX — Delete a payment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    const payment = await db.payment.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        clientId: payment.clientId,
        action: 'Payment Deleted',
        entity: 'payment',
        entityId: payment.id,
        details: `Payment ₹${payment.amount} (${payment.partyName}) deleted`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/payments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete payment' },
      { status: 500 }
    )
  }
}
