// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Disconnect API
//
// POST /api/banking/disconnect
//   Body: { encryptedConnection }
//   Returns: { ok: true }
//
// Idempotent — never throws, even if the connection is already invalid.
// The client is responsible for cascade-deleting the Firestore data via the
// service layer (cascadeDisconnect) after this returns.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { disconnectBank } from '@/lib/banking-provider/server/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || (body.organizationId as string | undefined) || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const { encryptedConnection } = body as { encryptedConnection?: string | null };

    // Idempotent — never throws.
    await disconnectBank(encryptedConnection ?? null);

    return NextResponse.json({ ok: true });
  } catch {
    // Disconnect must NEVER fail from the client's perspective.
    return NextResponse.json({ ok: true });
  }
}
