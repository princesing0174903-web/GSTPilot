// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Connect API
//
// POST /api/banking/connect
//   Body: { organizationId, provider?, accountHolder, bankName, accountNumber,
//           ifsc, accountType, createdBy }
//   Returns: { ok: true, result: ConnectBankResult, complete: CompleteConnectionResult }
//
// For the mock provider, connect + completeConnection happen in one shot (no
// real consent flow). For AA providers, the client would call /connect first,
// wait for the user to approve consent, then call /complete separately. The
// mock path is optimized to do both in a single request so the UI is instant.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { connectBank, completeBankConnection } from '@/lib/banking-provider/server/orchestrator';
import { getProviderName } from '@/lib/banking-provider/server/registry';
import { BankingError, friendlyBankingError } from '@/lib/banking-provider/errors';
import type { BankProviderName } from '@/lib/banking-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organizationId,
      provider,
      accountHolder,
      bankName,
      accountNumber,
      ifsc,
      accountType,
      createdBy,
    } = body as {
      organizationId?: string;
      provider?: BankProviderName;
      accountHolder?: string;
      bankName?: string;
      accountNumber?: string;
      ifsc?: string;
      accountType?: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
      createdBy?: { uid: string; name: string; email: string };
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (!accountHolder || accountHolder.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: 'Account holder name must be at least 2 characters.' },
        { status: 400 },
      );
    }
    if (!accountNumber || accountNumber.replace(/\s+/g, '').length < 4) {
      return NextResponse.json(
        { ok: false, error: 'A valid account number is required.' },
        { status: 400 },
      );
    }
    if (!ifsc || ifsc.trim().length < 8) {
      return NextResponse.json(
        { ok: false, error: 'A valid IFSC code is required.' },
        { status: 400 },
      );
    }

    const providerName: BankProviderName = provider ?? getProviderName();

    // Step 1: initiate the connection via the provider.
    const result = await connectBank({
      organizationId,
      provider: providerName,
      accountHolder: accountHolder.trim(),
      bankName: bankName?.trim() ?? '',
      accountNumber: accountNumber.trim(),
      ifsc: ifsc.trim().toUpperCase(),
      accountType: accountType ?? 'unknown',
      createdBy: createdBy ?? { uid: '', name: accountHolder.trim(), email: '' },
    });

    // Step 2: complete the connection (for mock this is instant; for AA the
    // client would call /complete separately after consent approval).
    let complete: { encryptedConnection: string; consentExpiry: string; accountSnapshot: unknown } | null = null;
    try {
      const completed = await completeBankConnection(organizationId, result.connectionRef);
      complete = {
        encryptedConnection: completed.encryptedConnection,
        consentExpiry: completed.consentExpiry,
        accountSnapshot: completed.accountSnapshot,
      };
    } catch (err) {
      // If completion fails (e.g. AA consent still pending), return just the
      // connect result so the client can poll /complete later.
      console.warn('[api/banking/connect] completeConnection deferred:', friendlyBankingError(err));
    }

    return NextResponse.json({ ok: true, result, complete });
  } catch (err) {
    const statusCode = err instanceof BankingError ? err.statusCode : 500;
    const code = err instanceof BankingError ? err.code : 'UNKNOWN';
    console.error('[api/banking/connect] error:', code, friendlyBankingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBankingError(err), code },
      { status: statusCode },
    );
  }
}
