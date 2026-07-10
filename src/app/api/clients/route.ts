import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update'
import { emitClientNode } from '@/lib/graph/auto-emit'

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
    const { searchParams } = new URL(request.url)
    // Accept either organizationId (modern) or firmId (legacy) — same tenant id.
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId')

    // Defensive empty-state: no tenant scope → no data.
    if (!tenantId) {
      return NextResponse.json({ clients: [] })
    }

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

    // Enrich each client with aggregated metrics
    const enriched = await Promise.all(
      clients.map(async (client) => {
        const invoiceCount = client._count.invoices
        const filingCount = client._count.gstrFilings

        const filedReturns = await db.gSTRFiling.count({
          where: { clientId: client.id, status: 'filed' },
        })

        const pendingReturns = await db.gSTRFiling.count({
          where: { clientId: client.id, status: { not: 'filed' } },
        })

        const totalMatchedInvoices = await db.invoice.count({
          where: {
            clientId: client.id,
            matchStatus: { in: ['perfect_match', 'partial_match', 'mismatch'] },
          },
        })
        const perfectMatchInvoices = await db.invoice.count({
          where: { clientId: client.id, matchStatus: 'perfect_match' },
        })

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
    )

    return NextResponse.json({ clients: enriched })
  } catch (error) {
    console.error('GET /api/clients error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}

// POST /api/clients — Create a new client
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      gstin,
      tradeName,
      legalName,
      address,
      state,
      stateCode,
      contactEmail,
      contactPhone,
      entityType,
      returnPeriod,
      // Tenant scope — accept either organizationId (modern) or firmId (legacy).
      // They are the same tenant identifier in this app's current state.
      organizationId,
      firmId,
    } = body
    const tenantId = organizationId || firmId

    if (!gstin || !tradeName) {
      return NextResponse.json(
        { error: 'gstin and tradeName are required' },
        { status: 400 }
      )
    }
    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 }
      )
    }

    // Check for duplicate GSTIN within the same tenant
    const existing = await db.client.findUnique({ where: { gstin } })
    if (existing) {
      return NextResponse.json(
        { error: 'A client with this GSTIN already exists' },
        { status: 409 }
      )
    }

    const client = await db.client.create({
      data: {
        gstin,
        tradeName,
        legalName: legalName ?? null,
        address: address ?? null,
        state: state ?? null,
        stateCode: stateCode ?? null,
        contactEmail: contactEmail ?? null,
        contactPhone: contactPhone ?? null,
        entityType: entityType ?? 'regular',
        returnPeriod: returnPeriod ?? null,
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
        details: `New client ${tradeName} (${gstin}) created`,
      },
    })

    // ── Real Business Graph Engine™ — auto-create client node + live event ──
    graphEvents.clientCreated(client.id, client.tradeName)

    // PT-2-b: canonical graph node emit (verifies entity + pushes live event + invalidates cache)
    try { await emitClientNode(client.id) } catch (e) { console.error('[graph] emitClientNode failed', e) }

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('POST /api/clients error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create client' },
      { status: 500 }
    )
  }
}

// PATCH /api/clients — Update a client
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

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

    // Check GSTIN uniqueness if being updated
    if (updates.gstin && updates.gstin !== existing.gstin) {
      const duplicate = await db.client.findUnique({ where: { gstin: updates.gstin } })
      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this GSTIN already exists' },
          { status: 409 }
        )
      }
    }

    const client = await db.client.update({
      where: { id },
      data: updates,
    })

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

    return NextResponse.json({ client })
  } catch (error) {
    console.error('PATCH /api/clients error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update client' },
      { status: 500 }
    )
  }
}

// DELETE /api/clients — Delete a client
export async function DELETE(request: Request) {
  try {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/clients error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete client' },
      { status: 500 }
    )
  }
}
