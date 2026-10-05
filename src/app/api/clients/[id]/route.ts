import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'

// ─── Multi-tenant scoping ───────────────────────────────────────────────────
// LEGACY NOTE: The Prisma `Client` model carries `firmId` (nullable String?).
// The modern org model uses `organizationId` (Firestore). There is no
// firmId↔organizationId mapping yet — for THIS sprint, we accept either
// `?organizationId=` or `?firmId=` as a query param and treat the value as the
// tenant id (the orgId IS the firmId in this app's current state).
//
// After fetching a client by id, we verify the client's `firmId` matches the
// caller's tenant id. On mismatch we return 404 (don't leak existence). When
// no tenant id is provided at all we return 400.

function resolveTenantId(request: Request): string | null {
  const { searchParams } = new URL(request.url)
  return searchParams.get('organizationId') || searchParams.get('firmId')
}

// GET /api/clients/[id] — Get single client with details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 }
      )
    }

    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

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

    if (!client || client.firmId !== tenantId) {
      // Don't leak existence — return 404 for both not-found and cross-tenant.
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ client })
  } catch (error) {
    console.error('GET /api/clients/[id] error:', error)
    return friendlyApiError(error, 'We could not load this client right now. Please try again.')
  }
}

// PATCH /api/clients/[id] — Update client
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 }
      )
    }

    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    const { id } = await params
    const body = await request.json()
    const { ...updates } = body

    const existing = await db.client.findUnique({ where: { id } })
    if (!existing || existing.firmId !== tenantId) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Check GSTIN uniqueness if being updated
    if (updates.gstin && updates.gstin !== existing.gstin) {
      const duplicate = await db.client.findUnique({
        where: { firmId_gstin: { firmId: existing.firmId ?? tenantId, gstin: updates.gstin } },
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
        firmId: client.firmId ?? tenantId,
        clientId: client.id,
        type: 'client_updated',
        description: `Client ${client.businessName} updated`,
      },
    })

    return NextResponse.json({ client })
  } catch (error) {
    console.error('PATCH /api/clients/[id] error:', error)
    return friendlyApiError(error, 'We could not update this client right now. Please try again.')
  }
}

// DELETE /api/clients/[id] — Delete client (cascades)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required' },
        { status: 400 }
      )
    }

    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    const { id } = await params

    const existing = await db.client.findUnique({ where: { id } })
    if (!existing || existing.firmId !== tenantId) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Create activity log before deletion
    await db.activity.create({
      data: {
        firmId: existing.firmId ?? tenantId,
        type: 'client_deleted',
        description: `Client ${existing.businessName} (${existing.gstin}) deleted`,
      },
    })

    // Delete client (cascades to related records)
    await db.client.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/clients/[id] error:', error)
    return friendlyApiError(error, 'We could not delete this client right now. Please try again.')
  }
}
