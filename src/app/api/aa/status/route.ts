// GET /api/aa/status
// Returns the Account Aggregator status — connections, consents, linked accounts.

import { NextResponse } from 'next/server';
import { buildAAState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const aa = await buildAAState();
    return NextResponse.json({ ok: true, aa });
  } catch (err) {
    console.error('[aa/status] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load AA status', detail: String(err) },
      { status: 500 },
    );
  }
}
