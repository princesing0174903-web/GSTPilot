// POST /api/bank/upi/sync
// Sync UPI transactions — pull new + settle pending.

import { NextResponse } from 'next/server';
import { syncUPI } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const res = await syncUPI();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/upi/sync] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to sync UPI', detail: String(err) },
      { status: 500 },
    );
  }
}
