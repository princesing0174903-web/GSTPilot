// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/autonomous/execute — Autonomous Execution
//
// Body: { decisionId?: string, command?: string, role?: string, userId?: string }
//
// Either executes a decision by id (via the existing CEO execute engine) or
// parses a natural-language voice command (via the Voice Execution engine).
// All execution is logged; high-risk commands require approval.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { executeVoiceCommand } from '@/lib/autonomous/voice';
import { invalidateAutonomousCache } from '@/lib/autonomous/orchestrator';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'INVALID_BODY', message: 'Request body must be a JSON object.', tagline: AUTONOMOUS_TAGLINE },
        { status: 400 },
      );
    }

    const { decisionId, command, role, userId } = body as {
      decisionId?: string;
      command?: string;
      role?: string;
      userId?: string;
    };

    // Path A: execute a specific decision via the CEO execution engine
    if (decisionId) {
      const { executeDecision, invalidateCEOCache } = await import('@/lib/ceo/orchestrator');
      try {
        const result = await executeDecision({
          decisionId,
          role: (role ?? 'manager') as never,
          userId,
        });
        invalidateCEOCache();
        invalidateAutonomousCache();
        return NextResponse.json(
          { executed: true, result, tagline: AUTONOMOUS_TAGLINE },
          { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
        );
      } catch (err) {
        return NextResponse.json(
          { executed: false, error: err instanceof Error ? err.message : 'Execution failed', tagline: AUTONOMOUS_TAGLINE },
          { status: 400 },
        );
      }
    }

    // Path B: parse + execute a voice command
    if (command && typeof command === 'string') {
      const result = await executeVoiceCommand(command);
      invalidateAutonomousCache();
      return NextResponse.json(
        { ...result, tagline: AUTONOMOUS_TAGLINE },
        { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true' } },
      );
    }

    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'Provide either decisionId or command.', tagline: AUTONOMOUS_TAGLINE },
      { status: 400 },
    );
  } catch (error) {
    console.error('[Autonomous Execute] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute', message: error instanceof Error ? error.message : 'Unknown error', tagline: AUTONOMOUS_TAGLINE },
      { status: 500 },
    );
  }
}
