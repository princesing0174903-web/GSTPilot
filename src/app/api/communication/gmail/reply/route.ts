// POST /api/communication/gmail/reply — reply to an existing email thread.
import { NextRequest, NextResponse } from 'next/server';
import { replyEmail } from '@/lib/communication-provider/server/orchestrator';
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
      subject,
      bodyHtml,
      bodyText,
      replyToMessageId,
      attachments,
    } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedConnection?: string;
      to?: string;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      replyToMessageId?: string;
      attachments?: unknown[];
    };
    if (!organizationId || !connectionId || !encryptedConnection) {
      return NextResponse.json(
        { ok: false, error: 'organizationId, connectionId, and encryptedConnection are required' },
        { status: 400 },
      );
    }
    if (!to || !subject || !bodyHtml || !replyToMessageId) {
      return NextResponse.json(
        { ok: false, error: 'to, subject, bodyHtml, and replyToMessageId are required' },
        { status: 400 },
      );
    }
    const result = await replyEmail(organizationId, connectionId, encryptedConnection, {
      to,
      subject,
      bodyHtml,
      bodyText,
      replyToMessageId,
      attachments: Array.isArray(attachments) ? (attachments as never[]) : undefined,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/gmail/reply] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
