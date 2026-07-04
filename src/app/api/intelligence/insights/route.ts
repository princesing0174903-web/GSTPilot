// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/insights
// ═══════════════════════════════════════════════════════════════════════════════
// Enterprise Insight Feed™ — today's Oracle feed.
// Query params:
//   • firmId   (optional — for personalized recommendations within the feed)
//   • industry (optional — defaults to 'professional_services')
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { generateInsightFeed } from '@/lib/intelligence/insight-feed'
import { computeOrgFingerprint } from '@/lib/intelligence/privacy'
import type { IndustryKey } from '@/lib/intelligence/types'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/insights', async ({ query }) => {
    const industry = (query.get('industry') as IndustryKey) || 'professional_services'
    const firmId = query.get('firmId')
    const personalizedFingerprint = firmId ? computeOrgFingerprint(firmId) : null

    const feed = await generateInsightFeed(industry, personalizedFingerprint)
    return feed
  })
}
