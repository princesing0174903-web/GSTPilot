// POST /api/communication/automation/cancel — cancel a scheduled message.
import { NextRequest, NextResponse } from 'next/server';
import { cancelScheduledMessage } from '@/lib/communication-provider/server/automation-engine';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, scheduleId } = body as { organizationId?: string; scheduleId?: string };
    if (!organizationId || !scheduleId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId and scheduleId are required' },
        { status: 400 },
      );
    }
    await cancelScheduledMessage(organizationId, scheduleId);
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
