// POST /api/bank/collections/recover
// Run a collections recovery pass — try to recover open cases.

import { NextResponse } from 'next/server';
import { recoverCollections } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const res = await recoverCollections();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/collections/recover] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to run collections recovery', detail: String(err) },
      { status: 500 },
    );
  }
}
