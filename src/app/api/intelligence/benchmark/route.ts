// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/intelligence/benchmark
// ═══════════════════════════════════════════════════════════════════════════════
// Benchmark an arbitrary value against industry peers.
// Body:
//   • industry (required)
//   • metric   (required) — one of BENCHMARK_METRICS
//   • value    (required) — numeric value to compare
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { withIntelligenceApi, parseBody } from '@/lib/intelligence/api-helpers'
import { benchmarkValue } from '@/lib/intelligence/benchmark-engine'
import type { BenchmarkMetric, IndustryKey } from '@/lib/intelligence/types'

interface BenchmarkBody {
  industry: IndustryKey
  metric: BenchmarkMetric
  value: number
}

export async function POST(req: NextRequest) {
  return withIntelligenceApi(req, '/api/intelligence/benchmark', async () => {
    const body = await parseBody<BenchmarkBody>(req)
    if (!body || !body.industry || !body.metric || typeof body.value !== 'number') {
      throw new Error('industry, metric, and value (number) are required')
    }

    const comparison = await benchmarkValue(body.industry, body.metric, body.value)
    return comparison
  })
}
