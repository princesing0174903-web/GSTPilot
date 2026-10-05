// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/intelligence/simulate
// ═══════════════════════════════════════════════════════════════════════════════
// What-if simulator using Digital Twin™ modeling + industry benchmark deltas.
// Body:
//   • scenario     (required) — hire_employees | increase_prices | expand_city |
//                               launch_product | cut_costs | switch_vendor |
//                               automate_process
//   • industry     (required) — IndustryKey
//   • magnitudePct (required) — percentage magnitude (e.g., 10 = 10%)
//   • months       (required) — simulation horizon in months
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi, parseBody } from '@/lib/intelligence/api-helpers'
import { simulate } from '@/lib/intelligence/simulate-engine'
import type { SimulateRequest } from '@/lib/intelligence/types'

export async function POST(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/simulate', async () => {
    const body = await parseBody<SimulateRequest>(req)
    if (!body || !body.scenario || !body.industry || typeof body.magnitudePct !== 'number' || typeof body.months !== 'number') {
      throw new Error('scenario, industry, magnitudePct (number), and months (number) are required')
    }

    const result = await simulate(body)
    return result
  })
}
