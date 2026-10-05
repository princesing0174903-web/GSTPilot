// POST /api/communication/whatsapp/disconnect
import { NextRequest, NextResponse } from 'next/server';
import { disconnectWhatsApp } from '@/lib/communication-provider/server/orchestrator';
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
    await disconnectWhatsApp(encryptedConnection);
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
