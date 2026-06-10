import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/clients — Fetch all clients with aggregated stats
export async function GET() {
  try {
    const clients = await db.client.findMany({
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

        // Filed returns (status = 'filed')
        const filedReturns = await db.gSTRFiling.count({
          where: { clientId: client.id, status: 'filed' },
        })

        // Pending returns (not filed yet)
        const pendingReturns = await db.gSTRFiling.count({
          where: { clientId: client.id, status: { not: 'filed' } },
        })

        // Match percentage — perfect_match out of total matched invoices
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
    } = body

    if (!gstin || !tradeName) {
      return NextResponse.json(
        { error: 'gstin and tradeName are required' },
        { status: 400 }
      )
    }

    // Check for duplicate GSTIN
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

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('POST /api/clients error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create client' },
      { status: 500 }
    )
  }
}
