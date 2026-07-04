import { NextRequest, NextResponse } from 'next/server';
import { registerWebhook } from '@/lib/app-platform/webhooks';
import { resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** POST /api/webhooks/register — register a new webhook subscription. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, targetUrl, eventTypes, appId, installId, secret } = body;

    if (!name || !targetUrl || !eventTypes || !Array.isArray(eventTypes)) {
      return NextResponse.json(
        { error: 'name, targetUrl, and eventTypes[] are required' },
        { status: 400 },
      );
    }

    const tenantId = await resolveDefaultTenantId();
    const webhook = await registerWebhook({
      tenantId, name, targetUrl, eventTypes, appId, installId, secret,
    });
    return NextResponse.json({ webhook, success: true });
  } catch (error) {
    console.error('[API /webhooks/register] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register webhook' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
