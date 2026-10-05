import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculatePurchaseTotals } from '@/lib/invoices/purchases'
import { graphEvents } from '@/lib/graph/live-update'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-tenant scoping — P3-AUTH-FIX
//
// The Prisma `PurchaseBill` model has NO direct `firmId` — tenant scoping goes
// through the related `Client.firmId` (Prisma nested relation filter). Mirrors
// the `/api/invoices` GET/POST pattern exactly:
//   1. requireAuth(request) → resolve caller's uid (verifies Firebase ID token)
//   2. Resolve tenantId from query/body/header → requireOrgMembership(uid, tenantId)
//   3. For POST, verify the target client belongs to the caller's org before
//      creating (prevents cross-tenant bill creation via a spoofed clientId).
//
// Before this fix, GET called `db.purchaseBill.findMany()` with NO where clause
// at all → returned every PurchaseBill across every org platform-wide.
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/purchases — Fetch all Purchase Bills (vendor invoices) for the
// caller's tenant. Returns an empty array when no tenant scope is provided or
// no purchase bills exist (real empty state — no mock data).
export async function GET(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    // Accept either organizationId (modern) or firmId (legacy) — same tenant id.
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId')

    // ── Defensive empty-state: no tenant scope → no data ──
    if (!tenantId) {
      return NextResponse.json({ purchases: [] })
    }

    // ── 2. AUTHORIZATION — verify org membership ───────────────────────────
    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    // Scope via the related Client.firmId — PurchaseBill has no direct firmId.
    const where: Record<string, unknown> = { client: { firmId: tenantId } }
    if (clientId) where.clientId = clientId

    const purchases = await db.purchaseBill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { tradeName: true, gstin: true } },
      },
    })

    return NextResponse.json({ purchases: purchases ?? [] })
  } catch (error) {
    console.error('GET /api/purchases error:', error)
    return friendlyApiError(error, 'We could not load your purchase bills right now. Please try again.')
  }
}

// POST /api/purchases — Record a new Purchase Bill
export async function POST(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

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
      organizationId,
      firmId,
    } = body ?? {}

    if (!vendorName || !invoiceNo || !invoiceDate || taxableValue === undefined) {
      return NextResponse.json(
        { error: 'vendorName, invoiceNo, invoiceDate and taxableValue are required' },
        { status: 400 }
      )
    }

    // ── 2. AUTHORIZATION — resolve tenantId then verify membership ─────────
    // Priority: x-gstpilot-orgid header → body.organizationId → body.firmId.
    const headerOrgId = request.headers.get('x-gstpilot-orgid')
    const tenantId =
      (typeof headerOrgId === 'string' && headerOrgId.trim()) ||
      (typeof organizationId === 'string' && organizationId.trim()) ||
      (typeof firmId === 'string' && firmId.trim()) ||
      null

    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 }
      )
    }
    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    // Verify the target client belongs to the caller's org (prevents cross-tenant
    // bill creation via a spoofed clientId). clientId is optional — vendor-only
    // bills (no client) skip this check.
    if (clientId) {
      const client = await db.client.findFirst({
        where: { id: clientId, firmId: tenantId },
        select: { id: true },
      })
      if (!client) {
        return NextResponse.json(
          { error: 'Client not found in this organization', code: 'CLIENT_NOT_FOUND' },
          { status: 404 }
        )
      }
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
    return friendlyApiError(error, 'We could not create the purchase bill right now. Please try again.')
  }
}
