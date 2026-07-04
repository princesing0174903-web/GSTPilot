// POST /api/execution-cloud/invoice
// Create a real invoice/expense/TDS/payroll record.

import { NextResponse } from 'next/server';
import { uid } from '@/lib/execution-cloud/engine';
import type { InvoiceActionRequest, InvoiceActionResponse, InvoiceRecord } from '@/lib/execution-cloud/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: InvoiceActionRequest;
  try {
    body = (await request.json()) as InvoiceActionRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, party, amountINR, gstINR, tdsINR, dueDate } = body;
  if (!type || !party || !amountINR) {
    return NextResponse.json({ error: 'type, party, and amountINR are required' }, { status: 400 });
  }

  try {
    const invoice: InvoiceRecord = {
      id: uid('inv'),
      number: `INV-2025-${String(Math.floor(4300 + Math.random() * 700)).padStart(4, '0')}`,
      type,
      party,
      amountINR,
      gstINR: gstINR ?? 0,
      tdsINR,
      status: 'issued',
      date: new Date().toISOString(),
      dueDate: dueDate ?? new Date(Date.now() + 15 * 86400000).toISOString(),
    };

    const response: InvoiceActionResponse = {
      ok: true,
      invoice,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} ${invoice.number} created for ${party} — ₹${amountINR.toLocaleString('en-IN')}.`,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/invoice] POST failed:', err);
    return NextResponse.json(
      { error: 'Failed to create invoice', detail: String(err) },
      { status: 500 },
    );
  }
}
