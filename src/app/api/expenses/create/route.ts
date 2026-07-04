import { NextResponse } from 'next/server';
import { createExpense } from '@/lib/invoices/expenses';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.description || body.amount == null) {
      return NextResponse.json(
        { error: 'description and amount are required' },
        { status: 400 },
      );
    }
    const expense = await createExpense(body);
    return NextResponse.json({
      success: true,
      expense,
      message: `I've recorded the ${expense.category} expense of ${expense.amount} — auto-categorised.`,
    });
  } catch (err) {
    console.error('[API /expenses/create] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create expense' },
      { status: 500 },
    );
  }
}
