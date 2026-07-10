// POST /api/agi/feedback
// Submit human feedback that Oracle learns from (Self-Improvement System™).
// Body: { subject, observation, lesson, sourceModule? }
import { NextRequest, NextResponse } from 'next/server';
import { recordFeedback } from '@/lib/agi/learning';
import { auditCommand } from '@/lib/agi/security';
import { invalidateCache } from '@/lib/agi/helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.subject || !body?.lesson) {
      return NextResponse.json({ ok: false, error: 'subject and lesson are required' }, { status: 400 });
    }
    const audit = await auditCommand({
      actionType: 'feedback',
      targetType: 'learning',
      actorId: body.actorId ?? 'human',
      actorType: 'human',
      role: 'employee',
      riskScore: 0,
      financialImpact: 0,
      payload: JSON.stringify(body),
      reason: `Feedback: ${body.subject}`,
    });
    if (!audit.allowed) {
      return NextResponse.json({ ok: false, error: 'Feedback blocked by AGI security', audit }, { status: 403 });
    }
    const episode = await recordFeedback({
      subject: body.subject,
      observation: body.observation ?? '',
      lesson: body.lesson,
      sourceModule: body.sourceModule,
    });
    invalidateCache('agi:learning');
    invalidateCache('agi:dashboard');
    return NextResponse.json({ ok: true, episode, audit });
  } catch (err) {
    console.error('[agi/feedback] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to record feedback' }, { status: 500 });
  }
}
