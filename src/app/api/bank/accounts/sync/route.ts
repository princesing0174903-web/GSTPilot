// POST /api/bank/accounts/sync
// Trigger a manual sync of all bank accounts (or one by accountId).

import { NextResponse } from 'next/server';
import { syncBankAccounts } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { accountId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // No body — sync all
  }
  try {
    const res = await syncBankAccounts(body.accountId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/accounts/sync] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to sync bank accounts', detail: String(err) },
      { status: 500 },
    );
  }
}
