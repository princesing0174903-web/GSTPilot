// POST /api/ecosystem/create-webhook
// Create a webhook subscription. Generates a real HMAC signing secret. Audit-logged.

import { NextResponse } from 'next/server';
import { createSubscription } from '@/lib/ecosystem/webhooks';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const label: string = body.label ?? '';
    const targetUrl: string = body.targetUrl ?? '';
    if (!label || !targetUrl) {
      return NextResponse.json({ error: 'label and targetUrl are required' }, { status: 400 });
    }
    try { new URL(targetUrl); } catch { return NextResponse.json({ error: 'targetUrl must be a valid URL' }, { status: 400 }); }

    const eventTypes: string[] = Array.isArray(body.eventTypes) ? body.eventTypes : ['*'];
    const organizationId = await resolveOrgId(body.organizationId);
    const subscription = await createSubscription({
      organizationId,
      label,
      targetUrl,
      eventTypes,
      createdBy: body.createdBy,
    });
    invalidateEcosystemCache();

    await logApiUsage({
      organizationId,
      endpoint: '/api/ecosystem/create-webhook',
      method: 'POST',
      statusCode: 201,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, subscription },
      { status: 201, headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem create-webhook] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
