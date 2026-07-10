// POST /api/ecosystem/emit-event
// Emit a webhook event. Real delivery attempts to all matching subscriptions,
// with HMAC signing + retry. Audit-logged.

import { NextResponse } from 'next/server';
import { emitEvent } from '@/lib/ecosystem/webhooks';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const eventType: string = body.eventType ?? '';
    const payload: Record<string, unknown> = body.payload ?? {};
    if (!eventType) return NextResponse.json({ error: 'eventType is required' }, { status: 400 });

    const organizationId = await resolveOrgId(body.organizationId);
    const result = await emitEvent({ organizationId, eventType, payload, actor: body.actor });

    await logApiUsage({
      organizationId,
      endpoint: '/api/ecosystem/emit-event',
      method: 'POST',
      statusCode: 200,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem emit-event] Error:', error);
    return NextResponse.json(
      { error: 'Failed to emit event', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
