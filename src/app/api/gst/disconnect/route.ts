// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst/disconnect
// ═══════════════════════════════════════════════════════════════════════════════
// Disable the org's active GSP provider config. Does NOT delete the config row
// (so the user can reconnect later without re-entering credentials) — it sets
// enabled=false and clears the test/sync timestamps.
//
// Body: { organizationId }
// Returns: { ok: true }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { logGSTAudit } from '@/lib/gst-reconciliation/server/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ organizationId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: err.issues[0]?.message ?? 'Invalid request.', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }
      throw err;
    }

    const member = await requireOrgMembership(uid, body.organizationId);
    if (member instanceof NextResponse) return member;

    // Load the config before disabling (for audit).
    const cfg = await db.gSPProviderConfig.findFirst({
      where: { organizationId: body.organizationId, enabled: true },
      orderBy: { updatedAt: 'desc' },
    });

    await db.gSPProviderConfig.updateMany({
      where: { organizationId: body.organizationId, enabled: true },
      data: {
        enabled: false,
        lastTestOk: false,
        lastTestMessage: 'Disconnected by user.',
        lastConnectedAt: null,
        lastSyncAt: null,
        connectionState: 'not_connected',
      },
    });

    if (cfg) {
      await logGSTAudit({
        organizationId: body.organizationId,
        userId: uid,
        action: 'gst.disconnect',
        entity: 'GSPProviderConfig',
        entityId: cfg.id,
        details: { provider: cfg.providerKey, mode: cfg.mode },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return friendlyApiError(error, 'Unable to disconnect the GST provider.');
  }
}
