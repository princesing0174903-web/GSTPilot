import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update'
import { emitCollectionNode } from '@/lib/graph/auto-emit'
import { emitTimelineEvent } from '@/lib/timeline/emit'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot'

/** Resolve orgId for a payment from header, body, or Client.firmId lookup. */
async function resolveOrgForPayment(
  req: NextRequest,
  body: { organizationId?: string; firmId?: string; clientId?: string },
): Promise<string | null> {
  const headerOrg = req.headers.get('x-gstpilot-orgid')
  if (headerOrg && headerOrg.trim()) return headerOrg.trim()
  const bodyOrg = body.organizationId || body.firmId
  if (bodyOrg && typeof bodyOrg === 'string' && bodyOrg.trim()) return bodyOrg.trim()
  if (body.clientId) {
    try {
      const client = await db.client.findUnique({
        where: { id: body.clientId },
        select: { firmId: true },
      })
      if (client?.firmId) return client.firmId
    } catch {
      /* ignore — best-effort */
    }
  }
  return null
}

/** Parse the `x-gstpilot-actor` request header (JSON { uid, email }). */
function parseActorHeader(req: NextRequest): { userId?: string; userName?: string } | undefined {
  const raw = req.headers.get('x-gstpilot-actor')
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as { uid?: string; email?: string; displayName?: string }
    if (!parsed.uid && !parsed.email) return undefined
    return { userId: parsed.uid, userName: parsed.displayName ?? parsed.email }
  } catch {
    return undefined
  }
}

// GET /api/payments — Fetch payments, tenant-scoped.
// Accepts organizationId (preferred) or clientId. If NEITHER is provided,
// returns empty (prevents cross-tenant data leak).
export async function GET(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const partyType = searchParams.get('partyType')
    const organizationId = searchParams.get('organizationId') ?? searchParams.get('firmId')

    const where: Record<string, unknown> = {}
    if (clientId) {
      where.clientId = clientId
    } else if (organizationId) {
      where.client = { organizationId }
    } else {
      // No tenant scope — return empty rather than leak cross-tenant data
      return NextResponse.json({ payments: [] })
    }

    // ── 2. AUTHORIZATION — when an orgId is available, verify membership ────
    if (organizationId) {
      const memberResult = await requireOrgMembership(uid, organizationId)
      if (memberResult instanceof NextResponse) return memberResult
    }

    if (partyType) where.partyType = partyType

    const payments = await db.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
    })

    return NextResponse.json({ payments: payments ?? [] })
  } catch (error) {
    console.error('GET /api/payments error:', error)
    return friendlyApiError(error, 'We could not load your payments right now. Please try again.')
  }
}

// POST /api/payments — Record a new payment and reconcile against an invoice
// or purchase bill when one is referenced.
export async function POST(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

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

    // ── 2. AUTHORIZATION — verify membership when an orgId can be resolved ──
    // Resolve the orgId early via the existing helper so we can gate the write.
    // The same orgId is reused below for the timeline emit (no double-resolve).
    const orgId = await resolveOrgForPayment(request, body)
    if (orgId) {
      const memberResult = await requireOrgMembership(uid, orgId)
      if (memberResult instanceof NextResponse) return memberResult
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
    let invoiceNowPaid = false
    let paidInvoiceNumber: string | null = null
    let paidInvoiceTotal = 0
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
          invoiceNowPaid = true
          paidInvoiceNumber = invoice.invoiceNumber
          paidInvoiceTotal = total
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

    // ── Business Timeline events (fire-and-forget — never break the payment) ──
    // orgId was resolved above for the membership check; reuse it here.
    if (orgId) {
      const actor = parseActorHeader(request)
      const isCustomerPayment = partyType !== 'vendor'

      // Always emit payment.received (for customer payments) — captures every
      // inbound payment on the timeline.
      if (isCustomerPayment) {
        await emitTimelineEvent({
          organizationId: orgId,
          type: 'payment.received',
          title: `Payment ₹${paymentAmount.toLocaleString('en-IN')} received`,
          description: `${partyName} paid via ${paymentMode}${invoiceId ? ` — against invoice${paidInvoiceNumber ? ` ${paidInvoiceNumber}` : ''}` : ''}.${referenceNo ? ` Ref: ${referenceNo}.` : ''}`,
          actor,
          metadata: {
            paymentId: payment.id,
            amount: paymentAmount,
            partyName,
            partyType,
            paymentMode,
            paymentDate,
            referenceNo: referenceNo ?? null,
            invoiceId: invoiceId ?? null,
            invoiceNumber: paidInvoiceNumber,
            clientId: clientId ?? null,
          },
          severity: 'success',
        })
      }

      // When the referenced invoice just transitioned to fully-paid, emit a
      // separate invoice.paid event so the timeline surfaces the milestone.
      if (invoiceNowPaid && paidInvoiceNumber) {
        await emitTimelineEvent({
          organizationId: orgId,
          type: 'invoice.paid',
          title: `Invoice ${paidInvoiceNumber} paid`,
          description: `Invoice ${paidInvoiceNumber} (${paidInvoiceTotal > 0 ? `₹${paidInvoiceTotal.toLocaleString('en-IN')}` : 'fully settled'}) cleared by ${partyName}.`,
          actor,
          metadata: {
            invoiceId: invoiceId!,
            invoiceNumber: paidInvoiceNumber,
            amount: paidInvoiceTotal,
            paymentId: payment.id,
            partyName,
            paymentMode,
            paymentDate,
          },
          severity: 'success',
        })
      }
    }

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Payment recorded → cash flow, collection rate, receivables, customer
    // outstanding, and health score all need recomputation.
    if (orgId) invalidateBusinessSnapshotCache(orgId)

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error('POST /api/payments error:', error)
    return friendlyApiError(error, 'We could not record the payment right now. Please try again.')
  }
}

// Helper: invalidate snapshot cache for the org that owns the payment's client.
// Called after POST / PATCH / DELETE so cash flow, receivables, collection
// rate, and health score all reflect the payment immediately.
async function invalidateSnapshotForPayment(payment: { clientId?: string | null }): Promise<void> {
  if (!payment.clientId) return
  const client = await db.client.findUnique({
    where: { id: payment.clientId },
    select: { firmId: true },
  }).catch(() => null)
  if (client?.firmId) {
    invalidateBusinessSnapshotCache(client.firmId)
  }
}

// PATCH /api/payments?id=XXX — Update a payment (e.g., mark reconciled)
export async function PATCH(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

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

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Payment amount/status changed → cash flow, collection rate, receivables.
    await invalidateSnapshotForPayment(payment)

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('PATCH /api/payments error:', error)
    return friendlyApiError(error, 'We could not update the payment right now. Please try again.')
  }
}

// DELETE /api/payments?id=XXX — Delete a payment
export async function DELETE(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

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

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    await invalidateSnapshotForPayment(payment)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/payments error:', error)
    return friendlyApiError(error, 'We could not delete the payment right now. Please try again.')
  }
}
