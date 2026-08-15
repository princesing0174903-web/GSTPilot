// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Complete Bank Connection (AA deferred-completion step)
//
// POST /api/banking/complete?connectionRef=<consentId>
//
// Finalizes a bank connection that was initiated with a deferred-completion
// provider (Setu AA). The frontend calls this after the user returns from
// the Setu consent webview. It:
//   1. Calls provider.completeConnection(connectionRef) — which polls the
//      Setu consent status and creates a data session when ACTIVE.
//   2. Returns the encrypted connection + snapshot so the client can persist
//      the connection doc.
//
// Returns:
//   200 { ok, complete: { encryptedConnection, consentExpiry, accountSnapshot } }
//   409 { ok:false, code:'CONSENT_PENDING' } — consent not approved yet
//   410 { ok:false, code:'CONSENT_REJECTED' } — consent was rejected/expired
//   503 { ok:false, code:'SETU_NOT_CONFIGURED' } — Setu env vars missing
//
// Auth: requireAuth + requireOrgMembership.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { completeBankConnection } from '@/lib/banking-provider/server/orchestrator';
import { BankingError, friendlyBankingError } from '@/lib/banking-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const url = new URL(req.url);
    const connectionRef = url.searchParams.get('connectionRef');
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const orgId =
      url.searchParams.get('organizationId') ||
      (body as { organizationId?: string }).organizationId ||
      '';

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required (query or body).' },
        { status: 400 },
      );
    }

    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    if (!connectionRef) {
      return NextResponse.json(
        { ok: false, error: 'connectionRef (consentId) is required as a query param.' },
        { status: 400 },
      );
    }

    const completed = await completeBankConnection(orgId, connectionRef);

    // Update the SetuConsent row to reflect the completed connection.
    try {
      const { db } = await import('@/lib/db');
      await db.setuConsent.updateMany({
        where: { consentId: connectionRef },
        data: { status: 'ACTIVE', approvedAt: new Date() },
      });
    } catch {
      // Non-fatal.
    }

    return NextResponse.json({
      ok: true,
      complete: {
        encryptedConnection: completed.encryptedConnection,
        consentExpiry: completed.consentExpiry,
        accountSnapshot: completed.accountSnapshot,
      },
    });
  } catch (err) {
    const statusCode = err instanceof BankingError ? err.statusCode : 500;
    const code = err instanceof BankingError ? err.code : 'UNKNOWN';
    console.error('[api/banking/complete] error:', code, friendlyBankingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBankingError(err), code },
      { status: statusCode },
    );
  }
}
