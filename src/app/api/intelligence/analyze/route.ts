// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/intelligence/analyze
// ═══════════════════════════════════════════════════════════════════════════════
// Unified natural-language analysis across all subsystems.
// Body:
//   • question   (required) — natural-language question
//   • industry   (optional) — industry scope
//   • horizonDays (optional) — prediction horizon (default 90)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi, parseBody } from '@/lib/intelligence/api-helpers'
import { analyze } from '@/lib/intelligence/analyze-engine'
import type { AnalyzeRequest } from '@/lib/intelligence/types'

export async function POST(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/analyze', async () => {
    const body = await parseBody<AnalyzeRequest>(req)
    if (!body || !body.question || body.question.trim().length === 0) {
      throw new Error('Question is required')
    }
    return await analyze(body)
  })
}
