// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/governance?datasetKey=<string>
// Data Governance™ — returns governance policies + summary, OR access history
// for a specific dataset when datasetKey is supplied. REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getGovernancePolicies,
  getGovernanceSummary,
  getAccessHistory,
} from '@/lib/data-intelligence';

export async function GET(request: NextRequest) {
  try {
    const datasetKey = request.nextUrl.searchParams.get('datasetKey');

    if (datasetKey) {
      const history = await getAccessHistory(datasetKey);
      return NextResponse.json({ ok: true, history });
    }

    const [policies, summary] = await Promise.all([
      getGovernancePolicies(),
      getGovernanceSummary(),
    ]);

    return NextResponse.json({ ok: true, policies, summary });
  } catch (err) {
    console.error('[/api/data/governance] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load governance data',
        policies: [],
        summary: null,
        history: [],
      },
      { status: 500 },
    );
  }
}
