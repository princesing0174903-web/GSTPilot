// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/recommendations
// ═══════════════════════════════════════════════════════════════════════════════
// Global Recommendation Engine™ — recommendations based on worldwide patterns.
// Query params:
//   • firmId   (optional — for personalized recommendations)
//   • industry (optional — defaults to 'professional_services')
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { generateRecommendations } from '@/lib/intelligence/recommendation-engine'
import { computeOrgFingerprint } from '@/lib/intelligence/privacy'
import type { IndustryKey } from '@/lib/intelligence/types'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/recommendations', async ({ query }) => {
    const industry = (query.get('industry') as IndustryKey) || 'professional_services'
    const firmId = query.get('firmId')
    const personalizedFingerprint = firmId ? computeOrgFingerprint(firmId) : null

    const report = await generateRecommendations(personalizedFingerprint, industry)
    return report
  })
}
