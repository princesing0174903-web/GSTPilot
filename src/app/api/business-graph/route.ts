import { NextResponse } from 'next/server'
import { buildBusinessGraph } from '@/lib/business-graph'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/business-graph — Business Graph™ (Phase 3)
//
// Thin route that delegates to the shared assembler in src/lib/business-graph.ts.
// The assembler is reused by /api/business-graph/ai so we never query the DB twice.
//
//   GET  → { hasData, nodes, edges, health, stats, connections }
//
// NO fake data. If the DB is empty, hasData=false and the frontend shows the
// "Connect your data sources to activate your Business Graph" empty state.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const graph = await buildBusinessGraph()
    return NextResponse.json(graph)
  } catch (error) {
    console.error('[/api/business-graph] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to build business graph.' },
      { status: 500 },
    )
  }
}
