// POST /api/agi/approve
// Approve or reject a pending AGI approval (human-in-the-loop). Can also be
// used to resume from an emergency shutdown.
// Body: { approvalId, decision: 'approved'|'rejected', decidedBy, note? }
//    OR { action: 'resume_shutdown', decidedBy }
import { NextRequest, NextResponse } from 'next/server';
import { decideApproval, resumeFromShutdown } from '@/lib/agi/security';
import { invalidateCache } from '@/lib/agi/helpers';
import { db } from '@/lib/agi/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Resume from emergency shutdown
    if (body?.action === 'resume_shutdown') {
      await resumeFromShutdown(body.decidedBy ?? 'ceo');
      invalidateCache('agi:');
      return NextResponse.json({ ok: true, message: 'Emergency shutdown lifted' });
    }

    // Trigger emergency shutdown
    if (body?.action === 'shutdown') {
      const { triggerEmergencyShutdown } = await import('@/lib/agi/security');
      await triggerEmergencyShutdown(body.reason ?? 'Manual emergency shutdown', body.decidedBy ?? 'ceo');
      invalidateCache('agi:');
      return NextResponse.json({ ok: true, message: 'Emergency shutdown triggered' });
    }

    // Approve / reject a specific approval
    if (!body?.approvalId || !body?.decision) {
      return NextResponse.json({ ok: false, error: 'approvalId and decision are required' }, { status: 400 });
    }
    if (body.decision !== 'approved' && body.decision !== 'rejected') {
      return NextResponse.json({ ok: false, error: 'decision must be approved or rejected' }, { status: 400 });
    }
    await decideApproval(body.approvalId, body.decision, body.decidedBy ?? 'manager', body.note);

    // If approved and linked to a decision, advance the decision
    if (body.decision === 'approved') {
      try {
        const approval = await db.aGIApproval.findUnique({ where: { id: body.approvalId } });
        if (approval?.decisionId) {
          await db.aGIDecision.update({
            where: { id: approval.decisionId },
            data: { status: 'approved', approvedBy: body.decidedBy, approvedAt: new Date() },
          });
        }
      } catch { /* ignore */ }
    }

    invalidateCache('agi:');
    return NextResponse.json({ ok: true, approvalId: body.approvalId, decision: body.decision });
  } catch (err) {
    console.error('[agi/approve] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to process approval' }, { status: 500 });
  }
}
