// POST /api/ecosystem/revoke-api-key
// Revoke a platform API key. Audit-logged.

import { NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/ecosystem/api-gateway';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKeyId: string = body.apiKeyId ?? body.id ?? '';
    if (!apiKeyId) return NextResponse.json({ error: 'apiKeyId is required' }, { status: 400 });

    const organizationId = await resolveOrgId(body.organizationId);
    const result = await revokeApiKey({ apiKeyId, organizationId, actor: body.actor });
    invalidateEcosystemCache();

    return NextResponse.json(result, { headers: { 'X-Ecosystem': 'true' } });
  } catch (error) {
    console.error('[Ecosystem revoke-api-key] Error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
