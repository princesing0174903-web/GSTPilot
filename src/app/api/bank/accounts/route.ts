// GET /api/bank/accounts
// Returns all connected bank accounts with balances, types, AA consent and last sync.

import { NextResponse } from 'next/server';
import { buildAccountsState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await buildAccountsState();
    return NextResponse.json({
      ok: true,
      accountCount: accounts.length,
      totalBalance: accounts.reduce((s, a) => s + a.currentBalance, 0),
      totalAvailable: accounts.reduce((s, a) => s + a.availableBalance, 0),
      accounts,
    });
  } catch (err) {
    console.error('[bank/accounts] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load bank accounts', detail: String(err) },
      { status: 500 },
    );
  }
}
