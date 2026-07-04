import { NextRequest, NextResponse } from 'next/server';
import { updateInstall, resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** POST /api/apps/update — update an installed app to a new version. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { installId, targetVersion } = body;

    if (!installId) {
      return NextResponse.json({ error: 'installId is required' }, { status: 400 });
    }

    const tenantId = await resolveDefaultTenantId();
    const install = await updateInstall(installId, { tenantId, targetVersion });
    return NextResponse.json({ install, success: true });
  } catch (error) {
    console.error('[API /apps/update] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update app' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
