// POST /api/command/playbook
// Auto-select or execute an Enterprise Playbook™.
// Body: { action: 'select' | 'run', situation?: string, playbookKey?: string }
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { selectPlaybook, markPlaybookUsed, launchWorkflow, auditCommand } from '@/lib/command-network';
import type { PlaybookType, WorkflowType, CoordinatedWorkflow } from '@/lib/command-network';

// Map playbook type → workflow type (for launching a coordinated workflow)
const PLAYBOOK_TO_WORKFLOW: Partial<Record<PlaybookType, WorkflowType>> = {
  quarter_end: 'quarter_end',
  gst_filing: 'gst_filing',
  payroll_cycle: 'payroll_cycle',
  disaster_recovery: 'disaster_recovery',
  international_expansion: 'international_expansion',
  product_launch: 'product_launch',
  acquisition: 'acquisition',
  funding_round: 'funding_round',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const role = (body.role as string) ?? 'oracle';
    const actorId = (body.actorId as string) ?? 'oracle';

    if (action === 'select') {
      const situation = body.situation as string;
      if (!situation) {
        return NextResponse.json({ ok: false, error: 'situation is required for select' }, { status: 400 });
      }
      const playbook = await selectPlaybook(situation);
      return NextResponse.json({ ok: true, playbook, situation });
    }

    if (action === 'run') {
      const playbookKey = body.playbookKey as string;
      if (!playbookKey) {
        return NextResponse.json({ ok: false, error: 'playbookKey is required for run' }, { status: 400 });
      }
      // Find the playbook
      const { getPlaybooks } = await import('@/lib/command-network');
      const playbooks = await getPlaybooks();
      const playbook = playbooks.find((p) => p.playbookKey === playbookKey || p.id === playbookKey);
      if (!playbook) {
        return NextResponse.json({ ok: false, error: 'Playbook not found' }, { status: 404 });
      }

      // Mark as used
      await markPlaybookUsed(playbook.id, true);

      // Launch a corresponding workflow if a mapping exists
      const workflowType = PLAYBOOK_TO_WORKFLOW[playbook.type];
      let workflow: CoordinatedWorkflow | null = null;
      if (workflowType) {
        try {
          workflow = await launchWorkflow({
            type: workflowType,
            trigger: `playbook:${playbook.type}`,
            initiatedBy: actorId,
          });
        } catch {
          /* workflow launch optional */
        }
      }

      await auditCommand({
        commandType: 'playbook',
        targetModule: 'oracle',
        targetEntity: playbook.id,
        actorId,
        actorType: 'oracle',
        role,
        payload: { action, playbookKey },
        result: 'success',
      });

      return NextResponse.json({ ok: true, playbook, workflow });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action. Use 'select' or 'run'." },
      { status: 400 },
    );
  } catch (err) {
    console.error('[command/playbook][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to run playbook';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
