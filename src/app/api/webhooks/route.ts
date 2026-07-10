import { NextResponse } from 'next/server';
import { listWebhooks, getWebhookStats } from '@/lib/app-platform/webhooks';
import { resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** GET /api/webhooks — list webhook subscriptions + stats for the tenant. */
export async function GET() {
  try {
    const tenantId = await resolveDefaultTenantId();
    const [webhooks, stats] = await Promise.all([
      listWebhooks(tenantId),
      getWebhookStats(tenantId),
    ]);
    return NextResponse.json({ webhooks, total: webhooks.length, stats });
  } catch (error) {
    console.error('[API /webhooks] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch webhooks' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
