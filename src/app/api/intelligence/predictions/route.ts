// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/predictions
// ═══════════════════════════════════════════════════════════════════════════════
// Active predictions for an industry or org.
// Query params:
//   • firmId   (optional — enables org-scoped predictions via Digital Twin™)
//   • industry (optional — defaults to 'professional_services')
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { generateOrgPredictions, generateIndustryPredictions } from '@/lib/intelligence/predictive-engine'
import { computeOrgFingerprint } from '@/lib/intelligence/privacy'
import type { IndustryKey } from '@/lib/intelligence/types'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/predictions', async ({ query }) => {
    const industry = (query.get('industry') as IndustryKey) || 'professional_services'
    const firmId = query.get('firmId')
    const personalizedFingerprint = firmId ? computeOrgFingerprint(firmId) : null

    if (personalizedFingerprint) {
      const predictions = await generateOrgPredictions(personalizedFingerprint, industry)
      return {
        asOfDate: predictions[0]?.asOfDate || new Date().toISOString().slice(0, 10),
        industry,
        predictions,
        count: predictions.length,
      }
    }

    const industryPredictions = await generateIndustryPredictions(industry)
    return {
      asOfDate: industryPredictions[0]?.asOfDate || new Date().toISOString().slice(0, 10),
      industry,
      predictions: industryPredictions,
      count: industryPredictions.length,
    }
  })
}
