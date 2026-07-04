// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/data/repair
//   Body: { issueId: string }
// Marks a DataQualityAlert as resolved=true (resolvedAt=now) on REAL production
// data. Returns the updated issue.
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { repairIssue } from '@/lib/data-intelligence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { issueId } = body as { issueId?: unknown };

    if (typeof issueId !== 'string' || issueId.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing issueId' },
        { status: 400 },
      );
    }

    const issue = await repairIssue(issueId.trim());

    return NextResponse.json({ ok: true, issue });
  } catch (err) {
    console.error('[data-intelligence/repair][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to repair data quality issue';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
