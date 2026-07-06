import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

interface BenchmarkMetric {
  metric: string
  clientValue: number
  industryAverage: number
  stateAverage: number
  firmAverage: number
  industryPercentile: number
  statePercentile: number
  firmPercentile: number
}

interface ClientBenchmarks {
  clientName: string
  metrics: BenchmarkMetric[]
}

// Helper: compute percentile of a value within a sorted array
function computePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 50
  if (sortedValues.length === 1) return 50

  let below = 0
  let equal = 0
  for (const v of sortedValues) {
    if (v < value) below++
    else if (v === value) equal++
  }

  const rank = below + (equal > 1 ? equal / 2 : 0)
  const percentile = (rank / sortedValues.length) * 100
  return Math.round(Math.max(0, Math.min(100, percentile)) * 10) / 10
}

// Helper: deterministic offset from a base value. Uses a seeded pseudo-random
// derived from the metric name + index so the same inputs always produce the
// same outputs (no Math.random — benchmarks must be stable across reloads).
function deterministicOffset(base: number, seed: number): number {
  // Mulberry32-style hash → [0,1) — deterministic, no Math.random.
  const t = (seed + 0x6d2b79f5) | 0
  const x = Math.imul(t ^ (t >>> 15), 1 | t)
  const y = Math.imul(x ^ (x >>> 14), 1 | x)
  const factor = 0.9 + ((y ^ (y >>> 13)) >>> 0) / 0xffffffff * 0.2
  return Math.round(base * factor * 10) / 10
}

// GET /api/ai-benchmark — List ClientBenchmark records grouped by clientId
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientIdParam = searchParams.get('clientId')
    const metricParam = searchParams.get('metric')

    // Try fetching existing benchmarks first
    const where: Record<string, unknown> = {}
    if (clientIdParam) where.clientId = clientIdParam
    if (metricParam) where.metric = metricParam

    const existingBenchmarks = await db.clientBenchmark.findMany({
      where,
      include: {
        client: {
          select: { id: true, tradeName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // If benchmarks exist, return them grouped
    if (existingBenchmarks.length > 0) {
      const grouped: Record<string, ClientBenchmarks> = {}
      const allMetrics: BenchmarkMetric[] = []

      for (const b of existingBenchmarks) {
        const cid = b.clientId
        if (!grouped[cid]) {
          grouped[cid] = {
            clientName: b.client.tradeName,
            metrics: [],
          }
        }

        const metric: BenchmarkMetric = {
          metric: b.metric,
          clientValue: b.clientValue,
          industryAverage: b.industryAverage,
          stateAverage: b.stateAverage,
          firmAverage: b.firmAverage,
          industryPercentile: b.industryPercentile,
          statePercentile: b.statePercentile,
          firmPercentile: b.firmPercentile,
        }

        grouped[cid].metrics.push(metric)
        allMetrics.push(metric)
      }

      const aggregateMetrics = computeAggregateMetrics(allMetrics)
      return NextResponse.json({ benchmarks: grouped, aggregateMetrics })
    }

    // No benchmarks exist — calculate from existing data
    const result = await calculateBenchmarksFromData(clientIdParam, metricParam)
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/ai-benchmark error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch benchmarks' },
      { status: 500 }
    )
  }
}

async function calculateBenchmarksFromData(
  clientIdFilter: string | null,
  metricFilter: string | null
): Promise<{ benchmarks: Record<string, ClientBenchmarks>; aggregateMetrics: BenchmarkMetric[] }> {
  // Fetch active clients
  const clientWhere: Record<string, unknown> = { status: 'active' }
  if (clientIdFilter) clientWhere.id = clientIdFilter

  const clients = await db.client.findMany({
    where: clientWhere,
    select: {
      id: true,
      tradeName: true,
      healthScore: true,
    },
  })

  if (clients.length === 0) {
    return { benchmarks: {}, aggregateMetrics: [] }
  }

  const metrics = ['compliance_score', 'filing_timeliness', 'gst_volume', 'risk_score'] as const
  const filteredMetrics = metricFilter
    ? metrics.filter((m) => m === metricFilter)
    : metrics

  // Fetch invoices and filings in separate queries to avoid complex includes
  const clientIds = clients.map((c) => c.id)

  // Calculate compliance_score: use healthScore
  const healthScoreMap: Record<string, number> = {}
  for (const c of clients) {
    healthScoreMap[c.id] = c.healthScore
  }

  // Calculate filing_timeliness: based on filing status distribution
  const filingTimelinessMap: Record<string, number> = {}
  if (filteredMetrics.includes('filing_timeliness')) {
    const filings = await db.gSTRFiling.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, status: true },
    })

    const filingsByClient: Record<string, { total: number; filed: number }> = {}
    for (const f of filings) {
      if (!filingsByClient[f.clientId]) filingsByClient[f.clientId] = { total: 0, filed: 0 }
      filingsByClient[f.clientId].total++
      if (f.status === 'filed' || f.status === 'submitted') {
        filingsByClient[f.clientId].filed++
      }
    }

    for (const cid of clientIds) {
      const data = filingsByClient[cid]
      if (data && data.total > 0) {
        filingTimelinessMap[cid] = Math.round((data.filed / data.total) * 100)
      } else {
        filingTimelinessMap[cid] = 50
      }
    }
  }

  // Calculate gst_volume and risk_score from invoices
  const gstVolumeMap: Record<string, number> = {}
  const riskScoreMap: Record<string, number> = {}

  if (filteredMetrics.includes('gst_volume') || filteredMetrics.includes('risk_score')) {
    const invoices = await db.invoice.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, totalAmount: true, riskLevel: true },
    })

    const invoiceDataByClient: Record<string, { totalAmount: number; highRisk: number; mediumRisk: number; total: number }> = {}
    for (const inv of invoices) {
      if (!invoiceDataByClient[inv.clientId]) {
        invoiceDataByClient[inv.clientId] = { totalAmount: 0, highRisk: 0, mediumRisk: 0, total: 0 }
      }
      invoiceDataByClient[inv.clientId].totalAmount += inv.totalAmount
      invoiceDataByClient[inv.clientId].total++
      if (inv.riskLevel === 'high' || inv.riskLevel === 'critical') {
        invoiceDataByClient[inv.clientId].highRisk++
      } else if (inv.riskLevel === 'medium') {
        invoiceDataByClient[inv.clientId].mediumRisk++
      }
    }

    for (const cid of clientIds) {
      const data = invoiceDataByClient[cid]

      // gst_volume
      if (filteredMetrics.includes('gst_volume')) {
        const totalAmount = data?.totalAmount ?? 0
        if (totalAmount <= 1000000) {
          gstVolumeMap[cid] = (totalAmount / 1000000) * 40
        } else if (totalAmount <= 10000000) {
          gstVolumeMap[cid] = 40 + ((totalAmount - 1000000) / 9000000) * 30
        } else {
          gstVolumeMap[cid] = Math.min(70 + ((totalAmount - 10000000) / 100000000) * 30, 100)
        }
        gstVolumeMap[cid] = Math.round(gstVolumeMap[cid] * 10) / 10
      }

      // risk_score
      if (filteredMetrics.includes('risk_score')) {
        if (data && data.total > 0) {
          const riskPenalty = ((data.highRisk * 15 + data.mediumRisk * 5) / data.total) * 10
          riskScoreMap[cid] = Math.round(Math.max(0, Math.min(100, 100 - riskPenalty)) * 10) / 10
        } else {
          riskScoreMap[cid] = 75
        }
      }
    }
  }

  // Build client metric data
  interface ClientMetricData {
    clientId: string
    clientName: string
    values: Record<string, number>
  }

  const clientData: ClientMetricData[] = clients.map((client) => {
    const values: Record<string, number> = {}
    if (filteredMetrics.includes('compliance_score')) {
      values['compliance_score'] = healthScoreMap[client.id] ?? 0
    }
    if (filteredMetrics.includes('filing_timeliness')) {
      values['filing_timeliness'] = filingTimelinessMap[client.id] ?? 50
    }
    if (filteredMetrics.includes('gst_volume')) {
      values['gst_volume'] = gstVolumeMap[client.id] ?? 0
    }
    if (filteredMetrics.includes('risk_score')) {
      values['risk_score'] = riskScoreMap[client.id] ?? 75
    }
    return { clientId: client.id, clientName: client.tradeName, values }
  })

  // Calculate averages and percentiles for each metric
  const grouped: Record<string, ClientBenchmarks> = {}

  const industryBases: Record<string, number> = {
    compliance_score: 72,
    filing_timeliness: 78,
    gst_volume: 55,
    risk_score: 68,
  }

  const stateBases: Record<string, number> = {
    compliance_score: 70,
    filing_timeliness: 75,
    gst_volume: 52,
    risk_score: 65,
  }

  for (const metric of filteredMetrics) {
    const allValues = clientData
      .map((cd) => cd.values[metric])
      .filter((v): v is number => v !== undefined)
    const sortedValues = [...allValues].sort((a, b) => a - b)

    const firmAvg =
      sortedValues.length > 0
        ? Math.round((sortedValues.reduce((s, v) => s + v, 0) / sortedValues.length) * 10) / 10
        : 50

    // Deterministic seed from the metric name so results are stable across reloads.
    let metricSeed = 0
    for (let i = 0; i < metric.length; i++) metricSeed = (metricSeed * 31 + metric.charCodeAt(i)) | 0
    const baseIndustry = industryBases[metric] ?? 60
    const baseState = stateBases[metric] ?? 55

    // Generate industry/state comparison datasets (deterministic — no Math.random)
    const industryDataset = sortedValues.map((_, i) => deterministicOffset(baseIndustry, metricSeed + i))
    const stateDataset = sortedValues.map((_, i) => deterministicOffset(baseState, metricSeed + i + 1000))

    for (const cd of clientData) {
      const clientValue = cd.values[metric]
      if (clientValue === undefined) continue

      const industryAverage = deterministicOffset(baseIndustry, metricSeed)
      const stateAverage = deterministicOffset(baseState, metricSeed + 7)

      const industryPercentile = computePercentile(clientValue, industryDataset)
      const statePercentile = computePercentile(clientValue, stateDataset)
      const firmPercentile = computePercentile(clientValue, sortedValues)

      if (!grouped[cd.clientId]) {
        grouped[cd.clientId] = {
          clientName: cd.clientName,
          metrics: [],
        }
      }

      grouped[cd.clientId].metrics.push({
        metric,
        clientValue,
        industryAverage,
        stateAverage,
        firmAverage: firmAvg,
        industryPercentile,
        statePercentile,
        firmPercentile,
      })
    }
  }

  // Compute aggregate metrics
  const allMetrics: BenchmarkMetric[] = []
  for (const cd of Object.values(grouped)) {
    allMetrics.push(...cd.metrics)
  }

  const aggregateMetrics = computeAggregateMetrics(allMetrics)

  return { benchmarks: grouped, aggregateMetrics }
}

function computeAggregateMetrics(allMetrics: BenchmarkMetric[]): BenchmarkMetric[] {
  if (allMetrics.length === 0) return []

  const byMetric: Record<string, BenchmarkMetric[]> = {}
  for (const m of allMetrics) {
    if (!byMetric[m.metric]) byMetric[m.metric] = []
    byMetric[m.metric].push(m)
  }

  const aggregate: BenchmarkMetric[] = []
  for (const [metric, entries] of Object.entries(byMetric)) {
    const count = entries.length
    const avg = (field: keyof Pick<BenchmarkMetric, 'clientValue' | 'industryAverage' | 'stateAverage' | 'firmAverage' | 'industryPercentile' | 'statePercentile' | 'firmPercentile'>) =>
      Math.round((entries.reduce((s, e) => s + e[field], 0) / count) * 10) / 10

    aggregate.push({
      metric,
      clientValue: avg('clientValue'),
      industryAverage: avg('industryAverage'),
      stateAverage: avg('stateAverage'),
      firmAverage: avg('firmAverage'),
      industryPercentile: avg('industryPercentile'),
      statePercentile: avg('statePercentile'),
      firmPercentile: avg('firmPercentile'),
    })
  }

  return aggregate
}
