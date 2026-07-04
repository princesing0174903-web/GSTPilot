// POST /api/command/escalate
// Escalate an incident — Oracle raises severity + notifies executives.
// Body: { incidentId: string, reason: string }
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { escalateIncident, auditCommand } from '@/lib/command-network';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const incidentId = body.incidentId as string | undefined;
    const reason = (body.reason as string) ?? 'Manual escalation by operator';
    const role = (body.role as string) ?? 'oracle';
    const actorId = (body.actorId as string) ?? 'oracle';

    if (!incidentId) {
      return NextResponse.json({ ok: false, error: 'incidentId is required' }, { status: 400 });
    }

    const incident = await escalateIncident(incidentId, reason);
    if (!incident) {
      return NextResponse.json({ ok: false, error: 'Incident not found' }, { status: 404 });
    }

    await auditCommand({
      commandType: 'escalate',
      targetModule: incident.affectedModules[0] ?? 'ai_operations',
      targetEntity: incidentId,
      actorId,
      actorType: 'oracle',
      role,
      payload: { reason },
      result: 'success',
    });

    return NextResponse.json({ ok: true, incident });
  } catch (err) {
    console.error('[command/escalate][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to escalate incident';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
