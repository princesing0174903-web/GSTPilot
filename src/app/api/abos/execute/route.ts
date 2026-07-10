// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ABOS™ — POST /api/abos/execute
// Trigger an Execution Engine capability autonomously.
// Body: { capability: ExecutionCapability; detail?: string }
//
// NOTE: This route previously fabricated an execution action id
// (`ex_${Math.random().toString(36).slice(2,10)}`), hardcoded spokenAck
// strings ("I've generated the report..."), and returned a 200 OK with status
// 'executing' and progressPct=20 — but performed NO actual execution and made
// NO DB write. That fake success was a data-integrity landmine: the UI showed
// "executing" actions that never actually executed. The real execution engine
// is NOT wired yet, so we now return an honest 501.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import type { ExecutionCapability } from '@/lib/abos/types';

const CAPABILITY_AGENT: Record<ExecutionCapability, string> = {
  generate_report: 'analyst-agent',
  prepare_gst_return: 'gst-agent',
  send_reminders: 'collections-agent',
  schedule_meeting: 'ceo-agent',
  create_task: 'ceo-agent',
  assign_employee: 'ceo-agent',
  prepare_notice: 'compliance-agent',
  generate_forecast: 'cfo-agent',
};

export async function POST(request: Request) {
  let body: { capability?: string; detail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const capability = body.capability as ExecutionCapability | undefined;
  if (!capability || !CAPABILITY_AGENT[capability]) {
    return NextResponse.json(
      {
        error:
          'capability is required (one of: generate_report, prepare_gst_return, send_reminders, schedule_meeting, create_task, assign_employee, prepare_notice, generate_forecast)',
      },
      { status: 400 }
    );
  }

  // No execution engine wired — return 501 with a clear, honest message.
  // We do NOT fabricate execution action ids, spoken acknowledgements, or
  // progress percentages.
  return NextResponse.json(
    {
      error: 'Execution engine not yet wired in this environment',
      capability,
      detail: body.detail ?? null,
      message: `Autonomous execution of '${capability}' is not available yet. The ABOS execution engine has not been connected to real provider backends.`,
    },
    { status: 501 }
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
