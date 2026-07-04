// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — AI Memory API
//
// GET /api/ai/memory?orgId=&type=insight|recommendation|alert|analysis|...
//
// Returns: { ok: true, memories: AIMemory[] }
//
// Reads the org's AI memory (one-shot). Use the `type` query param to filter by
// memory type. Real-time subscriptions are handled client-side via the
// useAIMemories hook (subscribeToMemories).
//
// Wraps all errors with friendlyAIError.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getMemories } from '@/lib/ai-provider';
import { AIError, AIMemoryError, friendlyAIError } from '@/lib/ai-provider';
import type { AIMemoryType } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TYPES: AIMemoryType[] = [
  'insight',
  'recommendation',
  'alert',
  'analysis',
  'conversation',
  'pattern',
  'outcome',
  'fact',
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('orgId');
    const typeParam = searchParams.get('type');

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'orgId query param is required.', code: 'NO_ORGANIZATION' },
        { status: 403 },
      );
    }

    let type: AIMemoryType | undefined;
    if (typeParam) {
      if (!VALID_TYPES.includes(typeParam as AIMemoryType)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}.`,
            code: 'AI_VALIDATION_ERROR',
          },
          { status: 400 },
        );
      }
      type = typeParam as AIMemoryType;
    }

    const memories = await getMemories(organizationId, type ? { type } : undefined);
    return NextResponse.json({ ok: true, memories });
  } catch (err) {
    if (err instanceof AIMemoryError) {
      console.error('[api/ai/memory] GET error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    if (err instanceof AIError) {
      console.error('[api/ai/memory] GET error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/memory] GET unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
