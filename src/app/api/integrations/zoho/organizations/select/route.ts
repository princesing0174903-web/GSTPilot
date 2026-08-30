// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/organizations/select
// ═══════════════════════════════════════════════════════════════════════════════
// Persists the selected Zoho Books organization ID + name on the token row.
//
// Body: { "organizationId": "<zoho_org_id>", "organizationName": "<zoho_org_name>" }
//
// The user can have multiple Zoho Books organizations under their account —
// we store the chosen one's `zohoOrgId` + `zohoOrgName` so subsequent
// Customers / Invoices / Bills / Payments queries are scoped correctly.
//
// Returns:
//   • 200 { ok: true, status: {...} }   — selected + fresh status
//   • 400 — missing orgId/userId headers OR missing body.organizationId
//   • 404 — no Zoho connection row found (caller must connect first)
//   • 401 — auth required (from requireAuth)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
} from '@/lib/integrations/zoho/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { orgId, userId } = resolveOrgUserFromHeaders(req);
  if (!orgId || !userId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing workspace context.',
        code: 'NO_ORG_CONTEXT',
      },
      { status: 400 }
    );
  }

  let body: { organizationId?: string; organizationName?: string } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    /* empty body — fall through to the validation below */
  }

  if (!body.organizationId || typeof body.organizationId !== 'string') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing or invalid `organizationId` in request body.',
        code: 'BAD_REQUEST',
      },
      { status: 400 }
    );
  }

  const row = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { id: true, revokedAt: true },
  });

  if (!row || row.revokedAt) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No active Zoho Books connection found. Please connect first.',
        code: 'NOT_CONNECTED',
      },
      { status: 404 }
    );
  }

  await db.zohoBooksToken.update({
    where: { id: row.id },
    data: {
      zohoOrgId: body.organizationId,
      zohoOrgName: body.organizationName ?? null,
    },
  });

  // Return the fresh status so the client can update without an extra round-trip.
  const status = await getConnectionStatus(orgId, userId);
  return NextResponse.json({ ok: true, status });
}
