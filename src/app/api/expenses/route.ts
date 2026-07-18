import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoCategorize } from '@/lib/invoices/expenses'
import { graphEvents } from '@/lib/graph/live-update'
import { emitTimelineEvent } from '@/lib/timeline/emit'

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
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const category = searchParams.get('category')
    const organizationId = searchParams.get('organizationId') ?? searchParams.get('firmId')

    const where: Record<string, unknown> = {}
    if (clientId) {
      where.clientId = clientId
    } else if (organizationId) {
      where.client = { organizationId }
    } else {
      // No tenant scope — return empty rather than leak cross-tenant data
      return NextResponse.json({ expenses: [] })
    }
    if (category) where.category = category

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ expenses: expenses ?? [] })
  } catch (error) {
    console.error('GET /api/expenses error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

// POST /api/expenses — Record a new Expense
export async function POST(request: NextRequest) {
  try {
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
    const orgId = await resolveOrgForExpense(request, body ?? {})
    if (orgId) {
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create expense' },
      { status: 500 }
    )
  }
}

// PATCH /api/expenses?id=XXX — Update an existing expense
export async function PATCH(request: NextRequest) {
  try {
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

    return NextResponse.json({ expense })
  } catch (error) {
    console.error('PATCH /api/expenses error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update expense' },
      { status: 500 }
    )
  }
}

// DELETE /api/expenses?id=XXX — Delete an expense
export async function DELETE(request: NextRequest) {
  try {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/expenses error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete expense' },
      { status: 500 }
    )
  }
}
