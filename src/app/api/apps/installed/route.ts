import { NextResponse } from 'next/server';
import { listInstalledApps, resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** GET /api/apps/installed — list installed apps for the default tenant. */
export async function GET() {
  try {
    const tenantId = await resolveDefaultTenantId();
    const installs = await listInstalledApps(tenantId);
    return NextResponse.json({ installed: installs, installs, total: installs.length });
  } catch (error) {
    console.error('[API /apps/installed] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch installed apps' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
