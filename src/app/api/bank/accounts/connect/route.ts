// POST /api/bank/accounts/connect
// Connect a new bank account.

import { NextResponse } from 'next/server';
import { connectBankAccount } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { bankName?: string; accountType?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — we'll pick a random bank
  }
  try {
    const res = await connectBankAccount(body);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    console.error('[bank/accounts/connect] POST failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to connect bank account', detail: String(err) },
      { status: 500 },
    );
  }
}
