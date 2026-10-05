// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/knowledge
// ═══════════════════════════════════════════════════════════════════════════════
// Cross-Company Knowledge Graph™ — anonymous business knowledge graph.
// Query params:
//   • limit (optional — defaults to 50; max 200)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { getKnowledgeGraphReport, buildKnowledgeGraphFromContributions } from '@/lib/intelligence/knowledge-graph'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/knowledge', async ({ query }) => {
    const limit = Math.min(200, parseInt(query.get('limit') || '50', 10))

    // Optionally rebuild the graph if requested
    const rebuild = query.get('rebuild') === 'true'
    if (rebuild) {
      await buildKnowledgeGraphFromContributions()
    }

    const report = await getKnowledgeGraphReport(limit)
    return report
  })
}
