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

// Helper: compute percentile of a value within a sorted array.
// Returns 50 (median) when the dataset is empty or has a single element —
// i.e. "we don't have enough comparison data" rather than 0 ("worst") or
// 100 ("best").
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

// GET /api/ai-benchmark — List ClientBenchmark records grouped by clientId
//
// ─── No fabrication ───────────────────────────────────────────────────────────
// Previously this route used a `randomize()` (later renamed `deterministicOffset`)
// helper to fabricate industry/state averages from hardcoded bases (72, 78, 55,
// 68) and Math.random offsets. The industry/state percentiles were then computed
// against the fabricated dataset — completely synthetic benchmarks displayed to
// users as real intelligence.
//
// We now compute every field from REAL Prisma data:
//   • clientValue       — real, per-client metric (compliance score, filing
//                          timeliness, GST volume, risk score)
//   • firmAverage       — real mean across clients in the SAME firmId
//   • firmPercentile    — real percentile against same-firm clients
//   • stateAverage      — real mean across clients in the SAME state
//   • statePercentile   — real percentile against same-state clients
//   • industryAverage   — real mean across ALL active clients platform-wide
//   • industryPercentile — real percentile against ALL active clients
//
// If the underlying population is empty (no active clients), we return an
// empty benchmarks object — never fabricated values.
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
): Promise<{
  benchmarks: Record<string, ClientBenchmarks>
  aggregateMetrics: BenchmarkMetric[]
  note?: string
}> {
  // ── Fetch the FULL active-client population (regardless of clientIdFilter).
  // The population is used to compute REAL industry (platform-wide) and state
  // aggregates. The clientIdFilter only narrows which clients get benchmark
  // entries in the response — it does NOT narrow the comparison population.
  const population = await db.client.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      tradeName: true,
      healthScore: true,
      state: true,
      firmId: true,
    },
  })

  if (population.length === 0) {
    return {
      benchmarks: {},
      aggregateMetrics: [],
      note: 'No active clients in the platform — benchmarks require at least one active client.',
    }
  }

  const metrics = ['compliance_score', 'filing_timeliness', 'gst_volume', 'risk_score'] as const
  const filteredMetrics = metricFilter
    ? metrics.filter((m) => m === metricFilter)
    : metrics

  // Fetch invoices and filings in separate queries to avoid complex includes.
  // Scope by the population's clientIds — these are used to compute REAL per-
  // client metric values.
  const populationIds = population.map((c) => c.id)

  // ── Per-client metric values (real) ───────────────────────────────────────
  const healthScoreMap: Record<string, number> = {}
  for (const c of population) {
    healthScoreMap[c.id] = c.healthScore
  }

  // Calculate filing_timeliness from filing status distribution
  const filingTimelinessMap: Record<string, number> = {}
  if (filteredMetrics.includes('filing_timeliness')) {
    const filings = await db.gSTRFiling.findMany({
      where: { clientId: { in: populationIds } },
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

    for (const cid of populationIds) {
      const data = filingsByClient[cid]
      if (data && data.total > 0) {
        filingTimelinessMap[cid] = Math.round((data.filed / data.total) * 100)
      } else {
        // No filings → unknown timeliness. Use 50 (median) rather than 0
        // (which would imply "always late") or 100 (which would imply
        // "always on time").
        filingTimelinessMap[cid] = 50
      }
    }
  }

  // Calculate gst_volume and risk_score from invoices
  const gstVolumeMap: Record<string, number> = {}
  const riskScoreMap: Record<string, number> = {}

  if (filteredMetrics.includes('gst_volume') || filteredMetrics.includes('risk_score')) {
    const invoices = await db.invoice.findMany({
      where: { clientId: { in: populationIds } },
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

    for (const cid of populationIds) {
      const data = invoiceDataByClient[cid]

      // gst_volume: real, derived from total invoice amount
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

      // risk_score: real, derived from invoice risk-level distribution
      if (filteredMetrics.includes('risk_score')) {
        if (data && data.total > 0) {
          const riskPenalty = ((data.highRisk * 15 + data.mediumRisk * 5) / data.total) * 10
          riskScoreMap[cid] = Math.round(Math.max(0, Math.min(100, 100 - riskPenalty)) * 10) / 10
        } else {
          // No invoices → no risk signal. Use 75 (above-average) rather than
          // 0 (worst) since absence of invoices is not evidence of risk.
          riskScoreMap[cid] = 75
        }
      }
    }
  }

  // ── Build per-client metric values ────────────────────────────────────────
  interface ClientMetricData {
    clientId: string
    clientName: string
    state: string | null
    firmId: string | null
    values: Record<string, number>
  }

  const clientData: ClientMetricData[] = population.map((client) => {
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
    return {
      clientId: client.id,
      clientName: client.tradeName,
      state: client.state,
      firmId: client.firmId,
      values,
    }
  })

  // ── Compute REAL aggregates for each metric ───────────────────────────────
  // For each metric, compute three populations:
  //   • industry (all active clients platform-wide)
  //   • state    (clients in the same state as the target client)
  //   • firm     (clients in the same firmId as the target client)
  // All averages and percentiles are derived from these real populations.
  const grouped: Record<string, ClientBenchmarks> = {}

  for (const metric of filteredMetrics) {
    // Industry population: all active clients' values for this metric
    const industryValues = clientData
      .map((cd) => cd.values[metric])
      .filter((v): v is number => v !== undefined)
    const industrySorted = [...industryValues].sort((a, b) => a - b)
    const industryAvg =
      industrySorted.length > 0
        ? Math.round((industrySorted.reduce((s, v) => s + v, 0) / industrySorted.length) * 10) / 10
        : 0

    for (const cd of clientData) {
      // Skip clients not matching the clientIdFilter (if provided)
      if (clientIdFilter && cd.clientId !== clientIdFilter) continue

      const clientValue = cd.values[metric]
      if (clientValue === undefined) continue

      // State population: clients in the same state (real)
      const stateValues = clientData
        .filter((other) => other.state !== null && other.state === cd.state)
        .map((other) => other.values[metric])
        .filter((v): v is number => v !== undefined)
      const stateSorted = [...stateValues].sort((a, b) => a - b)
      const stateAvg =
        stateSorted.length > 0
          ? Math.round((stateSorted.reduce((s, v) => s + v, 0) / stateSorted.length) * 10) / 10
          : industryAvg // fall back to industry average when no same-state peers

      // Firm population: clients in the same firmId (real)
      const firmValues = clientData
        .filter((other) => other.firmId !== null && other.firmId === cd.firmId)
        .map((other) => other.values[metric])
        .filter((v): v is number => v !== undefined)
      const firmSorted = [...firmValues].sort((a, b) => a - b)
      const firmAvg =
        firmSorted.length > 0
          ? Math.round((firmSorted.reduce((s, v) => s + v, 0) / firmSorted.length) * 10) / 10
          : industryAvg // fall back to industry average when no same-firm peers

      if (!grouped[cd.clientId]) {
        grouped[cd.clientId] = {
          clientName: cd.clientName,
          metrics: [],
        }
      }

      grouped[cd.clientId].metrics.push({
        metric,
        clientValue,
        industryAverage: industryAvg,
        stateAverage: stateAvg,
        firmAverage: firmAvg,
        industryPercentile: computePercentile(clientValue, industrySorted),
        statePercentile: computePercentile(clientValue, stateSorted),
        firmPercentile: computePercentile(clientValue, firmSorted),
      })
    }
  }

  // Compute aggregate metrics
  const allMetrics: BenchmarkMetric[] = []
  for (const cd of Object.values(grouped)) {
    allMetrics.push(...cd.metrics)
  }

  const aggregateMetrics = computeAggregateMetrics(allMetrics)

  return {
    benchmarks: grouped,
    aggregateMetrics,
    note:
      population.length < 5
        ? `Benchmarks computed from ${population.length} active client(s). Industry/state/firm aggregates are most meaningful with a larger population.`
        : undefined,
  }
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
