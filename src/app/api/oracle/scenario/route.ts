// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/oracle/scenario — What-If Scenario Simulation
//
// Runs a safe what-if simulation. NEVER modifies real records. The output is
// always labelled isSimulation:true with a warning banner.
//
// Request body:
//   { orgId, kind, magnitude, horizonMonths?, label? }
//
// kind: collections_improve | revenue_drops | gst_liability_increases |
//        large_customer_late | expense_increase | custom
// magnitude: e.g. 0.15 = +15%, -0.10 = -10%
//
// Auth: requireAuth + requireOrgMembership.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getUnifiedOracleContext } from '@/lib/oracle/context/builder';
import { runScenario, type ScenarioInput } from '@/lib/oracle/intelligence/scenario-engine';

export const runtime = 'nodejs';
export const revalidate = 0;

const VALID_KINDS: ScenarioInput['kind'][] = [
  'collections_improve', 'revenue_drops', 'gst_liability_increases',
  'large_customer_late', 'expense_increase', 'custom',
];

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_BODY' }, { status: 400 });
  }

  const orgId: string = String(body.orgId ?? '');
  const kind = String(body.kind ?? '') as ScenarioInput['kind'];
  const magnitude = Number(body.magnitude ?? 0);

  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;

  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `Invalid scenario kind. Valid: ${VALID_KINDS.join(', ')}`, code: 'INVALID_KIND' },
      { status: 400 }
    );
  }

  if (isNaN(magnitude)) {
    return NextResponse.json(
      { error: 'magnitude must be a number', code: 'INVALID_MAGNITUDE' },
      { status: 400 }
    );
  }

  try {
    const ctx = await getUnifiedOracleContext(orgId);
    const result = runScenario(ctx, {
      kind,
      magnitude,
      horizonMonths: body.horizonMonths ? Number(body.horizonMonths) : undefined,
      label: body.label ? String(body.label) : undefined,
    });
    return NextResponse.json({
      ok: true,
      scenario: result,
      evidenceIndex: ctx.evidenceIndex,
    });
  } catch (err) {
    return friendlyApiError(err, 'We could not run the scenario simulation right now.');
  }
}
