// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Oracle Autonomous Action API (Phase Delta · 2)
// POST /api/oracle/action — executes an Oracle action with permission gates,
// audit logging, and dry-run support.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { executeOracleAction, type ActionContext } from '@/lib/autonomous-finance/oracle-actions';

export async function POST(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = await req.json();
    const { actionId, input, dryRun, organizationId, userId, userEmail } = body ?? {};

    if (!actionId || typeof actionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'actionId is required' },
        { status: 400 },
      );
    }

    const orgId0 = String(organizationId ?? body.orgId ?? body.firmId ?? '');
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;

    const ctx: ActionContext = {
      organizationId: String(organizationId ?? 'preview-org'),
      userId: String(userId ?? 'preview-user'),
      userEmail: String(userEmail ?? 'preview@veyro.com'),
    };

    const result = await executeOracleAction(
      actionId,
      input ?? {},
      ctx,
      Boolean(dryRun),
    );

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 },
    );
  }
}
