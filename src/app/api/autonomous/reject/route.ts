// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/autonomous/reject — Reject a pending decision
//
// Body: { decisionId: string, role?: string, userId?: string, note?: string }
//
// Rejects a pending CEODecision (status pending → rejected). The Learning
// Engine records the rejection so Oracle proposes better-aligned actions
// next time. Audit logged.
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
        status: 'rejected',
        approvedBy: userId ?? role ?? 'executive',
        updatedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { rejected: false, message: 'Decision not found or not in pending status.', tagline: AUTONOMOUS_TAGLINE },
        { status: 404 },
      );
    }

    // Record the rejection as a learned behaviour so Oracle improves
    try {
      const decision = await db.cEODecision.findUnique({ where: { id: decisionId }, select: { type: true } });
      if (decision) {
        await db.userBehaviour.create({
          data: {
            userId: userId ?? null,
            action: 'reject_decision',
            preference: `rejected_${decision.type}`,
            confidence: 0.6,
            evidence: 1,
          },
        });
      }
    } catch { /* learning is best-effort */ }

    // Audit log (safe-write: retries without userId on P2003, never throws).
    await safeAudit({
      action: 'AUTONOMOUS_REJECT',
      entity: 'AutonomousDecision',
      entityId: decisionId,
      userId: userId ?? null,
      details: JSON.stringify({ role: role ?? 'executive', note: note ?? null }),
    });

    invalidateAutonomousCache();
    return NextResponse.json(
      { rejected: true, decisionId, tagline: AUTONOMOUS_TAGLINE },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Reject] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reject', message: error instanceof Error ? error.message : 'Unknown error', tagline: AUTONOMOUS_TAGLINE },
      { status: 500 },
    );
  }
}
