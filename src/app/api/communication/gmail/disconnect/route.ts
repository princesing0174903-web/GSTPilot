// POST /api/communication/gmail/disconnect — invalidate the Gmail session server-side.
import { NextRequest, NextResponse } from 'next/server';
import { disconnectGmail } from '@/lib/communication-provider/server/orchestrator';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { encryptedConnection } = body as { encryptedConnection?: string };
    if (!encryptedConnection) {
      return NextResponse.json({ ok: false, error: 'encryptedConnection is required' }, { status: 400 });
    }
    await disconnectGmail(encryptedConnection);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
