// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/benchmarks
// ═══════════════════════════════════════════════════════════════════════════════
// Industry Benchmark Engine™ — compare an org against industry peers.
// Query params:
//   • firmId   (required for personalized comparison; otherwise returns industry-only)
//   • industry (optional — defaults to 'professional_services')
//   • period   (optional — defaults to current YYYY-MM)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { compareOrgToIndustry, computeIndustryBenchmarks } from '@/lib/intelligence/benchmark-engine'
import { computeOrgFingerprint, currentPeriod } from '@/lib/intelligence/privacy'
import type { IndustryKey } from '@/lib/intelligence/types'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/benchmarks', async ({ orgFingerprint, query }) => {
    const industry = (query.get('industry') as IndustryKey) || 'professional_services'
    const period = query.get('period') || currentPeriod()
    const firmId = query.get('firmId')

    // If firmId is provided, compute the org fingerprint for personalized comparison
    const personalizedFingerprint = firmId ? computeOrgFingerprint(firmId) : orgFingerprint

    if (personalizedFingerprint) {
      const report = await compareOrgToIndustry(personalizedFingerprint, industry, period)
      return report
    }

    // Otherwise, return industry-wide benchmarks (no org comparison)
    const benchmarks = await computeIndustryBenchmarks(industry, period)
    return {
      industry,
      industryLabel: industry,
      asOfPeriod: period,
      sampleSize: benchmarks[0]?.sampleSize || 0,
      comparisons: [],
      overallPercentile: null,
      oracleNarrative: 'Provide a firmId parameter to receive personalized benchmark comparisons.',
    }
  })
}
