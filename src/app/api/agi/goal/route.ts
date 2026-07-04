// POST /api/agi/goal
// Create a new business goal. Oracle will break it into projects, milestones, and tasks.
// Body: { title, description, category, priority?, targetMetric, targetValue, unit?, deadline?, ownerId? }
import { NextRequest, NextResponse } from 'next/server';
import { createGoal } from '@/lib/agi/goals';
import { auditCommand } from '@/lib/agi/security';
import { invalidateCache } from '@/lib/agi/helpers';
import type { GoalCategory, GoalPriority } from '@/lib/agi/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.title || !body?.targetMetric) {
      return NextResponse.json({ ok: false, error: 'title and targetMetric are required' }, { status: 400 });
    }
    const audit = await auditCommand({
      actionType: 'goal',
      targetType: 'goal',
      actorId: body.actorId ?? 'oracle',
      actorType: 'oracle',
      role: 'manager',
      riskScore: 20,
      financialImpact: 0,
      payload: JSON.stringify(body),
      reason: `Create goal: ${body.title}`,
    });
    if (!audit.allowed) {
      return NextResponse.json({ ok: false, error: 'Action blocked by AGI security', audit }, { status: 403 });
    }
    const goal = await createGoal({
      title: body.title,
      description: body.description ?? '',
      category: (body.category as GoalCategory) ?? 'growth',
      priority: (body.priority as GoalPriority) ?? 'high',
      targetMetric: body.targetMetric,
      targetValue: Number(body.targetValue) || 0,
      unit: body.unit,
      deadline: body.deadline,
      ownerId: body.ownerId,
    });
    invalidateCache('agi:goals');
    invalidateCache('agi:dashboard');
    return NextResponse.json({ ok: true, goal, audit });
  } catch (err) {
    console.error('[agi/goal] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to create AGI goal' }, { status: 500 });
  }
}
