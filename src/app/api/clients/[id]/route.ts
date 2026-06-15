import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/clients/[id] — Get single client with details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = await db.client.findUnique({
      where: { id },
      include: {
        firm: { select: { id: true, name: true, gstin: true } },
        gstins: true,
        _count: {
          select: { invoices: true, returns: true, documents: true, reconciliationRuns: true },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ client })
  } catch (error) {
    console.error('GET /api/clients/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch client' },
      { status: 500 }
    )
  }
}

// PATCH /api/clients/[id] — Update client
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { ...updates } = body

    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Check GSTIN uniqueness if being updated
    if (updates.gstin && updates.gstin !== existing.gstin) {
      const duplicate = await db.client.findUnique({
        where: { firmId_gstin: { firmId: existing.firmId, gstin: updates.gstin } },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this GSTIN already exists in this firm' },
          { status: 409 }
        )
      }
    }

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.firmId
    delete updates.createdAt
    delete updates.updatedAt

    const client = await db.client.update({
      where: { id },
      data: updates,
    })

    // Create activity log
    await db.activity.create({
      data: {
        firmId: client.firmId,
        clientId: client.id,
        type: 'client_updated',
        description: `Client ${client.businessName} updated`,
      },
    })

    return NextResponse.json({ client })
  } catch (error) {
    console.error('PATCH /api/clients/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update client' },
      { status: 500 }
    )
  }
}

// DELETE /api/clients/[id] — Delete client (cascades)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Create activity log before deletion
    await db.activity.create({
      data: {
        firmId: existing.firmId,
        type: 'client_deleted',
        description: `Client ${existing.businessName} (${existing.gstin}) deleted`,
      },
    })

    // Delete client (cascades to related records)
    await db.client.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/clients/[id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete client' },
      { status: 500 }
    )
  }
}
