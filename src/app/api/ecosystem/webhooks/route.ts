// GET /api/ecosystem/webhooks
// List webhook subscriptions + recent deliveries + the canonical event catalog.

import { NextResponse } from 'next/server';
import { getWebhookSummary } from '@/lib/ecosystem/webhooks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId') ?? undefined;
    const summary = await getWebhookSummary(orgId);
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Ecosystem': 'true' },
    });
  } catch (error) {
    console.error('[Ecosystem webhooks] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load webhook summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
