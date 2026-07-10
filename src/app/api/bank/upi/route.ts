// GET /api/bank/upi
// Returns the UPI state — collections, payments, top customers, transactions.

import { NextResponse } from 'next/server';
import { buildUPIState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const upi = await buildUPIState();
    return NextResponse.json({ ok: true, upi });
  } catch (err) {
    console.error('[bank/upi] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load UPI state', detail: String(err) },
      { status: 500 },
    );
  }
}
