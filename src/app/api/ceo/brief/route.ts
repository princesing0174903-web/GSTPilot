// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — DAILY CEO BRIEF API
// GET /api/ceo/brief?userName=Prince
//
// Returns the Daily CEO Brief™ — a concise morning brief covering executive
// summary, key metrics, critical risks, today's priorities, meetings,
// collections, GST deadlines, bank balance, upcoming expenses, payroll status,
// Oracle recommendations, top opportunity, and a one-liner.
//
// Returns { brief: DailyCEOBrief | null, tagline } — null when no live data.
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCachedCEODashboard } from '@/lib/ceo/orchestrator';
import { CEO_TAGLINE } from '@/lib/ceo/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get('userName') ?? undefined;

    const dashboard = await getCachedCEODashboard('ceo', userName);

    return NextResponse.json(
      { brief: dashboard.brief, tagline: CEO_TAGLINE },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
          'X-CEO-Brief-Available': dashboard.brief ? 'true' : 'false',
        },
      },
    );
  } catch (error) {
    console.error('[CEO-Brief] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Daily CEO Brief',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: CEO_TAGLINE,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-AI-CEO': 'true',
        },
      },
    );
  }
}
