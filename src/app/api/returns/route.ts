import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/returns — List returns with optional filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const firmId = searchParams.get('firmId')
    const returnType = searchParams.get('returnType')
    const period = searchParams.get('period')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (firmId) where.firmId = firmId
    if (returnType) where.returnType = returnType
    if (period) where.period = period
    if (status) where.status = status

    const returns = await db.return.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        client: {
          select: { id: true, businessName: true, gstin: true, state: true },
        },
        filer: {
          select: { id: true, name: true },
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch returns' },
      { status: 500 }
    )
  }
}

// POST /api/returns — Create a new return
export async function POST(request: Request) {
  try {
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

    // Check if a return already exists for this client + returnType + period
    const existing = await db.return.findUnique({
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

    const ret = await db.return.create({
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

    return NextResponse.json({ return: ret }, { status: 201 })
  } catch (error) {
    console.error('POST /api/returns error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create return' },
      { status: 500 }
    )
  }
}

// PATCH /api/returns — Update return status
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, filedDate, acknowledgmentNumber, filedBy, jsonPayload } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.return.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (filedDate !== undefined) data.filedDate = filedDate ? new Date(filedDate) : null
    if (acknowledgmentNumber !== undefined) data.acknowledgmentNumber = acknowledgmentNumber
    if (filedBy !== undefined) data.filedBy = filedBy
    if (jsonPayload !== undefined) data.jsonPayload = jsonPayload

    const ret = await db.return.update({
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
      }
    }

    return NextResponse.json({ return: ret })
  } catch (error) {
    console.error('PATCH /api/returns error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update return' },
      { status: 500 }
    )
  }
}
