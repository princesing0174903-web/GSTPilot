// POST /api/communication/whatsapp/send
import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/communication-provider/server/orchestrator';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';
import type { WhatsAppCategory } from '@/lib/communication-provider/types';

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
      messageType,
      body: msgBody,
      mediaUrl,
      caption,
      templateName,
      templateParams,
      category,
      clientId,
      invoiceId,
    } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedConnection?: string;
      to?: string;
      messageType?: 'text' | 'template' | 'document' | 'image';
      body?: string;
      mediaUrl?: string;
      caption?: string;
      templateName?: string;
      templateParams?: string[];
      category?: WhatsAppCategory;
      clientId?: string | null;
      invoiceId?: string | null;
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
    const result = await sendWhatsAppMessage(organizationId, connectionId, encryptedConnection, {
      to,
      messageType: messageType ?? 'text',
      body: msgBody,
      mediaUrl,
      caption,
      templateName,
      templateParams,
      category,
      clientId: clientId ?? null,
      invoiceId: invoiceId ?? null,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/whatsapp/send] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
