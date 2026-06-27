import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedExpenses, autoCategorize } from '@/lib/invoices/expenses'
import { graphEvents } from '@/lib/graph/live-update'

// GET /api/expenses — Fetch all Expenses
export async function GET() {
  try {
    const expenses = await db.expense.findMany({
      orderBy: { date: 'desc' },
    })

    if (!expenses || expenses.length === 0) {
      return NextResponse.json({ expenses: seedExpenses() })
    }

    return NextResponse.json({ expenses })
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
