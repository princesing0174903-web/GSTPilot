// POST /api/communication/automation/run — dispatch due scheduled messages.
import { NextRequest, NextResponse } from 'next/server';
import { dispatchDueScheduledMessages } from '@/lib/communication-provider/server/automation-engine';
import { CommunicationError, friendlyCommunicationError } from '@/lib/communication-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId } = body as { organizationId?: string };
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    const result = await dispatchDueScheduledMessages(organizationId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof CommunicationError ? err.statusCode : 500;
    const code = err instanceof CommunicationError ? err.code : 'UNKNOWN';
    console.error('[api/communication/automation/run] error:', code, friendlyCommunicationError(err));
    return NextResponse.json(
      { ok: false, error: friendlyCommunicationError(err), code },
      { status: statusCode },
    );
  }
}
