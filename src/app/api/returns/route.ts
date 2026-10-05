import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'

// GET /api/returns — List returns with optional filters
//
// Multi-tenant scoping: organizationId (or legacy firmId) is REQUIRED. The
// GSTRFiling table has no direct `firmId` column, so we scope through the
// related `Client.firmId` via a Prisma nested relation filter.
//
// ROOT-CAUSE FIX (Task 10 — Returns module):
//   The previous implementation filtered `where: { firmId: tenantId }`, but
//   `GSTRFiling` has NO `firmId` field. Prisma threw "Unknown argument
//   `firmId`" on EVERY request → the route returned a 500 error envelope
//   and the Returns page showed "Failed to load returns" forever. We now
//   scope through `client: { firmId }` which is the correct relation path.
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

    // Build the where-clause. GSTRFiling has no `firmId` — scope through the
    // related Client's `firmId` (Prisma nested relation filter).
    const where: Record<string, unknown> = {
      client: { firmId: tenantId },
    }
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
//
// ROOT-CAUSE FIX (Task 10 — Returns module):
//   1. The previous implementation selected `client.businessName`, but the
//      Client model uses `tradeName`. Prisma threw "Unknown selection
//      `businessName`" on every create → 500.
//   2. It called `findUnique({ where: { firmId_clientId_returnType_period } })`,
//      but NO such unique constraint exists on GSTRFiling (and there is no
//      `firmId` field). Prisma threw "Unknown argument" → 500. We now use
//      `findFirst` scoped by `clientId + returnType + period`.
//   3. It created a FilingEvent with `returnId`, but the schema field is
//      `filingId`. Prisma threw "Unknown argument `returnId`" → 500.
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

    // Verify the client belongs to the tenant (prevents cross-tenant return
    // creation via a spoofed clientId).
    const client = await db.client.findFirst({
      where: { id: clientId, firmId },
      select: { id: true, tradeName: true, gstin: true },
    })
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found in this organization', code: 'CLIENT_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Check if a return already exists for this client + returnType + period.
    // (No unique constraint exists on GSTRFiling, so we use findFirst.)
    const existing = await db.gSTRFiling.findFirst({
      where: { clientId, returnType, period },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A return already exists for this client, return type, and period', return: existing },
        { status: 409 }
      )
    }

    // Count invoices for this client and period for initial metrics.
    const invoiceCount = await db.invoice.count({
      where: { clientId, period },
    })

    const totalTaxable = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { taxableValue: true },
    })

    const totalTax = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { cgst: true, sgst: true, igst: true, cess: true },
    })

    const taxSum =
      (totalTax._sum.cgst ?? 0) +
      (totalTax._sum.sgst ?? 0) +
      (totalTax._sum.igst ?? 0) +
      (totalTax._sum.cess ?? 0)

    const ret = await db.gSTRFiling.create({
      data: {
        clientId,
        returnType,
        period,
        financialYear: financialYear ?? null,
        status: 'draft',
        totalTaxableValue: totalTaxable._sum.taxableValue ?? 0,
        totalTax: taxSum,
        totalInvoices: invoiceCount,
      },
      include: {
        client: {
          select: { id: true, tradeName: true, gstin: true },
        },
      },
    })

    // Create filing event (schema field is `filingId`, NOT `returnId`).
    await db.filingEvent.create({
      data: {
        filingId: ret.id,
        clientId,
        eventType: 'created',
        description: `New ${returnType} return created for period ${period}`,
      },
    })

    // Create activity log (Activity has firmId, clientId, type, description).
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

    // ── 2. AUTHORIZATION — verify org membership for the return's firm ──────
    // GSTRFiling has no firmId; resolve it through the related Client.
    const firmId = existing.client?.firmId
    if (!firmId) {
      return NextResponse.json(
        { error: 'Return is not attached to an organization', code: 'NO_ORG' },
        { status: 403 }
      )
    }
    const memberResult = await requireOrgMembership(uid, firmId)
    if (memberResult instanceof NextResponse) return memberResult

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (filedDate !== undefined) data.filedDate = filedDate ? String(filedDate) : null
    if (acknowledgmentNumber !== undefined) data.acknowledgmentNumber = acknowledgmentNumber
    if (filedBy !== undefined) data.filedBy = filedBy
    if (jsonPayload !== undefined) data.jsonPayload = jsonPayload

    const ret = await db.gSTRFiling.update({
      where: { id },
      data,
      include: {
        client: {
          // ROOT-CAUSE FIX: Client has `tradeName`, not `businessName`.
          select: { id: true, tradeName: true, gstin: true },
        },
      },
    })

    // Create filing event for status change (schema field is `filingId`).
    if (status && status !== existing.status) {
      await db.filingEvent.create({
        data: {
          filingId: id,
          clientId: existing.clientId,
          eventType: 'status_changed',
          description: `Return status changed from ${existing.status} to ${status}`,
          userId: filedBy ?? null,
        },
      })

      // Special handling for filed status
      if (status === 'filed') {
        await db.filingEvent.create({
          data: {
            filingId: id,
            clientId: existing.clientId,
            eventType: 'filed',
            description: `${existing.returnType} for ${existing.period} filed${acknowledgmentNumber ? ` — ARN ${acknowledgmentNumber}` : ''}`,
            userId: filedBy ?? null,
          },
        })

        await db.activity.create({
          data: {
            firmId,
            clientId: existing.clientId,
            type: 'return_filed',
            description: `${existing.returnType} for ${existing.period} filed for ${existing.client?.tradeName ?? 'client'}`,
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

// DELETE /api/returns — Delete (archive) a return
export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await db.gSTRFiling.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const firmId = existing.client?.firmId
    if (!firmId) {
      return NextResponse.json(
        { error: 'Return is not attached to an organization', code: 'NO_ORG' },
        { status: 403 }
      )
    }
    const memberResult = await requireOrgMembership(uid, firmId)
    if (memberResult instanceof NextResponse) return memberResult

    // Cascade-delete filing events first (schema has no onDelete cascade).
    await db.filingEvent.deleteMany({ where: { filingId: id } })
    await db.gSTRFiling.delete({ where: { id } })

    await db.activity.create({
      data: {
        firmId,
        clientId: existing.clientId,
        type: 'return_deleted',
        description: `${existing.returnType} for ${existing.period} deleted`,
      },
    })

    invalidateGraph()

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/returns error:', error)
    return friendlyApiError(error, 'We could not delete the return right now. Please try again.')
  }
}
