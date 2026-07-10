// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Refresh API
//
// POST /api/banking/refresh
//   Body: { encryptedConnection }
//   Returns: { ok: true, result: RefreshConnectionResult }
//
// Refreshes an expired bank connection (consent / token) using the refresh
// token. The client passes the encrypted connection blob; the server decrypts,
// refreshes, and returns a new encrypted blob.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { refreshBankConnection } from '@/lib/banking-provider/server/orchestrator';
import { BankingError, friendlyBankingError } from '@/lib/banking-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { encryptedConnection } = body as { encryptedConnection?: string };

    if (!encryptedConnection) {
      return NextResponse.json(
        { ok: false, error: 'encryptedConnection is required.' },
        { status: 400 },
      );
    }

    const result = await refreshBankConnection(encryptedConnection);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BankingError ? err.statusCode : 500;
    const code = err instanceof BankingError ? err.code : 'UNKNOWN';
    console.error('[api/banking/refresh] error:', code, friendlyBankingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBankingError(err), code },
      { status: statusCode },
    );
  }
}
