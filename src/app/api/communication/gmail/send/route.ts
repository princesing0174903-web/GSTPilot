// POST /api/communication/gmail/send — send an email via Gmail.
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/communication-provider/server/orchestrator';
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
      cc,
      bcc,
      subject,
      bodyHtml,
      bodyText,
      attachments,
      replyToMessageId,
    } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedConnection?: string;
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      bodyHtml?: string;
      bodyText?: string;
      attachments?: unknown[];
      replyToMessageId?: string;
    };
    if (!organizationId || !connectionId || !encryptedConnection) {
      return NextResponse.json(
        { ok: false, error: 'organizationId, connectionId, and encryptedConnection are required' },
        { status: 400 },
      );
    }
    if (!to || !subject || !bodyHtml) {
      return NextResponse.json(
        { ok: false, error: 'to, subject, and bodyHtml are required' },
        { status: 400 },
      );
    }
    const result = await sendEmail(organizationId, connectionId, encryptedConnection, {
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
      bodyText,
      attachments: Array.isArray(attachments) ? (attachments as never[]) : undefined,
      replyToMessageId,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/gmail/send] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
