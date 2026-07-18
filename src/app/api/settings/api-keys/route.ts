// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/api-keys
//
// GET  — list active API keys for the current organization (real PlatformApiKey rows)
// POST — create a new API key (returns the full key ONCE, then never again)
//
// Uses the existing ecosystem/api-gateway.ts library so keys are hashed, scoped,
// rate-limited, and audit-logged the same way every other API key in the
// platform is. No mock keys, no demo rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { listApiKeys, createApiKey } from '@/lib/ecosystem/api-gateway';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/settings/api-keys?organizationId=<orgId>
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = await resolveOrgId(searchParams.get('organizationId'));
    const keys = await listApiKeys(organizationId ?? undefined);
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[/api/settings/api-keys] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list API keys' },
      { status: 500 },
    );
  }
}

// POST /api/settings/api-keys
// Body: { name: string, scopes?: string[], expiresInDays?: number, createdBy?: string, organizationId?: string }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name: string = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const organizationId = await resolveOrgId(body.organizationId);
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const key = await createApiKey({
      organizationId,
      name,
      scopes: Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : ['read'],
      rateLimitPerMin: Number(body.rateLimitPerMin) || 600,
      rateLimitPerDay: Number(body.rateLimitPerDay) || 100000,
      expiresInDays: body.expiresInDays ? Number(body.expiresInDays) : undefined,
      createdBy: body.createdBy ?? 'settings-ui',
    });

    try {
      await safeAudit({
        userId: body.createdBy ?? null,
        action: 'API_KEY_CREATED',
        entity: 'PlatformApiKey',
        entityId: key.id,
        newValue: JSON.stringify({ name, scopes: body.scopes }),
        details: `API key "${name}" created`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/api-keys] audit write failed:', auditErr);
    }

    return NextResponse.json({ key }, { status: 201 });
  } catch (error) {
    console.error('[/api/settings/api-keys] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create API key' },
      { status: 500 },
    );
  }
}
