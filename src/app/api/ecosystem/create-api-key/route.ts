// POST /api/ecosystem/create-api-key
// Create a platform API key. Returns the full key ONCE. Audit-logged.

import { NextResponse } from 'next/server';
import { createApiKey } from '@/lib/ecosystem/api-gateway';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
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

    const organizationId = await resolveOrgId(body.organizationId);
    const key = await createApiKey({
      organizationId,
      name,
      scopes: Array.isArray(body.scopes) ? body.scopes : ['read'],
      rateLimitPerMin: Number(body.rateLimitPerMin) || 600,
      rateLimitPerDay: Number(body.rateLimitPerDay) || 100000,
      expiresInDays: body.expiresInDays ? Number(body.expiresInDays) : undefined,
      createdBy: body.createdBy,
    });
    invalidateEcosystemCache();

    await logApiUsage({
      organizationId,
      endpoint: '/api/ecosystem/create-api-key',
      method: 'POST',
      statusCode: 201,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, apiKey: key },
      { status: 201, headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem create-api-key] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
