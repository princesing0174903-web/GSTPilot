// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Gmail & WhatsApp Business Automation™ — Connect Gmail API
//
// POST /api/communication/gmail/connect
//   Body: { organizationId, email, displayName?, createdBy }
//   Returns: { ok: true, result: ConnectGmailResult, complete: CompleteGmailConnectionResult }
//
// For the mock provider, connect + complete happen in one shot. For Google,
// the client would call /connect first (which returns the OAuth URL), redirect
// the user, then call /complete after the OAuth callback.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { connectGmail, completeGmailConnection } from '@/lib/communication-provider/server/orchestrator';
import { getGmailProviderName } from '@/lib/communication-provider/server/registry';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';
import type { GmailProviderName } from '@/lib/communication-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, email, displayName, provider, createdBy } = body as {
      organizationId?: string;
      email?: string;
      displayName?: string;
      provider?: GmailProviderName;
      createdBy?: { uid: string; name: string; email: string };
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'A valid email address is required.' },
        { status: 400 },
      );
    }

    const providerName: GmailProviderName = provider ?? getGmailProviderName();

    const result = await connectGmail({
      organizationId,
      email: email.trim().toLowerCase(),
      displayName: displayName?.trim() || undefined,
      createdBy: createdBy ?? { uid: '', name: '', email: email.trim().toLowerCase() },
    });

    let complete: {
      encryptedConnection: string;
      sessionExpiry: string;
      scopes: string[];
      profile: { email: string; displayName: string | null };
    } | null = null;
    try {
      complete = await completeGmailConnection(organizationId, result.connectionRef);
    } catch (err) {
      console.warn('[api/communication/gmail/connect] complete deferred:', friendlyCommunicationError(err));
    }

    return NextResponse.json({ ok: true, result, complete, provider: providerName });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/gmail/connect] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
