// POST /api/platform/install — install a marketplace app for an org
import { NextResponse } from 'next/server';
import { installApp } from '@/lib/platform/marketplace';
import { invalidatePlatformCache } from '@/lib/platform/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const organizationId: string = body.organizationId;
    const appId: string = body.appId;
    const installedBy: string = body.installedBy ?? 'owner@gstpilot.ai';

    if (!organizationId || !appId) {
      return NextResponse.json({ error: 'organizationId and appId are required' }, { status: 400 });
    }

    const install = await installApp(organizationId, appId, installedBy);
    if (!install) {
      return NextResponse.json({ error: 'App not found in marketplace catalog' }, { status: 404 });
    }

    invalidatePlatformCache();

    return NextResponse.json(
      { success: true, install },
      { status: 201, headers: { 'X-Platform': 'true' } },
    );
  } catch (error) {
    console.error('[Platform install] Error:', error);
    return NextResponse.json(
      { error: 'Failed to install app', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
