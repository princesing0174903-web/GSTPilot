// POST /api/command/recover
// Recover an incident — execute the recovery plan + mark resolved.
// Body: { incidentId: string, resolution: string }
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { recoverIncident, auditCommand } from '@/lib/command-network';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const incidentId = body.incidentId as string | undefined;
    const resolution = (body.resolution as string) ?? 'Recovery plan executed by Oracle.';
    const role = (body.role as string) ?? 'oracle';
    const actorId = (body.actorId as string) ?? 'oracle';

    if (!incidentId) {
      return NextResponse.json({ ok: false, error: 'incidentId is required' }, { status: 400 });
    }

    const incident = await recoverIncident(incidentId, resolution);
    if (!incident) {
      return NextResponse.json({ ok: false, error: 'Incident not found' }, { status: 404 });
    }

    await auditCommand({
      commandType: 'recover',
      targetModule: incident.affectedModules[0] ?? 'ai_operations',
      targetEntity: incidentId,
      actorId,
      actorType: 'oracle',
      role,
      payload: { resolution },
      result: 'success',
    });

    return NextResponse.json({ ok: true, incident });
  } catch (err) {
    console.error('[command/recover][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to recover incident';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
