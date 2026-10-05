// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/dashboard
// ═══════════════════════════════════════════════════════════════════════════════
// Unified Intelligence Dashboard bundle — all 11 subsystem summaries in one call.
// Query params:
//   • firmId    (optional) — firm identifier (anonymized before persistence)
//   • firmState (optional) — firm state/region (anonymized)
//   • contribute (optional) — if 'true', submits an anonymized contribution first
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { getIntelligenceDashboard } from '@/lib/intelligence/orchestrator'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/dashboard', async ({ query }) => {
    const firmId = query.get('firmId') || undefined
    const firmState = query.get('firmState') || undefined
    const contribute = query.get('contribute') === 'true'

    const bundle = await getIntelligenceDashboard({
      firmId,
      firmState,
      contribute,
    })

    return bundle
  })
}
