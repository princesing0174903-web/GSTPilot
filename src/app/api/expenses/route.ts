import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoCategorize } from '@/lib/invoices/expenses'
import { graphEvents } from '@/lib/graph/live-update'
import { emitTimelineEvent } from '@/lib/timeline/emit'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot'

/** Resolve orgId for an expense from header, body, or Client.firmId lookup. */
async function resolveOrgForExpense(
  req: NextRequest,
  body: { organizationId?: string; firmId?: string; clientId?: string },
): Promise<string | null> {
  const headerOrg = req.headers.get('x-gstpilot-orgid')
  if (headerOrg && headerOrg.trim()) return headerOrg.trim()
  const bodyOrg = body.organizationId || body.firmId
  if (bodyOrg && typeof bodyOrg === 'string' && bodyOrg.trim()) return bodyOrg.trim()
  if (body.clientId) {
    try {
      const client = await db.client.findUnique({
        where: { id: body.clientId },
        select: { firmId: true },
      })
      if (client?.firmId) return client.firmId
    } catch {
      /* ignore — best-effort */
    }
  }
  return null
}

/** Parse the `x-gstpilot-actor` request header (JSON { uid, email }). */
function parseActorHeader(req: NextRequest): { userId?: string; userName?: string } | undefined {
  const raw = req.headers.get('x-gstpilot-actor')
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as { uid?: string; email?: string; displayName?: string }
    if (!parsed.uid && !parsed.email) return undefined
    return { userId: parsed.uid, userName: parsed.displayName ?? parsed.email }
  } catch {
    return undefined
  }
}

// GET /api/expenses — Fetch expenses, tenant-scoped.
// Accepts organizationId (preferred) or clientId. If NEITHER is provided,
// returns empty (prevents cross-tenant data leak).
export async function GET(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const category = searchParams.get('category')
    const organizationId = searchParams.get('organizationId') ?? searchParams.get('firmId')

    const where: Record<string, unknown> = {}
    if (clientId) {
      where.clientId = clientId
    } else if (organizationId) {
      // Tenant scoping is via the client relation's firmId (same model as
      // /api/invoices). The organizationId/firmId are the same tenant id.
      where.client = { firmId: organizationId }
    } else {
      // No tenant scope — return empty rather than leak cross-tenant data
      return NextResponse.json({ expenses: [] })
    }

    // ── 2. AUTHORIZATION — when an orgId is available, verify membership ────
    // (When only a clientId is provided, the resource is uniquely identified,
    //  so we skip the org-membership check — same trust model as before.)
    if (organizationId) {
      const memberResult = await requireOrgMembership(uid, organizationId)
      if (memberResult instanceof NextResponse) return memberResult
    }

    if (category) where.category = category

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ expenses: expenses ?? [] })
  } catch (error) {
    console.error('GET /api/expenses error:', error)
    return friendlyApiError(error, 'We could not load your expenses right now. Please try again.')
  }
}

// POST /api/expenses — Record a new Expense
export async function POST(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const body = await request.json()
    const {
      clientId,
      category,
      description,
      vendor,
      amount,
      gst,
      date,
      paymentMode,
      notes,
    } = body ?? {}

    if (amount === undefined || !date) {
      return NextResponse.json(
        { error: 'amount and date are required' },
        { status: 400 }
      )
    }

    // ── 2. AUTHORIZATION — verify membership when an orgId can be resolved ──
    // Resolve the orgId early via the existing helper so we can gate the write.
    // The same orgId is reused below for the timeline emit (no double-resolve).
    const orgId = await resolveOrgForExpense(request, body ?? {})
    if (orgId) {
      const memberResult = await requireOrgMembership(uid, orgId)
      if (memberResult instanceof NextResponse) return memberResult
    }

    // Auto-categorize when category not provided
    const finalCategory =
      category && typeof category === 'string'
        ? category
        : autoCategorize(String(description ?? ''), String(vendor ?? ''))

    const expense = await db.expense.create({
      data: {
        clientId: clientId ?? null,
        category: finalCategory,
        description: description ?? null,
        vendor: vendor ?? null,
        amount: Number(amount) || 0,
        gst: Number(gst) || 0,
        gstClaimable: (Number(gst) || 0) > 0,
        date,
        paymentMode: paymentMode ?? null,
        status: 'recorded',
        receiptUrl: null,
        ocrExtracted: false,
        notes: notes ?? null,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'Expense Recorded',
        entity: 'expense',
        entityId: expense.id,
        details: `Expense ₹${expense.amount} (${finalCategory}) recorded — ${vendor ?? 'unknown vendor'}`,
      },
    })

    // ── Real Business Graph Engine™ — auto-create expense node + live event ──
    graphEvents.expenseRecorded(expense.id, vendor ?? 'unknown', expense.amount, finalCategory)

    // ── Business Timeline — emit expense.created (fire-and-forget) ──
    // orgId was resolved above for the membership check; reuse it here.
    if (orgId) {
      // Unified SaaS: invalidate the canonical Business Snapshot cache so
      // expenses, profit, and cash flow reflect the new expense immediately.
      invalidateBusinessSnapshotCache(orgId)

      await emitTimelineEvent({
        organizationId: orgId,
        type: 'expense.created',
        title: `Expense ₹${expense.amount.toLocaleString('en-IN')} recorded`,
        description: `${finalCategory}${vendor ? ` — ${vendor}` : ''}${description ? `: ${description}` : ''}.`,
        actor: parseActorHeader(request),
        metadata: {
          expenseId: expense.id,
          amount: expense.amount,
          gst: expense.gst,
          category: finalCategory,
          vendor: vendor ?? null,
          date,
          paymentMode: paymentMode ?? null,
          clientId: clientId ?? null,
        },
        severity: 'info',
      });
    }

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('POST /api/expenses error:', error)
    return friendlyApiError(error, 'We could not record the expense right now. Please try again.')
  }
}

// PATCH /api/expenses?id=XXX — Update an existing expense
export async function PATCH(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'category', 'description', 'vendor', 'amount', 'gst', 'gstClaimable',
      'date', 'paymentMode', 'status', 'receiptUrl', 'notes', 'clientId',
    ]
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === 'amount' || field === 'gst'
          ? Number(body[field])
          : body[field]
      }
    }

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
    })

    await db.auditLog.create({
      data: {
        clientId: expense.clientId,
        action: 'Expense Updated',
        entity: 'expense',
        entityId: expense.id,
        details: `Expense ₹${expense.amount} (${expense.category}) updated`,
      },
    })

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    await invalidateSnapshotForExpense(expense)

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('PATCH /api/expenses error:', error)
    return friendlyApiError(error, 'We could not update the expense right now. Please try again.')
  }
}

// DELETE /api/expenses?id=XXX — Delete an expense
export async function DELETE(request: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    const expense = await db.expense.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        clientId: expense.clientId,
        action: 'Expense Deleted',
        entity: 'expense',
        entityId: expense.id,
        details: `Expense ₹${expense.amount} (${expense.category}) deleted`,
      },
    })

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    await invalidateSnapshotForExpense(expense)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/expenses error:', error)
    return friendlyApiError(error, 'We could not delete the expense right now. Please try again.')
  }
}

// Helper: invalidate snapshot cache for the org that owns the expense's client.
async function invalidateSnapshotForExpense(expense: { clientId?: string | null }): Promise<void> {
  if (!expense.clientId) return
  const client = await db.client.findUnique({
    where: { id: expense.clientId },
    select: { firmId: true },
  }).catch(() => null)
  if (client?.firmId) {
    invalidateBusinessSnapshotCache(client.firmId)
  }
}
