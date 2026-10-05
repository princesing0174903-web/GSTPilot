// POST /api/communication/automation/retry — retry all failed scheduled messages.
import { NextRequest, NextResponse } from 'next/server';
import { retryFailedScheduledMessages } from '@/lib/communication-provider/server/automation-engine';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId } = body as { organizationId?: string };
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    const result = await retryFailedScheduledMessages(organizationId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
