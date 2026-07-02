// POST /api/ecosystem/uninstall-extension
// Uninstall an extension from an org. Audit-logged.

import { NextResponse } from 'next/server';
import { uninstallExtension } from '@/lib/ecosystem/extensions';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const extensionSlug: string = body.extensionSlug ?? body.slug ?? '';
    const actor: string | undefined = body.actor;
    if (!extensionSlug) {
      return NextResponse.json({ error: 'extensionSlug is required' }, { status: 400 });
    }
    const organizationId = await resolveOrgId(body.organizationId);
    const result = await uninstallExtension({ extensionSlug, organizationId, actor });
    invalidateEcosystemCache();

    await logApiUsage({
      organizationId,
      endpoint: '/api/ecosystem/uninstall-extension',
      method: 'POST',
      statusCode: 200,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(result, { headers: { 'X-Ecosystem': 'true' } });
  } catch (error) {
    console.error('[Ecosystem uninstall-extension] Error:', error);
    return NextResponse.json(
      { error: 'Failed to uninstall extension', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
