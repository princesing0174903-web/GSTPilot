// GET /api/bank/reconciliation
// Returns the full reconciliation state — match rate, mismatches, risk score, entries.
// POST /api/bank/reconciliation — runs a fresh reconciliation pass.

import { NextResponse } from 'next/server';
import { buildReconciliationState, runReconciliation } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const reconciliation = await buildReconciliationState();
    return NextResponse.json({ ok: true, reconciliation });
  } catch (err) {
    console.error('[bank/reconciliation] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load reconciliation', detail: String(err) },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const res = await runReconciliation();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/reconciliation] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to run reconciliation', detail: String(err) },
      { status: 500 },
    );
  }
}
