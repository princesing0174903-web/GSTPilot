// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/intelligence/predict
// ═══════════════════════════════════════════════════════════════════════════════
// Predict a specific metric for an industry or org.
// Body:
//   • predictionType (required) — one of PREDICTION_TYPES
//   • industry       (required) — IndustryKey
//   • firmId         (optional) — for org-scoped prediction
//   • horizonDays    (optional) — default 90
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi, parseBody } from '@/lib/intelligence/api-helpers'
import { predictSpecific, type PredictRequest } from '@/lib/intelligence/predictive-engine'
import { computeOrgFingerprint } from '@/lib/intelligence/privacy'
import type { AnalyzeRequest } from '@/lib/intelligence/types'

interface PredictBody {
  predictionType: PredictRequest['predictionType']
  industry: PredictRequest['industry']
  firmId?: string
  horizonDays?: number
}

export async function POST(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/predict', async () => {
    const body = await parseBody<PredictBody>(req)
    if (!body || !body.predictionType || !body.industry) {
      throw new Error('predictionType and industry are required')
    }

    const orgFingerprintHash = body.firmId ? computeOrgFingerprint(body.firmId) : undefined

    const prediction = await predictSpecific({
      predictionType: body.predictionType,
      industry: body.industry,
      orgFingerprintHash,
      horizonDays: body.horizonDays,
    })

    return prediction
  })
}

// Re-export type for clarity
export type { AnalyzeRequest }
