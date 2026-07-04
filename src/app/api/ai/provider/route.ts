// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Provider Diagnostics API
//
// GET /api/ai/provider
//
// Returns: { ok: true, name, provider, isLive, configured }
//
// Reports which AI provider is active (Mock by default). Used by the dashboard
// to surface "AI Provider: Mock (deterministic real-data analysis)" or, when a
// production provider is wired in, the live provider name. This route does NOT
// require an organizationId — it is a system-level diagnostics endpoint.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { describeProvider } from '@/lib/ai-provider/server/registry';
import { AIError, friendlyAIError } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = describeProvider();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AIError) {
      console.error('[api/ai/provider] error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/provider] unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
