import { NextResponse } from 'next/server';
import { createExpense } from '@/lib/gstpilot-data';
import type { CreateExpenseInput } from '@/lib/gstpilot-data';

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
    const input: CreateExpenseInput = {
      description: String(body.description),
      amount: Number(body.amount),
      vendorId: body.vendorId ?? null,
      vendorName: body.vendorName ?? body.vendor ?? '',
      category: body.category,
      gst: body.gst != null ? Number(body.gst) : undefined,
      gstClaimable: body.gstClaimable,
      date: body.date,
      paymentMode: body.paymentMode,
      status: body.status,
      referenceNo: body.referenceNo ?? null,
      notes: body.notes ?? null,
    };
    const expense = await createExpense(input);
    return NextResponse.json({
      success: true,
      expense,
      message: `I've recorded the ${expense.category} expense of ₹${expense.amount} — stored in Firestore.`,
    });
  } catch (err) {
    console.error('[API /expenses/create] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create expense' },
      { status: 500 },
    );
  }
}
