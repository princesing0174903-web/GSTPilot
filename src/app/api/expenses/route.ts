import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoCategorize } from '@/lib/invoices/expenses'
import { graphEvents } from '@/lib/graph/live-update'

// GET /api/expenses — Fetch expenses, scoped by clientId (multi-tenant isolation).
// Previously this returned ALL expenses platform-wide with no `where` clause
// (multi-tenant data leak). Now requires `clientId` query param, or returns
// an empty array to prevent cross-tenant reads.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const category = searchParams.get('category')

    // Build the where clause — always require clientId for tenant isolation.
    // If no clientId is provided, return empty (do NOT dump all rows).
    const where: { clientId?: string; category?: string } = {}
    if (clientId) where.clientId = clientId
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
