// POST /api/execution-cloud/gstn
// Execute a GSTN action (file/fetch/generate/search/verify).
//
// NOTE: The real GSTN provider (live filing API, GSTR fetch, GSTIN search,
// PAN verification) is NOT configured in this environment. Previously this
// route fabricated `ACK${Math.floor(100000 + Math.random()*899999)}` numbers
// and returned canned "Filed GSTR-1" success messages with no actual filing
// or DB write. That fake success was a data-integrity landmine: the UI showed
// acknowledgements as if real filings happened. We now return an honest 501.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NOT_CONFIGURED = {
  error: 'GSTN provider not configured in this environment',
  capability: 'gstn',
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
  // We do NOT fabricate acknowledgement numbers.
  return NextResponse.json(
    {
      ...NOT_CONFIGURED,
      action,
      message: `GSTN action '${action}' could not be executed — no provider is configured.`,
    },
    { status: 501 }
  );
}
