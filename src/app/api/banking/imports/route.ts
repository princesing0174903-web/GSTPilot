// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Imports List API (TASK 12)
//
// GET /api/banking/imports?organizationId=...
//   → listImports(orgId)
//
// Convenience read-only endpoint that returns the org's recent statement
// imports (newest first, default 50). The richer /api/banking/import endpoint
// also supports GET, but this dedicated path keeps the URL self-documenting.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { listImports } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const imports = await listImports(orgId);
    return NextResponse.json({ imports });
  } catch (err) {
    return friendlyApiError(err, 'Failed to list statement imports.');
  }
}
