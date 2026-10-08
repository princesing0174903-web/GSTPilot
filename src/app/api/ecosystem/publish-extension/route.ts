// POST /api/ecosystem/publish-extension
// Publish a private (or public) app to the marketplace. Audit-logged.

import { NextResponse } from 'next/server';
import { publishExtension } from '@/lib/ecosystem/extensions';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const name: string = body.name ?? '';
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const extension = await publishExtension({
      name,
      displayName: body.displayName ?? name,
      description: body.description ?? '',
      publisher: body.publisher ?? 'VEYRO Labs',
      kind: body.kind ?? 'app',
      category: body.category ?? 'ai',
      version: body.version ?? '1.0.0',
      visibility: body.visibility ?? 'private',
      pricingModel: body.pricingModel ?? 'free',
      priceInr: Number(body.priceInr) || 0,
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
      entrypoints: Array.isArray(body.entrypoints) ? body.entrypoints : [],
      organizationId: body.organizationId,
      developerId: body.developerId,
    });
    invalidateEcosystemCache();

    await logApiUsage({
      organizationId: body.organizationId,
      endpoint: '/api/ecosystem/publish-extension',
      method: 'POST',
      statusCode: 201,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, extension },
      { status: 201, headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem publish-extension] Error:', error);
    return NextResponse.json(
      { error: 'Failed to publish extension', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
