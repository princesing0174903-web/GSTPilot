// POST /api/bank/upi/connect
// Activate UPI Collect on a UPI-enabled account.

import { NextResponse } from 'next/server';
import { connectUPI } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const res = await connectUPI();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/upi/connect] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to connect UPI', detail: String(err) },
      { status: 500 },
    );
  }
}
