// POST /api/communication/gmail/sync — sync emails from Gmail.
import { NextRequest, NextResponse } from 'next/server';
import { syncEmails } from '@/lib/communication-provider/server/orchestrator';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, connectionId, encryptedConnection, from, to, maxResults } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedConnection?: string;
      from?: string;
      to?: string;
      maxResults?: number;
    };
    if (!organizationId || !connectionId || !encryptedConnection) {
      return NextResponse.json(
        { ok: false, error: 'organizationId, connectionId, and encryptedConnection are required' },
        { status: 400 },
      );
    }
    const result = await syncEmails(organizationId, connectionId, encryptedConnection, {
      from,
      to,
      maxResults,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/gmail/sync] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
