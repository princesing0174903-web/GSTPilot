import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update'
import { emitClientNode } from '@/lib/graph/auto-emit'
import { emitTimelineEvent } from '@/lib/timeline/emit'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot'
import { parseBody, schemas } from '@/lib/validation'

// ─── Multi-tenant scoping ───────────────────────────────────────────────────
// LEGACY NOTE: The Prisma `Client` model is scoped by `firmId` (nullable
// String?). The modern org model uses `organizationId` (Firestore). There is
// no firmId↔organizationId mapping yet — for THIS sprint, the pragmatic fix is
// to accept either `?organizationId=` or `?firmId=` as a query param and treat
// the value as the tenant id (the orgId IS the firmId in this app's current
// state). When neither is provided, we return an empty list instead of
// leaking ALL clients platform-wide.

// GET /api/clients — Fetch all clients with aggregated stats (tenant-scoped)
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    // Accept either organizationId (modern) or firmId (legacy) — same tenant id.
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId')

    // Defensive empty-state: no tenant scope → no data.
    if (!tenantId) {
      return NextResponse.json({ clients: [] })
    }

    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    const clients = await db.client.findMany({
      where: { firmId: tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { invoices: true, gstrFilings: true },
        },
        healthScores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // ── Batch the per-client aggregations (was N+1: 4 queries × N clients) ──
    // Now 2 groupBy queries total, regardless of client count.
    const clientIds = clients.map((c) => c.id)

    // Group GSTRFiling by clientId + status (filed vs non-filed).
    const [filingGroups, matchGroups] = await Promise.all([
      db.gSTRFiling.groupBy({
        by: ['clientId', 'status'],
        where: { clientId: { in: clientIds } },
        _count: true,
      }),
      db.invoice.groupBy({
        by: ['clientId', 'matchStatus'],
        where: {
          clientId: { in: clientIds },
          matchStatus: { in: ['perfect_match', 'partial_match', 'mismatch'] },
        },
        _count: true,
      }),
    ])

    // Build per-client lookup maps for O(1) enrichment.
    const filedByClient = new Map<string, number>()
    const pendingByClient = new Map<string, number>()
    for (const g of filingGroups) {
      const cid = g.clientId
      if (g.status === 'filed') {
        filedByClient.set(cid, (filedByClient.get(cid) ?? 0) + g._count)
      } else {
        pendingByClient.set(cid, (pendingByClient.get(cid) ?? 0) + g._count)
      }
    }
    const matchedByClient = new Map<string, number>()
    const perfectByClient = new Map<string, number>()
    for (const g of matchGroups) {
      const cid = g.clientId
      matchedByClient.set(cid, (matchedByClient.get(cid) ?? 0) + g._count)
      if (g.matchStatus === 'perfect_match') {
        perfectByClient.set(cid, (perfectByClient.get(cid) ?? 0) + g._count)
      }
    }

    // Enrich each client with aggregated metrics (lookups are O(1) per client).
    const enriched = clients.map((client) => {
      const invoiceCount = client._count.invoices
      const filingCount = client._count.gstrFilings

      const filedReturns = filedByClient.get(client.id) ?? 0
      const pendingReturns = pendingByClient.get(client.id) ?? 0

      const totalMatchedInvoices = matchedByClient.get(client.id) ?? 0
      const perfectMatchInvoices = perfectByClient.get(client.id) ?? 0

      const matchPercentage =
        totalMatchedInvoices > 0
          ? Math.round((perfectMatchInvoices / totalMatchedInvoices) * 100)
          : 0

      const latestHealthScore = client.healthScores[0]?.score ?? client.healthScore

      return {
        id: client.id,
        gstin: client.gstin,
        tradeName: client.tradeName,
        legalName: client.legalName,
        address: client.address,
        state: client.state,
        stateCode: client.stateCode,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone,
        entityType: client.entityType,
        returnPeriod: client.returnPeriod,
        lastFilingDate: client.lastFilingDate,
        status: client.status,
        healthScore: latestHealthScore,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        _aggregations: {
          totalInvoices: invoiceCount,
          filedReturns,
          pendingReturns,
          matchPercentage,
        },
      }
    })

    return NextResponse.json({ clients: enriched })
  } catch (error) {
    console.error('GET /api/clients error:', error)
    return friendlyApiError(error, 'We could not load your clients right now. Please try again.')
  }
}

// POST /api/clients — Create a new client
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    // ── SECURITY (POLISH-06): zod validation via schemas.clientCreate. ──
    const [body, validationErr] = await parseBody(request, schemas.clientCreate)
    if (validationErr) return validationErr
    const tenantId = body.organizationId || body.firmId

    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 }
      )
    }

    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    // Check for duplicate GSTIN within the same tenant
    const existing = await db.client.findUnique({ where: { gstin: body.gstin } })
    if (existing) {
      return NextResponse.json(
        { error: 'A client with this GSTIN already exists' },
        { status: 409 }
      )
    }

    const client = await db.client.create({
      data: {
        gstin: body.gstin,
        tradeName: body.tradeName,
        legalName: body.legalName ?? null,
        address: body.address ?? null,
        state: body.state ?? null,
        stateCode: body.stateCode ?? null,
        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        entityType: body.entityType ?? 'regular',
        returnPeriod: body.returnPeriod ?? null,
        // Persist the tenant scope so subsequent reads can filter by it.
        firmId: tenantId,
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: client.id,
        action: 'Client Created',
        entity: 'client',
        entityId: client.id,
        details: `New client ${body.tradeName} (${body.gstin}) created`,
      },
    })

    // ── Real Business Graph Engine™ — auto-create client node + live event ──
    graphEvents.clientCreated(client.id, client.tradeName)

    // PT-2-b: canonical graph node emit (verifies entity + pushes live event + invalidates cache)
    try { await emitClientNode(client.id) } catch (e) { console.error('[graph] emitClientNode failed', e) }

    // ── Business Timeline — emit customer.created (fire-and-forget, never breaks the flow) ──
    // Unified SaaS: invalidate the canonical snapshot cache so the new customer
    // appears on the dashboard, Oracle, and reports immediately.
    invalidateBusinessSnapshotCache(tenantId)

    await emitTimelineEvent({
      organizationId: tenantId,
      type: 'customer.created',
      title: `Customer “${body.tradeName}” created`,
      description: `New customer added with GSTIN ${body.gstin}.`,
      metadata: {
        clientId: client.id,
        gstin: body.gstin,
        tradeName: body.tradeName,
        legalName: body.legalName ?? null,
        entityType: body.entityType ?? 'regular',
      },
      severity: 'success',
    })

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('POST /api/clients error:', error)
    return friendlyApiError(error, 'We could not create the client right now. Please try again.')
  }
}

// PATCH /api/clients — Update a client
export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    // ── SECURITY (POLISH-06): zod validation via schemas.clientUpdate.
    // This is critical: the previous route spread `...updates` straight into
    // Prisma's `data:`, which would have allowed a caller to overwrite `id`,
    // `createdAt`, `firmId`, or any other column. The zod schema enumerates
    // every allowed field so nothing else can slip through.
    const [body, validationErr] = await parseBody(request, schemas.clientUpdate)
    if (validationErr) return validationErr

    const existing = await db.client.findUnique({ where: { id: body.id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Tenant scope check — verify the client belongs to a workspace the caller can access.
    const memberResult = await requireOrgMembership(uid, existing.firmId)
    if (memberResult instanceof NextResponse) return memberResult

    // Check GSTIN uniqueness if being updated
    if (body.gstin && body.gstin !== existing.gstin) {
      const duplicate = await db.client.findUnique({ where: { gstin: body.gstin } })
      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this GSTIN already exists' },
          { status: 409 }
        )
      }
    }

    // Build the update payload from validated fields only — never spread raw input.
    const updateData: Record<string, string | null | undefined> = {}
    if (body.gstin !== undefined) updateData.gstin = body.gstin
    if (body.tradeName !== undefined) updateData.tradeName = body.tradeName
    if (body.legalName !== undefined) updateData.legalName = body.legalName ?? null
    if (body.address !== undefined) updateData.address = body.address ?? null
    if (body.state !== undefined) updateData.state = body.state ?? null
    if (body.stateCode !== undefined) updateData.stateCode = body.stateCode ?? null
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail ?? null
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone ?? null
    if (body.entityType !== undefined) updateData.entityType = body.entityType ?? 'regular'
    if (body.returnPeriod !== undefined) updateData.returnPeriod = body.returnPeriod ?? null

    const client = await db.client.update({
      where: { id: body.id },
      data: updateData,
    })

    // ── Unified SaaS (Phase 2): cascade denormalized snapshot to invoices ──
    // Invoice.buyerName + Invoice.buyerGstin are denormalized snapshots taken
    // at invoice creation. When a customer is renamed or their GSTIN changes,
    // existing invoices MUST be updated too — otherwise the snapshot's
    // top-customer concentration splits revenue across old + new buyerName
    // values, and the Receivables table shows stale customer names.
    const cascadeUpdate: Record<string, string | null> = {}
    if (body.tradeName !== undefined) cascadeUpdate.buyerName = body.tradeName
    if (body.gstin !== undefined) cascadeUpdate.buyerGstin = body.gstin ?? null
    if (Object.keys(cascadeUpdate).length > 0) {
      await db.invoice.updateMany({
        where: { clientId: client.id },
        data: cascadeUpdate,
      })
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: client.id,
        action: 'Client Updated',
        entity: 'client',
        entityId: client.id,
        details: `Client ${client.tradeName} (${client.gstin}) updated`,
      },
    })

    // ── Real Business Graph Engine™ — invalidate cache so edits reflect instantly ──
    invalidateGraph()

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Customer count / health score may have changed.
    if (existing.firmId) {
      invalidateBusinessSnapshotCache(existing.firmId)
    }

    return NextResponse.json({ client })
  } catch (error) {
    console.error('PATCH /api/clients error:', error)
    return friendlyApiError(error, 'We could not update the client right now. Please try again.')
  }
}

// DELETE /api/clients — Delete a client
export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Client id is required' },
        { status: 400 }
      )
    }

    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Tenant scope check — verify the client belongs to a workspace the caller can access.
    const memberResult = await requireOrgMembership(uid, existing.firmId)
    if (memberResult instanceof NextResponse) return memberResult

    // Create audit log before deletion
    await db.auditLog.create({
      data: {
        action: 'Client Deleted',
        entity: 'client',
        entityId: id,
        details: `Client ${existing.tradeName} (${existing.gstin}) deleted`,
      },
    })

    await db.client.delete({ where: { id } })

    // ── Real Business Graph Engine™ — invalidate cache so removal reflects instantly ──
    invalidateGraph()

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Customer count, receivables, and GST metrics all need recomputation.
    if (existing.firmId) {
      invalidateBusinessSnapshotCache(existing.firmId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/clients error:', error)
    return friendlyApiError(error, 'We could not delete the client right now. Please try again.')
  }
}
