// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/executive-briefing — Upgraded Daily Briefing (8 sections)
//
// Returns the executive briefing with 8 sections:
//   1. Today's Financial Status
//   2. Top 3 Risks
//   3. Top 3 Opportunities
//   4. Collections to Chase
//   5. GST Actions
//   6. Cash Flow Alerts
//   7. Important Customer Events
//   8. Pending Actions
//
// Plus proactive anomaly detection results (statistical, not LLM-invented).
// Every item carries: why it matters, evidence, recommended action.
//
// Auth: requireAuth + requireOrgMembership.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getExecutiveBriefing, invalidateBriefingCache } from '@/lib/oracle/executive-briefing';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId') ?? '';
  const refresh = url.searchParams.get('refresh') === '1';

  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    if (refresh) invalidateBriefingCache(orgId);
    const briefing = await getExecutiveBriefing(orgId, { forceRefresh: refresh });
    return NextResponse.json({ ok: true, briefing });
  } catch (err) {
    return friendlyApiError(err, 'We could not load your executive briefing right now.');
  }
}
