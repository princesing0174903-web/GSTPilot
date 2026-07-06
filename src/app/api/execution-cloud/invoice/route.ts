// POST /api/execution-cloud/invoice
// Create a real invoice/expense/TDS/payroll record via the Execution Cloud.
//
// NOTE: This route previously fabricated `INV-2025-${Math.floor(4300 +
// Math.random()*700)}` invoice numbers, returned a fake InvoiceRecord, and
// persisted nothing to the DB. That fake success was a data-integrity
// landmine: the UI displayed invoices that didn't actually exist. The real
// Execution Cloud invoice provider is NOT configured in this environment, so
// we now return an honest 501. Real invoice creation goes through
// POST /api/invoices (which writes to Prisma).

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NOT_CONFIGURED = {
  error: 'Execution Cloud invoice provider not configured in this environment',
  capability: 'invoice',
  provider: 'unset',
} as const;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, party, amountINR } = (body ?? {}) as {
    type?: string;
    party?: string;
    amountINR?: number;
  };
  if (!type || !party || !amountINR) {
    return NextResponse.json(
      { error: 'type, party, and amountINR are required' },
      { status: 400 }
    );
  }

  // No provider wired — return 501 with a clear, honest message.
  // We do NOT fabricate invoice numbers.
  return NextResponse.json(
    {
      ...NOT_CONFIGURED,
      type,
      party,
      amountINR,
      message: `Invoice creation for ${party} could not be executed — no Execution Cloud provider is configured. Use POST /api/invoices for real invoice creation.`,
    },
    { status: 501 }
  );
}
