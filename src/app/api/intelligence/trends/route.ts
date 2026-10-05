// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/trends
// ═══════════════════════════════════════════════════════════════════════════════
// Industry growth trends, hiring trends, compliance trends.
// Query params:
//   • industry (optional)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi } from '@/lib/intelligence/api-helpers'
import { getGlobalAnalyticsDashboard } from '@/lib/intelligence/analytics-dashboard'

export async function GET(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/trends', async () => {
    const dashboard = await getGlobalAnalyticsDashboard()
    return {
      asOfDate: dashboard.asOfDate,
      growthTrends: dashboard.growthTrends,
      hiringTrends: dashboard.hiringTrends,
      complianceTrends: dashboard.complianceTrends,
      economicOutlook: dashboard.economicOutlook,
      oracleSummary: `Oracle is tracking ${dashboard.growthTrends.length} active industry growth trends. Outlook: ${dashboard.economicOutlook}.`,
    }
  })
}
