// POST /api/ecosystem/install-extension
// Install a marketplace/private app into an org. Audit-logged. Real install count.

import { NextResponse } from 'next/server';
import { installExtension } from '@/lib/ecosystem/extensions';
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
    const installedBy: string | undefined = body.installedBy;
    const config: Record<string, unknown> | undefined = body.config;

    if (!extensionSlug) {
      await logApiUsage({ endpoint: '/api/ecosystem/install-extension', method: 'POST', statusCode: 400, responseMs: Date.now() - start });
      return NextResponse.json({ error: 'extensionSlug is required' }, { status: 400 });
    }

    const organizationId = await resolveOrgId(body.organizationId);
    const result = await installExtension({ extensionSlug, organizationId, installedBy, config });
    invalidateEcosystemCache();

    await logApiUsage({
      organizationId,
      endpoint: '/api/ecosystem/install-extension',
      method: 'POST',
      statusCode: 201,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, install: result.install, extension: result.extension },
      { status: 201, headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem install-extension] Error:', error);
    await logApiUsage({ endpoint: '/api/ecosystem/install-extension', method: 'POST', statusCode: 500, responseMs: Date.now() - start });
    return NextResponse.json(
      { error: 'Failed to install extension', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
