// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/api-keys/[id]
//
// DELETE — revoke a single API key (marks status='revoked', sets revokedAt).
//          Real revocation via the ecosystem library + audit log.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/ecosystem/api-gateway';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = await resolveOrgId(searchParams.get('organizationId'));
    const body = await request.json().catch(() => ({}));

    const result = await revokeApiKey({
      apiKeyId: id,
      organizationId: organizationId ?? undefined,
      actor: body.actor ?? 'settings-ui',
    });

    try {
      await safeAudit({
        userId: body.actor ?? null,
        action: 'API_KEY_REVOKED',
        entity: 'PlatformApiKey',
        entityId: id,
        details: `API key revoked`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/api-keys] audit write failed:', auditErr);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/settings/api-keys/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke API key' },
      { status: 500 },
    );
  }
}
