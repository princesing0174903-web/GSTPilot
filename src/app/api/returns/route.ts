import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'

// GET /api/returns — List returns with optional filters
//
// Multi-tenant scoping: firmId (or organizationId) is REQUIRED. Previously
// `firmId` was an optional query param and when omitted, the route returned
// ALL GSTRFiling rows across ALL firms — a multi-tenant leak. We now return
// an empty list when no tenant scope is provided.
export async function GET(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    // Accept either organizationId (modern) or firmId (legacy) — same tenant id.
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId')
    const returnType = searchParams.get('returnType')
    const period = searchParams.get('period')
    const status = searchParams.get('status')

    // ── Defensive empty-state: no tenant scope → no data ──
    if (!tenantId) {
      return NextResponse.json({ returns: [] })
    }

    // ── 2. AUTHORIZATION — verify org membership ────────────────────────────
    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    const where: Record<string, unknown> = { firmId: tenantId }
    if (clientId) where.clientId = clientId
    if (returnType) where.returnType = returnType
    if (period) where.period = period
    if (status) where.status = status

    const returns = await db.gSTRFiling.findMany({
      where,
      include: {
        client: {
          select: { id: true, tradeName: true, gstin: true, state: true },
        },
        _count: {
          select: { events: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ returns })
  } catch (error) {
    console.error('GET /api/returns error:', error)
    return friendlyApiError(error, 'We could not load your returns right now. Please try again.')
  }
}

// POST /api/returns — Create a new return
export async function POST(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const body = await request.json()
    const {
      firmId,
      clientId,
      returnType,
      period,
      financialYear,
    } = body

    if (!firmId || !clientId || !returnType || !period) {
      return NextResponse.json(
        { error: 'firmId, clientId, returnType, and period are required' },
        { status: 400 }
      )
    }

    // ── 2. AUTHORIZATION — verify org membership for the target firmId ──────
    const memberResult = await requireOrgMembership(uid, firmId)
    if (memberResult instanceof NextResponse) return memberResult

    // Check if a return already exists for this client + returnType + period
    const existing = await db.gSTRFiling.findUnique({
      where: { firmId_clientId_returnType_period: { firmId, clientId, returnType, period } },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A return already exists for this client, return type, and period', return: existing },
        { status: 409 }
      )
    }

    // Count invoices for this client and period for initial metrics
    const invoiceCount = await db.invoice.count({
      where: { clientId, period },
    })

    const totalTaxable = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { taxableValue: true },
    })

    const totalTax = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { cgst: true, sgst: true, igst: true },
    })

    const taxSum =
      (totalTax._sum.cgst ?? 0) + (totalTax._sum.sgst ?? 0) + (totalTax._sum.igst ?? 0)

    const ret = await db.gSTRFiling.create({
      data: {
        firmId,
        clientId,
        returnType,
        period,
        financialYear: financialYear ?? null,
        status: 'draft',
        totalTaxableValue: totalTaxable._sum.taxableValue ?? 0,
        totalTax: taxSum,
        invoiceCount,
      },
      include: {
        client: {
          select: { id: true, businessName: true, gstin: true },
        },
      },
    })

    // Create filing event
    await db.filingEvent.create({
      data: {
        returnId: ret.id,
        eventType: 'created',
        description: `New ${returnType} return created for period ${period}`,
      },
    })

    // Create activity log
    await db.activity.create({
      data: {
        firmId,
        clientId,
        type: 'return_prepared',
        description: `${returnType} for ${period} prepared`,
      },
    })

    // ── Real Business Graph Engine™ — auto-create GST-return node + live event ──
    graphEvents.returnCreated(ret.id, ret.returnType, ret.period, ret.totalTax ?? 0)

    return NextResponse.json({ return: ret }, { status: 201 })
  } catch (error) {
    console.error('POST /api/returns error:', error)
    return friendlyApiError(error, 'We could not create the return right now. Please try again.')
  }
}

// PATCH /api/returns — Update return status
export async function PATCH(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const body = await request.json()
    const { id, status, filedDate, acknowledgmentNumber, filedBy, jsonPayload } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.gSTRFiling.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    // ── 2. AUTHORIZATION — verify org membership for the return's firmId ────
    const memberResult = await requireOrgMembership(uid, existing.firmId)
    if (memberResult instanceof NextResponse) return memberResult

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (filedDate !== undefined) data.filedDate = filedDate ? new Date(filedDate) : null
    if (acknowledgmentNumber !== undefined) data.acknowledgmentNumber = acknowledgmentNumber
    if (filedBy !== undefined) data.filedBy = filedBy
    if (jsonPayload !== undefined) data.jsonPayload = jsonPayload

    const ret = await db.gSTRFiling.update({
      where: { id },
      data,
      include: {
        client: {
          select: { id: true, businessName: true, gstin: true },
        },
      },
    })

    // Create filing event for status change
    if (status && status !== existing.status) {
      await db.filingEvent.create({
        data: {
          returnId: id,
          eventType: 'status_changed',
          description: `Return status changed from ${existing.status} to ${status}`,
          userId: filedBy ?? null,
        },
      })

      // Special handling for filed status
      if (status === 'filed') {
        await db.filingEvent.create({
          data: {
            returnId: id,
            eventType: 'filed',
            description: `${existing.returnType} for ${existing.period} filed${acknowledgmentNumber ? ` — ARN ${acknowledgmentNumber}` : ''}`,
            userId: filedBy ?? null,
          },
        })

        await db.activity.create({
          data: {
            firmId: existing.firmId,
            clientId: existing.clientId,
            type: 'return_filed',
            description: `${existing.returnType} for ${existing.period} filed for ${existing.client.businessName}`,
          },
        })

        // ── Real Business Graph Engine™ — GST return filed live event ──
        graphEvents.gstFiled(ret.id, existing.returnType, existing.period, ret.totalTax ?? 0)
      }
    }

    // ── Real Business Graph Engine™ — invalidate cache for any status change ──
    invalidateGraph()

    return NextResponse.json({ return: ret })
  } catch (error) {
    console.error('PATCH /api/returns error:', error)
    return friendlyApiError(error, 'We could not update the return right now. Please try again.')
  }
}
