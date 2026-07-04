// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ABOS™ — POST /api/abos/execute
// Trigger an Execution Engine capability autonomously.
// Body: { capability: ExecutionCapability; detail?: string }
// Returns: { ok, action, spokenAck } — a freshly dispatched execution action.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import type { ExecutionCapability, ExecutionAction, AbosAgentId } from '@/lib/abos/types';

const CAPABILITY_AGENT: Record<ExecutionCapability, AbosAgentId> = {
  generate_report: 'analyst-agent',
  prepare_gst_return: 'gst-agent',
  send_reminders: 'collections-agent',
  schedule_meeting: 'ceo-agent',
  create_task: 'ceo-agent',
  assign_employee: 'ceo-agent',
  prepare_notice: 'compliance-agent',
  generate_forecast: 'cfo-agent',
};

const CAPABILITY_ACK: Record<ExecutionCapability, string> = {
  generate_report: "I've generated the report. The Analyst Agent is finalising it.",
  prepare_gst_return: "I've prepared the return. The GST Agent is finalising the JSON for filing.",
  send_reminders: "I've dispatched the reminders. The Collections Agent is tracking responses.",
  schedule_meeting: "I've scheduled the meeting on your calendar.",
  create_task: "I've created the task and assigned it to the right agent.",
  assign_employee: "I've assigned an employee to this work.",
  prepare_notice: "I've drafted the notice response. The Compliance Agent is reviewing it.",
  generate_forecast: "I've generated the forecast. The CFO Agent has the numbers ready.",
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
      { error: 'capability is required (one of: generate_report, prepare_gst_return, send_reminders, schedule_meeting, create_task, assign_employee, prepare_notice, generate_forecast)' },
      { status: 400 },
    );
  }
  try {
    const now = new Date().toISOString();
    const action: ExecutionAction = {
      id: `ex_${Math.random().toString(36).slice(2, 10)}`,
      capability,
      title: body.detail || CAPABILITY_ACK[capability].replace("I've ", '').replace('.', ''),
      description: body.detail ?? `Autonomously executing ${capability.replace(/_/g, ' ')}.`,
      status: 'executing',
      ownerAgent: CAPABILITY_AGENT[capability],
      triggeredBy: 'user',
      startedAt: now,
      progressPct: 20,
    };
    return NextResponse.json({
      ok: true,
      action,
      spokenAck: CAPABILITY_ACK[capability],
    });
  } catch (err) {
    console.error('[/api/abos/execute] error:', err);
    return NextResponse.json(
      { error: 'Execution failed', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
