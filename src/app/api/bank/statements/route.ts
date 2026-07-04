// GET /api/bank/statements
// Returns the bank statement sync summary (totals, 30d flow, recent txns).

import { NextResponse } from 'next/server';
import { buildAccountsState, buildStatementsState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await buildAccountsState();
    const statements = await buildStatementsState(accounts);
    return NextResponse.json({ ok: true, statements });
  } catch (err) {
    console.error('[bank/statements] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load statements', detail: String(err) },
      { status: 500 },
    );
  }
}
