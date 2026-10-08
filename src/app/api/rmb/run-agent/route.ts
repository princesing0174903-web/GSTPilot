// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Run My Business™ — Real Agent Execution API (PT-1-b)
// POST /api/rmb/run-agent
//
// Body: { agent: 'collections'|'compliance'|'finance'|'reporting'|'gst', userId?: string }
// Returns: { success, agent, summary, metrics, items, auditLogId, executedAt }
//
// Each agent reads REAL business state from the DB and writes REAL records
// (Notification / AITask / Notice / AIPrediction / ExecutiveReport / Issue +
// AuditLog). No mock data — every summary is computed from rows that were
// actually inserted.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runRmbAgent, type RmbAgentId } from '@/lib/rmb/run-agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_AGENTS: ReadonlySet<RmbAgentId> = new Set([
  'collections',
  'compliance',
  'finance',
  'reporting',
  'gst',
]);

export async function POST(request: NextRequest) {
  let body: { agent?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const agent = body.agent as RmbAgentId | undefined;
  if (!agent || !VALID_AGENTS.has(agent)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'agent is required and must be one of: collections, compliance, finance, reporting, gst',
      },
      { status: 400 },
    );
  }

  const userId = body.userId && typeof body.userId === 'string' ? body.userId : undefined;

  try {
    const result = await runRmbAgent(agent, userId);
    if (result.success) {
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    return NextResponse.json(result, { status: 500 });
  } catch (err) {
    console.error('[rmb/run-agent] error', err);
    return NextResponse.json(
      {
        success: false,
        agent,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// GET — quick health probe: lists the 5 supported agents.
export async function GET() {
  return NextResponse.json({
    agents: Array.from(VALID_AGENTS),
    description:
      'POST { agent, userId? } to execute real DB writes (Notification / AITask / AuditLog / AIPrediction / ExecutiveReport / Issue).',
  });
}
