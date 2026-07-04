// POST /api/communication/automation/schedule
//   Schedule a new message (one-time or recurring).
import { NextRequest, NextResponse } from 'next/server';
import { scheduleMessage } from '@/lib/communication-provider/server/automation-engine';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';
import type {
  EmailCategory,
  ScheduledMessageChannel,
  ScheduleRecurrence,
  WhatsAppCategory,
} from '@/lib/communication-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organizationId,
      channel,
      connectionId,
      recipient,
      recipientName,
      subject,
      body: msgBody,
      category,
      trigger,
      linkedEntityId,
      linkedEntityType,
      scheduledFor,
      recurrence,
      createdBy,
    } = body as {
      organizationId?: string;
      channel?: ScheduledMessageChannel;
      connectionId?: string;
      recipient?: string;
      recipientName?: string;
      subject?: string;
      body?: string;
      category?: WhatsAppCategory | EmailCategory;
      trigger?: 'invoice_reminder' | 'gst_filing' | 'payment_followup' | 'recurring' | 'manual';
      linkedEntityId?: string;
      linkedEntityType?: 'invoice' | 'return' | 'client' | 'payment' | null;
      scheduledFor?: string;
      recurrence?: ScheduleRecurrence;
      createdBy?: { uid: string; name: string; email: string };
    };

    if (!organizationId || !channel || !connectionId || !recipient || !msgBody || !scheduledFor) {
      return NextResponse.json(
        { ok: false, error: 'organizationId, channel, connectionId, recipient, body, and scheduledFor are required' },
        { status: 400 },
      );
    }

    const scheduleId = await scheduleMessage({
      organizationId,
      channel,
      connectionId,
      recipient,
      recipientName: recipientName ?? null,
      subject: subject ?? null,
      body: msgBody,
      category: category ?? 'general',
      trigger: trigger ?? 'manual',
      linkedEntityId: linkedEntityId ?? null,
      linkedEntityType: linkedEntityType ?? null,
      scheduledFor,
      recurrence,
      createdBy: createdBy ?? { uid: '', name: '', email: '' },
    });

    return NextResponse.json({ ok: true, scheduleId });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/automation/schedule] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
