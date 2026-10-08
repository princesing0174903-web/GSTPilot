// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Oracle Chat API
//
// POST /api/ai/oracle/chat
//   Body: { organizationId, question: string }
//
// Returns: { ok: true, response: ChatResponse }
//
// VEYRO AI answers using REAL Firestore data only — never fabricated. If the
// org has no business data yet, the orchestrator returns a graceful "connect
// data" message rather than throwing.
//
// Validation: question must be a non-empty string (400 otherwise).
// Wraps all errors with friendlyAIError.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { answerBusinessQuestion } from '@/lib/ai-provider/server/orchestrator';
import { AIError, NoBusinessDataError, friendlyAIError } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId, question } = body as { organizationId?: string; question?: string };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'You must belong to an organization to use AI Oracle.', code: 'NO_ORGANIZATION' },
        { status: 403 },
      );
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'A non-empty question is required.', code: 'AI_VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const response = await answerBusinessQuestion(organizationId, question.trim());
    return NextResponse.json({ ok: true, response });
  } catch (err) {
    if (err instanceof NoBusinessDataError) {
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: 409 },
      );
    }
    if (err instanceof AIError) {
      console.error('[api/ai/oracle/chat] error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/oracle/chat] unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
