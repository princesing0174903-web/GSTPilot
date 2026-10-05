// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Intelligence Simulate Engine — POST /api/intelligence/simulate
// ═══════════════════════════════════════════════════════════════════════════════
//
// What-if simulator that uses Digital Twin™ modeling + industry benchmark deltas
// to project outcomes of business decisions.
//
// Scenarios:
//   • hire_employees       • cut_costs
//   • increase_prices      • switch_vendor
//   • expand_city          • automate_process
//   • launch_product
//
// Each scenario computes:
//   • Projected revenue / profit / cash flow / GST / risk / compliance
//   • Industry benchmark percentile impact (delta vs current)
//   • Verdict (proceed | caution | avoid) + rationale
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { computeTwinForecast } from '@/lib/twin/forecast'
import { INDUSTRY_LABELS, type IndustryKey, type SimulateRequest, type SimulateResponse } from './types'
import { currentPeriod, currentDate, isSampleSafe } from './privacy'
import { compareOrgToIndustry } from './benchmark-engine'

// ─── Simulate ─────────────────────────────────────────────────────────────────

export async function simulate(req: SimulateRequest): Promise<SimulateResponse> {
  const today = currentDate()
  const period = currentPeriod()
  const { scenario, industry, magnitudePct, months } = req

  // Pull baseline (current period)
  const baseline = await getBaseline(industry, period)
  const twin = await computeTwinForecast().catch(() => null)

  // Project scenario outcome
  const projection = projectScenario(scenario, baseline, twin, magnitudePct, months)

  // Compute benchmark percentile impact
  const orgFingerprintHash = baseline.myContribution?.orgFingerprint || null
  const benchmarkReport = orgFingerprintHash
    ? await compareOrgToIndustry(orgFingerprintHash, industry, period).catch(() => null)
    : null
  const currentPercentile = benchmarkReport?.overallPercentile || 50
  const projectedPercentile = Math.max(1, Math.min(99, currentPercentile + projection.percentileDelta))

  // Verdict
  const verdict: SimulateResponse['verdict'] =
    projection.percentileDelta > 5 && projection.projectedProfit > 0 ? 'proceed' :
    projection.percentileDelta < -5 || projection.projectedProfit < 0 ? 'avoid' : 'caution'

  // Rationale
  const rationale = buildRationale(scenario, magnitudePct, months, projection, currentPercentile, projectedPercentile, industry)

  return {
    scenario,
    industry,
    inputs: {
      magnitudePct,
      months,
      baselineRevenue: baseline.revenue,
      baselineExpenses: baseline.expenses,
      baselineProfit: baseline.revenue - baseline.expenses,
    },
    outputs: {
      projectedRevenue: round2(projection.projectedRevenue),
      projectedProfit: round2(projection.projectedProfit),
      projectedCashFlow: round2(projection.projectedCashFlow),
      projectedGstLiability: round2(projection.projectedGstLiability),
      projectedRiskScore: round2(projection.projectedRiskScore),
      projectedComplianceScore: round2(projection.projectedComplianceScore),
    },
    industryBenchmarkImpact: {
      projectedPercentile: round2(projectedPercentile),
      currentPercentile: round2(currentPercentile),
      deltaPct: round2(projectedPercentile - currentPercentile),
    },
    verdict,
    rationale,
    generatedAt: today,
  }
}

// ─── Get Baseline ─────────────────────────────────────────────────────────────

interface Baseline {
  revenue: number
  expenses: number
  payroll: number
  gstLiability: number
  collectionDays: number
  complianceScore: number
  vendorRiskScore: number
  healthScore: number
  myContribution: { orgFingerprint: string } | null
}

async function getBaseline(industry: IndustryKey, period: string): Promise<Baseline> {
  const contributions = await db.intelligenceContribution.findMany({
    where: { industry, asOfPeriod: period },
    select: {
      expenseRatioPct: true, payrollRatioPct: true, collectionDays: true,
      complianceScore: true, vendorRiskScore: true, healthScore: true,
      revenueTrendPct: true, orgFingerprint: true,
    },
  })

  // Try to find this org's contribution (last submitted)
  const myContribution = contributions[0] || null

  // Industry averages (privacy-safe)
  const avgExpenseRatio = contributions.length > 0 ? avg(contributions.map((c) => c.expenseRatioPct)) : 60
  const avgPayrollRatio = contributions.length > 0 ? avg(contributions.map((c) => c.payrollRatioPct)) : 25
  const avgCollectionDays = contributions.length > 0 ? avg(contributions.map((c) => c.collectionDays)) : 45
  const avgCompliance = contributions.length > 0 ? avg(contributions.map((c) => c.complianceScore)) : 70
  const avgVendorRisk = contributions.length > 0 ? avg(contributions.map((c) => c.vendorRiskScore)) : 40
  const avgHealth = contributions.length > 0 ? avg(contributions.map((c) => c.healthScore)) : 60

  // Use anonymized avg as baseline revenue proxy (privacy-safe — not individual firm)
  // For twin-integrated projection, the twin forecast provides real org revenue
  const baselineRevenue = 1_000_000 // anonymized baseline; twin projection overlays this
  const baselineExpenses = baselineRevenue * (avgExpenseRatio / 100)
  const baselinePayroll = baselineRevenue * (avgPayrollRatio / 100)

  return {
    revenue: baselineRevenue,
    expenses: baselineExpenses,
    payroll: baselinePayroll,
    gstLiability: baselineRevenue * 0.12, // 12% GST proxy
    collectionDays: avgCollectionDays,
    complianceScore: avgCompliance,
    vendorRiskScore: avgVendorRisk,
    healthScore: avgHealth,
    myContribution: myContribution ? { orgFingerprint: myContribution.orgFingerprint } : null,
  }
}

// ─── Project Scenario ─────────────────────────────────────────────────────────

interface ScenarioProjection {
  projectedRevenue: number
  projectedProfit: number
  projectedCashFlow: number
  projectedGstLiability: number
  projectedRiskScore: number
  projectedComplianceScore: number
  percentileDelta: number
}

function projectScenario(
  scenario: SimulateRequest['scenario'],
  baseline: Baseline,
  twin: Awaited<ReturnType<typeof computeTwinForecast>> | null,
  magnitudePct: number,
  months: number,
): ScenarioProjection {
  // If we have a Twin forecast, use it as the real-revenue overlay.
  // Fall back to the baseline (industry anonymized average) when Twin
  // returns 0 (i.e. no real invoices in the current period) so the
  // simulation remains illustrative.
  const twinRevenueMonthly = (twin && twin.revenue.thirtyDay > 0) ? twin.revenue.thirtyDay : baseline.revenue
  const twinProfitMonthly = (twin && twin.profit.thirtyDay !== 0) ? twin.profit.thirtyDay : baseline.revenue - baseline.expenses
  const twinCashMonthly = (twin && twin.cashFlow.thirtyDay !== 0) ? twin.cashFlow.thirtyDay : baseline.revenue * 0.15
  const twinGstMonthly = (twin && twin.gstLiability.next30d > 0) ? twin.gstLiability.next30d : baseline.gstLiability

  // Scale by months
  const baseRevenue = twinRevenueMonthly * months
  const baseProfit = twinProfitMonthly * months
  const baseCash = twinCashMonthly * months
  const baseGst = twinGstMonthly * months

  let revenueMultiplier = 1
  let expenseMultiplier = 1
  let riskDelta = 0
  let complianceDelta = 0
  let percentileDelta = 0

  switch (scenario) {
    case 'hire_employees':
      // Hiring increases capacity but also expenses
      revenueMultiplier = 1 + (magnitudePct / 100) * 0.6 // 60% revenue capture from new hires
      expenseMultiplier = 1 + (magnitudePct / 100) * 0.8 // 80% of magnitude goes to payroll
      riskDelta = magnitudePct > 20 ? 5 : 0 // over-hiring adds risk
      complianceDelta = 1 // marginal compliance improvement
      percentileDelta = (revenueMultiplier - expenseMultiplier) * 10
      break
    case 'increase_prices':
      // Price increase: revenue up, but demand drops slightly
      revenueMultiplier = 1 + (magnitudePct / 100) * 0.7 // net positive after demand drop
      expenseMultiplier = 1 // no expense change
      riskDelta = magnitudePct > 15 ? 5 : 0 // aggressive pricing adds risk
      percentileDelta = (revenueMultiplier - 1) * 15
      break
    case 'expand_city':
      // Expansion: revenue up, expenses up more upfront
      revenueMultiplier = 1 + (magnitudePct / 100) * 0.5
      expenseMultiplier = 1 + (magnitudePct / 100) * 0.7
      riskDelta = 8
      percentileDelta = (revenueMultiplier - expenseMultiplier) * 8
      break
    case 'launch_product':
      // Product launch: high upside, high expense upfront
      revenueMultiplier = 1 + (magnitudePct / 100) * 0.4
      expenseMultiplier = 1 + (magnitudePct / 100) * 0.9
      riskDelta = 10
      percentileDelta = (revenueMultiplier - expenseMultiplier) * 5
      break
    case 'cut_costs':
      // Cost cut: revenue flat, expenses down
      revenueMultiplier = 1
      expenseMultiplier = 1 - (magnitudePct / 100) * 0.8
      riskDelta = magnitudePct > 20 ? 8 : -2 // aggressive cuts add operational risk
      percentileDelta = (1 - expenseMultiplier) * 12
      break
    case 'switch_vendor':
      // Vendor switch: marginal expense improvement, risk reduced if successful
      revenueMultiplier = 1
      expenseMultiplier = 1 - (magnitudePct / 100) * 0.3
      riskDelta = -8 // reduced concentration
      percentileDelta = 5
      break
    case 'automate_process':
      // Automation: upfront expense, recurring savings
      revenueMultiplier = 1 + (magnitudePct / 100) * 0.1 // marginal revenue from efficiency
      expenseMultiplier = 1 - (magnitudePct / 100) * 0.4
      complianceDelta = 5 // automation improves compliance consistency
      percentileDelta = 8
      break
  }

  const projectedRevenue = baseRevenue * revenueMultiplier
  const projectedExpenses = baseProfit < 0 ? baseRevenue * 0.6 * expenseMultiplier : (baseRevenue - baseProfit) * expenseMultiplier
  const projectedProfit = projectedRevenue - projectedExpenses
  const projectedCashFlow = baseCash * revenueMultiplier
  const projectedGstLiability = baseGst * revenueMultiplier
  const projectedRiskScore = Math.max(0, Math.min(100, baseline.vendorRiskScore + riskDelta))
  const projectedComplianceScore = Math.max(0, Math.min(100, baseline.complianceScore + complianceDelta))

  return {
    projectedRevenue,
    projectedProfit,
    projectedCashFlow,
    projectedGstLiability,
    projectedRiskScore,
    projectedComplianceScore,
    percentileDelta,
  }
}

// ─── Rationale Builder ───────────────────────────────────────────────────────

function buildRationale(
  scenario: SimulateRequest['scenario'],
  magnitudePct: number,
  months: number,
  projection: ScenarioProjection,
  currentPct: number,
  projectedPct: number,
  industry: IndustryKey,
): string {
  const deltaStr = projection.percentileDelta > 0
    ? `improves your industry percentile from ${currentPct}%ile to ${projectedPct}%ile (+${projection.percentileDelta.toFixed(1)} points)`
    : projection.percentileDelta < 0
    ? `reduces your industry percentile from ${currentPct}%ile to ${projectedPct}%ile (${projection.percentileDelta.toFixed(1)} points)`
    : `maintains your industry percentile at ${currentPct}%ile`

  const scenarioLabels: Record<SimulateRequest['scenario'], string> = {
    hire_employees: `Hiring ${magnitudePct}% more employees over ${months} months`,
    increase_prices: `Increasing prices by ${magnitudePct}% over ${months} months`,
    expand_city: `Expanding to a new city with ${magnitudePct}% investment over ${months} months`,
    launch_product: `Launching a new product with ${magnitudePct}% investment over ${months} months`,
    cut_costs: `Cutting costs by ${magnitudePct}% over ${months} months`,
    switch_vendor: `Switching ${magnitudePct}% of vendor spend over ${months} months`,
    automate_process: `Automating ${magnitudePct}% of operations over ${months} months`,
  }

  let s = `${scenarioLabels[scenario]} in the ${INDUSTRY_LABELS[industry]} industry ${deltaStr}. `
  s += `Projected: revenue ₹${projectedRevenueINR(projection.projectedRevenue)}, profit ₹${projectedRevenueINR(projection.projectedProfit)}, `
  s += `risk score ${projection.projectedRiskScore.toFixed(0)}/100, compliance score ${projection.projectedComplianceScore.toFixed(0)}/100. `

  if (projection.percentileDelta > 5) {
    s += `Verdict: PROCEED — strong expected improvement.`
  } else if (projection.percentileDelta < -5) {
    s += `Verdict: AVOID — projected negative impact on industry position.`
  } else if (projection.projectedProfit < 0) {
    s += `Verdict: AVOID — projected loss.`
  } else {
    s += `Verdict: CAUTION — marginal impact, monitor closely.`
  }

  return s
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function projectedRevenueINR(n: number): string {
  if (!isFinite(n)) return '0'
  if (Math.abs(n) >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(2)} L`
  return n.toLocaleString('en-IN')
}
