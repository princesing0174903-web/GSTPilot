// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/api-keys
//
// GET  — list active API keys for the current organization (real PlatformApiKey rows)
// POST — create a new API key (returns the full key ONCE, then never again)
//
// Uses the existing ecosystem/api-gateway.ts library so keys are hashed, scoped,
// rate-limited, and audit-logged the same way every other API key in the
// platform is. No mock keys, no demo rows.
//
// SECURITY (POLISH-06):
//   • requireAuth on BOTH verbs — keys are a privileged resource.
//   • zod validation on POST body (schemas.apiKeyCreate).
//   • Rate-limited via RATE_LIMIT_PRESETS.admin (20 req/min).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { listApiKeys, createApiKey } from '@/lib/ecosystem/api-gateway';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { safeAudit } from '@/lib/audit/safe-write';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { rateLimit, rateLimitedResponse, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { parseBody, schemas } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/settings/api-keys?organizationId=<orgId>
export async function GET(request: Request) {
  const rl = rateLimit(request, RATE_LIMIT_PRESETS.admin, 'api-keys-list');
  if (rl.denied) return rateLimitedResponse(rl.retryAfterSec);

  try {
    // ── Authentication ──────────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const organizationId = await resolveOrgId(searchParams.get('organizationId'));

    // ── Authorization — must be a member of the org whose keys we're listing ──
    if (organizationId) {
      const memberResult = await requireOrgMembership(uid, organizationId);
      if (memberResult instanceof NextResponse) return memberResult;
    }

    const keys = await listApiKeys(organizationId ?? undefined);
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[/api/settings/api-keys] GET error:', error);
    return friendlyApiError(error, 'We could not load your API keys right now. Please try again.');
  }
}

// POST /api/settings/api-keys
// Body: { name: string, scopes?: string[], expiresInDays?: number, createdBy?: string, organizationId?: string }
export async function POST(request: Request) {
  const rl = rateLimit(request, RATE_LIMIT_PRESETS.admin, 'api-keys-create');
  if (rl.denied) return rateLimitedResponse(rl.retryAfterSec);

  try {
    // ── Authentication ──────────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    // ── Validate body via zod ───────────────────────────────────────────────
    const [body, validationErr] = await parseBody(request, schemas.apiKeyCreate);
    if (validationErr) return validationErr;

    const organizationId = await resolveOrgId(body.organizationId);
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // ── Authorization — must be a member of the org receiving the new key ───
    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    const key = await createApiKey({
      organizationId,
      name: body.name,
      scopes: body.scopes && body.scopes.length > 0 ? body.scopes : ['read'],
      rateLimitPerMin: body.rateLimitPerMin ?? 600,
      rateLimitPerDay: body.rateLimitPerDay ?? 100_000,
      expiresInDays: body.expiresInDays,
      createdBy: body.createdBy ?? uid,
    });

    try {
      await safeAudit({
        userId: uid,
        action: 'API_KEY_CREATED',
        entity: 'PlatformApiKey',
        entityId: key.id,
        newValue: JSON.stringify({ name: body.name, scopes: body.scopes }),
        details: `API key "${body.name}" created`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/api-keys] audit write failed:', auditErr);
    }

    return NextResponse.json({ key }, { status: 201 });
  } catch (error) {
    console.error('[/api/settings/api-keys] POST error:', error);
    return friendlyApiError(error, 'We could not create the API key right now. Please try again.');
  }
}
