// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ — Operating System API
// GET /api/ai-cfo
//
// Returns the full CFO intelligence bundle:
//   Module 1: CFO Dashboard metrics
//   Module 2: Financial Prediction Engine
//   Module 3: Business Risk Engine (with WHY explanations)
//   Module 4: Daily CFO Brief
//   Module 6: CFO Recommendation Engine
//   Module 8: CFO Memory (pattern recognition)
//
// The LLM (Module 5 Ask CFO + Module 9 CFO Personality) lives in /api/oracle/chat.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const insights = await generateCFOInsights(null);
    return NextResponse.json(insights);
  } catch (error) {
    console.error('[AI-CFO] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute CFO insights',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
