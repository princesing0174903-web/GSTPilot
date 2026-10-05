// POST /api/oracle-brain/command — Oracle Command Center natural-language query.
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { runCommand } from '@/lib/oracle-intelligence/command-center';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = await request.json().catch(() => ({}));
    const orgId0 = body.orgId || body.organizationId || body.firmId || '';
    if (orgId0) {
      const orgResult = await requireOrgMembership(uid, orgId0);
      if (orgResult instanceof NextResponse) return orgResult;
    }
    const query: string = body.query || body.command || body.q || '';
    if (!query.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    const result = await runCommand(query);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[oracle-brain/command] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
