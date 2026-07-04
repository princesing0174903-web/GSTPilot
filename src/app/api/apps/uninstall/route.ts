import { NextRequest, NextResponse } from 'next/server';
import { uninstallApp, resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** POST /api/apps/uninstall — one-click uninstall an app. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { installId } = body;

    if (!installId) {
      return NextResponse.json({ error: 'installId is required' }, { status: 400 });
    }

    const tenantId = await resolveDefaultTenantId();
    const result = await uninstallApp(installId, { tenantId });
    return NextResponse.json({ ...result, success: true });
  } catch (error) {
    console.error('[API /apps/uninstall] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to uninstall app' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
