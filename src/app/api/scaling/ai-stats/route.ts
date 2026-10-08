// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — /api/scaling/ai-stats
//
// GET /api/scaling/ai-stats
//   Returns combined AI scaling stats:
//     { queue: <AIRequestStats>, cache: <AICacheStats>, tokenUsage: { orgs: Record<orgId, tokens> } }
//
// Auth: optional `x-org-token` header matched against process.env.ADMIN_TOKEN.
// In dev (NODE_ENV !== 'production'), if ADMIN_TOKEN is unset the endpoint is
// open so local development isn't blocked.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getAIContextCache,
  getAIRequestQueue,
  getTokenUsageTracker,
} from '@/lib/scaling/ai-scaling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function checkOrgToken(request: Request): { ok: true } | { ok: false; response: Response } {
  const provided = request.headers.get('x-org-token');
  const expected = process.env.ADMIN_TOKEN;
  const isDev = process.env.NODE_ENV !== 'production';

  if (expected) {
    const a = Buffer.from(String(provided ?? ''));
    const b = Buffer.from(expected);
    const ok = a.length === b.length && a.equals(b);
    if (!ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'unauthorized' },
          { status: 401 },
        ),
      };
    }
  } else if (!isDev) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'ADMIN_TOKEN not configured' },
        { status: 500 },
      ),
    };
  }
  return { ok: true };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = checkOrgToken(request);
    if (!auth.ok) return auth.response;

    const queue = getAIRequestQueue();
    const cache = getAIContextCache();
    const tokens = getTokenUsageTracker();

    return NextResponse.json({
      ok: true,
      queue: queue.getStats(),
      cache: cache.stats(),
      tokenUsage: { orgs: tokens.snapshot() },
    });
  } catch (err) {
    console.error('[/api/scaling/ai-stats] fatal:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'internal_error',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
