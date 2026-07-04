// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/industry
// ═══════════════════════════════════════════════════════════════════════════════
// AI Industry Advisor™ — industry-specific knowledge base + benchmarks.
// Query params:
//   • industry (required — one of 12 supported industries)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { computeIndustryBenchmarks } from '@/lib/intelligence/benchmark-engine'
import { getMarketIntelligenceReport } from '@/lib/intelligence/market-intelligence'
import { INDUSTRY_LABELS, type IndustryKey } from '@/lib/intelligence/types'
import { aggregateContributions } from '@/lib/intelligence/data-cloud'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/industry', async ({ query }) => {
    const industry = (query.get('industry') as IndustryKey) || 'professional_services'

    const [benchmarks, marketReport, aggregates] = await Promise.all([
      computeIndustryBenchmarks(industry),
      getMarketIntelligenceReport(),
      aggregateContributions(industry),
    ])

    const industrySignals = marketReport.signals.filter(
      (s) => s.affectedIndustries.includes(industry),
    )

    return {
      industry,
      industryLabel: INDUSTRY_LABELS[industry],
      aggregates,
      benchmarks,
      relatedSignals: industrySignals.slice(0, 10),
      industryOutlook: marketReport.industryOutlook[industry] || 'stable',
      oracleSummary: `${INDUSTRY_LABELS[industry]} industry outlook: ${marketReport.industryOutlook[industry] || 'stable'}. ${aggregates ? `Sample size: ${aggregates.orgCount} firms.` : 'Awaiting more contributors.'} ${industrySignals.length} active market signals.`,
    }
  })
}
