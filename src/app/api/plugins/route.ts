import { NextResponse } from 'next/server';
import { listPlugins, getPluginStats } from '@/lib/app-platform/plugins';
import { resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** GET /api/plugins — list installed plugins + stats for the tenant. */
export async function GET() {
  try {
    const tenantId = await resolveDefaultTenantId();
    const [plugins, stats] = await Promise.all([
      listPlugins(tenantId),
      getPluginStats(tenantId),
    ]);
    return NextResponse.json({ plugins, total: plugins.length, stats });
  } catch (error) {
    console.error('[API /plugins] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch plugins' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
