import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-tenant scoping — P3-AUTH-FIX
//
// The Activity model has a DIRECT `firmId` column (unlike Invoice/PurchaseBill
// which scope through Client.firmId). All queries are scoped via
// `where.firmId = tenantId`. Mirrors /api/returns GET/POST pattern.
//
// Before this fix, GET read `firmId` from a spoofable query param with NO auth,
// and POST created activities with `firmId` from the body — anyone could read
// or write any org's activity feed.
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/activities — List activities with optional filters
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
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // ── Defensive empty-state: no tenant scope → no data ──
    if (!tenantId) {
      return NextResponse.json({
        activities: [],
        pagination: { total: 0, limit, offset, hasMore: false },
      })
    }

    // ── 2. AUTHORIZATION — verify org membership ───────────────────────────
    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    // Scope via the Activity's direct firmId field.
    const where: Record<string, unknown> = { firmId: tenantId }
    if (clientId) where.clientId = clientId
    if (type) where.type = type

    const [activities, total] = await Promise.all([
      db.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.activity.count({ where }),
    ])

    return NextResponse.json({
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('GET /api/activities error:', error)
    return friendlyApiError(error, 'We could not load your activity feed right now. Please try again.')
  }
}

// POST /api/activities — Create a new activity
export async function POST(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const body = await request.json()
    const { firmId, clientId, userId, type, description, metadata } = body

    if (!firmId || !type || !description) {
      return NextResponse.json(
        { error: 'firmId, type, and description are required' },
        { status: 400 }
      )
    }

    // ── 2. AUTHORIZATION — verify org membership before creating ──────────
    const memberResult = await requireOrgMembership(uid, firmId)
    if (memberResult instanceof NextResponse) return memberResult

    const activity = await db.activity.create({
      data: {
        firmId,
        clientId: clientId ?? null,
        userId: userId ?? null,
        type,
        description,
        metadata: metadata ?? null,
      },
    })

    return NextResponse.json({ activity }, { status: 201 })
  } catch (error) {
    console.error('POST /api/activities error:', error)
    return friendlyApiError(error, 'We could not create the activity right now. Please try again.')
  }
}
