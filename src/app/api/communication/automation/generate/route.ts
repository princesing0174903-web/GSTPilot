// POST /api/communication/automation/generate — auto-generate reminders for
// overdue invoices + upcoming GST filings.
import { NextRequest, NextResponse } from 'next/server';
import { autoGenerateReminders } from '@/lib/communication-provider/server/automation-engine';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';
import type { ScheduledMessageChannel } from '@/lib/communication-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organizationId,
      gmailConnectionId,
      whatsappConnectionId,
      businessName,
      preferredChannel,
      createdBy,
    } = body as {
      organizationId?: string;
      gmailConnectionId?: string | null;
      whatsappConnectionId?: string | null;
      businessName?: string;
      preferredChannel?: ScheduledMessageChannel;
      createdBy?: { uid: string; name: string; email: string };
    };
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    const result = await autoGenerateReminders(organizationId, {
      gmailConnectionId: gmailConnectionId ?? null,
      whatsappConnectionId: whatsappConnectionId ?? null,
      businessName: businessName ?? 'Your Business',
      preferredChannel: preferredChannel ?? 'whatsapp',
      createdBy: createdBy ?? { uid: '', name: '', email: '' },
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/automation/generate] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
