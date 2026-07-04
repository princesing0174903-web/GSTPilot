// POST /api/communication/whatsapp/reply
import { NextRequest, NextResponse } from 'next/server';
import { replyWhatsApp } from '@/lib/communication-provider/server/orchestrator';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organizationId,
      connectionId,
      encryptedConnection,
      to,
      body: msgBody,
      replyToMessageId,
      clientId,
    } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedConnection?: string;
      to?: string;
      body?: string;
      replyToMessageId?: string;
      clientId?: string | null;
    };
    if (!organizationId || !connectionId || !encryptedConnection) {
      return NextResponse.json(
        { ok: false, error: 'organizationId, connectionId, and encryptedConnection are required' },
        { status: 400 },
      );
    }
    if (!to || !msgBody) {
      return NextResponse.json({ ok: false, error: 'to and body are required' }, { status: 400 });
    }
    const result = await replyWhatsApp(organizationId, connectionId, encryptedConnection, {
      to,
      body: msgBody,
      replyToMessageId,
      clientId: clientId ?? null,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/whatsapp/reply] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
