// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/autonomous/approve — Approve a pending decision
//
// Body: { decisionId: string, role?: string, userId?: string, note?: string }
//
// Approves a pending CEODecision (status pending → approved) so the
// autonomous execution engine can run it. Role policy is enforced by the
// CEO engine. Audit logged.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateAutonomousCache } from '@/lib/autonomous/orchestrator';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || !body.decisionId) {
      return NextResponse.json(
        { error: 'INVALID_BODY', message: 'decisionId is required.', tagline: AUTONOMOUS_TAGLINE },
        { status: 400 },
      );
    }

    const { decisionId, role, userId, note } = body as {
      decisionId: string;
      role?: string;
      userId?: string;
      note?: string;
    };

    const updated = await db.cEODecision.updateMany({
      where: { id: decisionId, status: 'pending' },
      data: {
        status: 'approved',
        approvedBy: userId ?? role ?? 'executive',
        updatedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { approved: false, message: 'Decision not found or not in pending status.', tagline: AUTONOMOUS_TAGLINE },
        { status: 404 },
      );
    }

    // Audit log (safe-write: retries without userId on P2003, never throws).
    await safeAudit({
      action: 'AUTONOMOUS_APPROVE',
      entity: 'AutonomousDecision',
      entityId: decisionId,
      userId: userId ?? null,
      details: JSON.stringify({ role: role ?? 'executive', note: note ?? null }),
    });

    invalidateAutonomousCache();
    return NextResponse.json(
      { approved: true, decisionId, tagline: AUTONOMOUS_TAGLINE },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Approve] Error:', error);
    return NextResponse.json(
      { error: 'Failed to approve', message: error instanceof Error ? error.message : 'Unknown error', tagline: AUTONOMOUS_TAGLINE },
      { status: 500 },
    );
  }
}
