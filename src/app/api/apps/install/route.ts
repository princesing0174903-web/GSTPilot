import { NextRequest, NextResponse } from 'next/server';
import { installApp, resolveDefaultTenantId } from '@/lib/app-platform/registry';
import type { AppPermission, InstallScope } from '@/lib/app-platform/types';

/** POST /api/apps/install — one-click install an app into the tenant. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, scope, organizationId, grantedPermissions, config, autoUpdate } = body;

    if (!appId) {
      return NextResponse.json({ error: 'appId is required' }, { status: 400 });
    }

    const tenantId = await resolveDefaultTenantId();
    const install = await installApp({
      tenantId,
      appId,
      scope: scope as InstallScope,
      organizationId,
      grantedPermissions: grantedPermissions as AppPermission[],
      config,
      autoUpdate,
    });

    return NextResponse.json({ install, success: true });
  } catch (error) {
    console.error('[API /apps/install] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to install app' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
