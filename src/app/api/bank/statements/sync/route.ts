// POST /api/bank/statements/sync
// Trigger a manual statement sync (alias for /api/bank/accounts/sync).

import { NextResponse } from 'next/server';
import { syncStatements } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const res = await syncStatements();
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/statements/sync] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to sync statements', detail: String(err) },
      { status: 500 },
    );
  }
}
