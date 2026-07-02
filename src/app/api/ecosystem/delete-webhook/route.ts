// POST /api/ecosystem/delete-webhook
// Soft-delete a webhook subscription. Audit-logged.

import { NextResponse } from 'next/server';
import { deleteSubscription } from '@/lib/ecosystem/webhooks';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const subscriptionId: string = body.subscriptionId ?? body.id ?? '';
    if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });

    const organizationId = await resolveOrgId(body.organizationId);
    const result = await deleteSubscription({ subscriptionId, organizationId, actor: body.actor });
    invalidateEcosystemCache();

    return NextResponse.json(result, { headers: { 'X-Ecosystem': 'true' } });
  } catch (error) {
    console.error('[Ecosystem delete-webhook] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
