// POST /api/execution-cloud/banking
// Execute a banking action (sync/collect/fetch/reconcile).
//
// NOTE: The real banking provider (settlement/bank-statement aggregator, UPI
// collect, Account Aggregator, bank reconciliation engine) is NOT configured
// in this environment. Previously this route fabricated UTR numbers, fake
// matched-invoice numbers, a hardcoded "Reliance Retail Ltd" matchedTo, and
// Math.random confidence values — all pure mock. That fake success was a
// data-integrity landmine: the UI displayed fabricated reconciliations as if
// real. We now return an honest 501 so the UI can surface a clear "provider
// not configured" message instead of fake data.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NOT_CONFIGURED = {
  error: 'Banking reconciliation provider not configured in this environment',
  capability: 'banking',
  provider: 'unset',
} as const;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { capability, action } = (body ?? {}) as { capability?: string; action?: string };
  if (!capability || !action) {
    return NextResponse.json(
      { error: 'capability and action are required' },
      { status: 400 }
    );
  }

  // No provider wired — return 501 with a clear, honest message.
  // We do NOT fabricate UTRs, invoice matches, or confidence scores.
  return NextResponse.json(
    {
      ...NOT_CONFIGURED,
      action,
      message: `Banking action '${action}' could not be executed — no provider is configured.`,
    },
    { status: 501 }
  );
}
