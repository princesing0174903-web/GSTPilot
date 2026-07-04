// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Industry Advisor™
// Phase 7 — Subsystem 7
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every industry receives specialized AI intelligence. 12 supported industries:
//   Manufacturing, Retail, Healthcare, Construction, Education, Hospitality,
//   Logistics, Professional Services, IT, E-Commerce, Wholesale, Finance
//
// For each industry, the advisor:
//   • Loads industry-specific expertise (regulations, KPIs, common pitfalls)
//   • Pulls the latest benchmarks from Industry Benchmark Engine™
//   • Surfaces active market signals relevant to the industry
//   • Generates actionable advice grounded in REAL aggregated data
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { compareOrgToIndustry, computeIndustryBenchmarks } from './benchmark-engine'
import { getMarketIntelligenceReport } from './market-intelligence'
import {
  INDUSTRY_LABELS,
  type BenchmarkMetric,
  type IndustryAdvisorAdvice,
  type IndustryKey,
  type MarketSignal,
} from './types'
import { currentPeriod, currentDate, isSampleSafe } from './privacy'

// ─── Industry Knowledge Base ──────────────────────────────────────────────────

interface IndustryKnowledge {
  industry: IndustryKey
  label: string
  tagline: string
  regulations: string[]
  kpis: string[]
  commonPitfalls: string[]
  opportunities: string[]
  benchmarkFocus: BenchmarkMetric[]
  recommendedActions: string[]
}

const INDUSTRY_KB: Record<IndustryKey, IndustryKnowledge> = {
  manufacturing: {
    industry: 'manufacturing',
    label: 'Manufacturing',
    tagline: 'Optimize production cycles, working capital, and GST input credit recovery',
    regulations: ['GST on raw materials & capital goods', 'Excise on specific goods', 'Factory Act compliance', 'Environmental clearances'],
    kpis: ['Inventory turnover', 'Production cycle time', 'ITC recovery rate', 'Order-to-cash cycle'],
    commonPitfalls: ['Under-claiming ITC on capital goods', 'Slow inventory turnover tying up working capital', 'GST mismatch between purchase and sales ledgers'],
    opportunities: ['PLI scheme benefits', 'Export incentives', 'Automation of purchase reconciliation'],
    benchmarkFocus: ['inventoryTurnover', 'gstCompliance', 'workingCapital', 'collectionDays'],
    recommendedActions: ['Automate purchase bill reconciliation to maximize ITC recovery', 'Reduce raw material inventory holding to free working capital', 'Audit GST HSN classifications for rate optimization'],
  },
  retail: {
    industry: 'retail',
    label: 'Retail',
    tagline: 'Maximize margins, optimize inventory mix, and accelerate collections',
    regulations: ['GST on B2C sales', 'State-specific VAT legacy issues', 'FSSAI for food retail', 'Weights & measures compliance'],
    kpis: ['Gross margin %', 'Stock turn', 'Same-store sales growth', 'Customer retention'],
    commonPitfalls: ['GST rate misclassification on consumer goods', 'High shrinkage and stock obsolescence', 'Slow-moving inventory tying up capital'],
    opportunities: ['Festive demand cycles', 'Omnichannel expansion', 'Quick-commerce partnerships'],
    benchmarkFocus: ['salesGrowth', 'customerRetention', 'inventoryTurnover', 'expenseRatio'],
    recommendedActions: ['Audit HSN codes for rate optimization on top SKUs', 'Implement stock aging analysis to clear slow-movers', 'Deploy loyalty programs to boost retention'],
  },
  healthcare: {
    industry: 'healthcare',
    label: 'Healthcare',
    tagline: 'Balance GST-exempt and taxable services while managing receivables',
    regulations: ['GST exemption on healthcare services', 'Drug pricing (DPCO/NPPA)', 'Clinical Establishments Act', 'Bio-medical waste rules'],
    kpis: ['Bed occupancy', 'AR days (receivables)', 'Patient satisfaction', 'Drug inventory turn'],
    commonPitfalls: ['GST confusion on diagnostic vs consultation', 'Long insurance TAT affecting cash flow', 'Expired drug write-offs'],
    opportunities: ['Telemedicine expansion', 'Insurance partnerships', 'Day-care procedure growth'],
    benchmarkFocus: ['collectionDays', 'workingCapital', 'customerRetention', 'gstCompliance'],
    recommendedActions: ['Streamline insurance claim TAT to accelerate receivables', 'Implement FEFO inventory for drugs', 'Clarify GST applicability on diagnostics'],
  },
  construction: {
    industry: 'construction',
    label: 'Construction',
    tagline: 'Manage reverse charge, contractor payments, and project cash flow',
    regulations: ['RCM on subcontractor services', 'GST on construction services', 'RERA compliance', 'Labour cess'],
    kpis: ['Project completion %', 'Working capital cycle', 'Material wastage %', 'Subcontractor TAT'],
    commonPitfalls: ['RCM underpayment on subcontractors', 'Long working capital cycles straining cash', 'Material pilferage'],
    opportunities: ['Infrastructure spend cycle', 'Affordable housing incentives', 'Green building premium'],
    benchmarkFocus: ['workingCapital', 'collectionDays', 'expenseRatio', 'vendorRisk'],
    recommendedActions: ['Automate RCM calculation on subcontractor bills', 'Tighten milestone-based billing to improve cash cycle', 'Audit material reconciliation'],
  },
  education: {
    industry: 'education',
    label: 'Education',
    tagline: 'Navigate GST exemptions while optimizing fee collections',
    regulations: ['GST exemption on core education', 'GST on auxiliary services', 'Affiliation norms', 'Fee regulatory caps'],
    kpis: ['Fee collection ratio', 'Student retention', 'Cost per student', 'Auxiliary revenue mix'],
    commonPitfalls: ['GST misclassification on auxiliary services', 'Slow fee collection cycles', 'High fixed cost base'],
    opportunities: ['EdTech integration', 'Skill course expansion', 'Corporate training partnerships'],
    benchmarkFocus: ['collectionDays', 'customerRetention', 'expenseRatio', 'payrollRatio'],
    recommendedActions: ['Digitize fee collection with reminders and EMI options', 'Audit GST on transport/hostel/auxiliary services', 'Diversify revenue with skill courses'],
  },
  hospitality: {
    industry: 'hospitality',
    label: 'Hospitality',
    tagline: 'Optimize occupancy-based revenue and GST on room tariffs',
    regulations: ['GST tariff slabs on room rates', 'GST on F&B services', 'Liquor licensing', 'Health & safety compliance'],
    kpis: ['Occupancy %', 'ADR (avg daily rate)', 'RevPAR', 'F&B margin'],
    commonPitfalls: ['GST slab misclassification on room rates', 'High attrition inflating payroll', 'Seasonal cash flow volatility'],
    opportunities: ['Domestic tourism surge', 'Wedding & MICE segment', 'Boutique stay premium'],
    benchmarkFocus: ['salesGrowth', 'payrollRatio', 'expenseRatio', 'customerRetention'],
    recommendedActions: ['Verify GST slab applicability on dynamic room pricing', 'Implement seasonal pricing to smooth revenue', 'Cross-train staff to reduce attrition cost'],
  },
  logistics: {
    industry: 'logistics',
    label: 'Logistics',
    tagline: 'Manage fuel costs, GST on freight, and vendor reliability',
    regulations: ['GST on freight (5% with ITC or 12% without)', 'E-way bill compliance', 'Vehicle permits', 'Fleet safety norms'],
    kpis: ['Cost per km', 'On-time delivery %', 'Fleet utilization', 'Fuel cost %'],
    commonPitfalls: ['GST option mis-selection on freight', 'E-way bill generation delays', 'High empty-running ratio'],
    opportunities: ['Express logistics growth', 'Cold chain expansion', 'EV fleet transition'],
    benchmarkFocus: ['expenseRatio', 'vendorRisk', 'collectionDays', 'salesGrowth'],
    recommendedActions: ['Evaluate GST option (5% vs 12%) on freight by lane', 'Automate e-way bill generation', 'Optimize lane planning to reduce empty runs'],
  },
  professional_services: {
    industry: 'professional_services',
    label: 'Professional Services',
    tagline: 'Optimize RCM on services and accelerate client billing',
    regulations: ['RCM on GTA & legal services', 'GST on professional fees', 'Profession tax', 'Firm-level compliance'],
    kpis: ['Realization rate', 'Utilization %', 'Realization per partner', 'AR aging'],
    commonPitfalls: ['RCM underpayment on imported services', 'Slow timesheet-to-invoice cycle', 'High WIP lock-up'],
    opportunities: ['Regulatory complexity driving advisory demand', 'AI-augmented service delivery', 'Niche specialization premium'],
    benchmarkFocus: ['collectionDays', 'payrollRatio', 'workingCapital', 'customerRetention'],
    recommendedActions: ['Automate RCM tracking on reverse-charge services', 'Shorten timesheet-to-invoice cycle', 'Implement matter profitability analytics'],
  },
  it: {
    industry: 'it',
    label: 'IT & Software',
    tagline: 'Manage STPI/SEZ compliance, export GST, and offshore billing',
    regulations: ['GST zero-rated on exports (LUT/Bond)', 'STPI/SEZ compliance', 'POSH compliance', 'Data protection (DPDP Act)'],
    kpis: ['Billable utilization', 'Revenue per employee', 'Gross margin %', 'Customer concentration'],
    commonPitfalls: ['LUT filing lapses affecting export GST', 'Customer concentration risk', 'Slow offshore billing realization'],
    opportunities: ['AI service line expansion', 'BFSI/healthcare vertical growth', 'GCC (Global Capability Center) wave'],
    benchmarkFocus: ['salesGrowth', 'payrollRatio', 'customerRetention', 'vendorRisk'],
    recommendedActions: ['File LUT timely to preserve zero-rated export status', 'Diversify top-3 customer concentration', 'Accelerate offshore billing realization'],
  },
  ecommerce: {
    industry: 'ecommerce',
    label: 'E-Commerce',
    tagline: 'Navigate TCS, marketplace commissions, and rapid scale',
    regulations: ['GST TCS by marketplaces (1%)', 'GST on commissions', 'Consumer Protection (E-Commerce) Rules', 'FDI compliance'],
    kpis: ['GMV growth', 'Contribution margin', 'Customer acquisition cost', 'Return rate'],
    commonPitfalls: ['TCS reconciliation mismatches', 'High return rate eroding margin', 'Cash-on-delivery leakages'],
    opportunities: ['Tier-2/3 expansion', 'D2C brand partnerships', 'Quick-commerce adjacencies'],
    benchmarkFocus: ['salesGrowth', 'expenseRatio', 'customerRetention', 'vendorRisk'],
    recommendedActions: ['Reconcile marketplace TCS monthly to claim ITC', 'Analyze return root-causes to lift margin', 'Audit COD leakages'],
  },
  wholesale: {
    industry: 'wholesale',
    label: 'Wholesale',
    tagline: 'Optimize bulk margins, vendor terms, and GST chain integrity',
    regulations: ['GST B2B invoicing compliance', 'E-way bill on bulk shipments', 'Stock transfer rules', 'Anti-profiteering'],
    kpis: ['Inventory turn', 'Gross margin %', 'Vendor payment terms', 'Order fill rate'],
    commonPitfalls: ['GST chain breaks affecting ITC', 'Long inventory holding', 'Vendor concentration'],
    opportunities: ['B2B marketplace adoption', 'Direct-to-retail models', 'Bulk logistics savings'],
    benchmarkFocus: ['inventoryTurnover', 'workingCapital', 'vendorRisk', 'expenseRatio'],
    recommendedActions: ['Audit GST chain integrity across B2B network', 'Negotiate longer vendor payment terms', 'Optimize bulk shipment consolidation'],
  },
  finance: {
    industry: 'finance',
    label: 'Finance',
    tagline: 'Navigate financial sector GST, NBFC norms, and credit risk',
    regulations: ['GST on financial services (18%)', 'RBI/NBFC norms', 'SARFAESI compliance', 'AML/KYC compliance'],
    kpis: ['Net interest margin', 'Gross NPA %', 'Cost-to-income ratio', 'Credit-deposit ratio'],
    commonPitfalls: ['GST input credit restriction on financial services', 'Rising NPAs straining capital', 'High operational cost base'],
    opportunities: ['Digital lending growth', 'SME credit demand', 'Embedded finance partnerships'],
    benchmarkFocus: ['expenseRatio', 'vendorRisk', 'collectionDays', 'workingCapital'],
    recommendedActions: ['Optimize GST input credit recovery where permitted', 'Strengthen early-warning NPA detection', 'Digitize lending workflows'],
  },
}

// ─── Industry Advisor ────────────────────────────────────────────────────────

/**
 * Provide specialized AI advisory for a question scoped to an industry.
 * Grounded in:
 *   • Industry knowledge base (regulations, KPIs, pitfalls, opportunities)
 *   • Latest industry benchmarks (from anonymized contributions)
 *   • Active market signals relevant to the industry
 *
 * The session is persisted (anonymized) so the industry-wide pattern pool grows.
 */
export async function provideIndustryAdvice(
  industry: IndustryKey,
  question: string,
  orgFingerprintHash?: string,
): Promise<IndustryAdvisorAdvice> {
  const today = currentDate()
  const period = currentPeriod()
  const kb = INDUSTRY_KB[industry]
  const questionLc = question.toLowerCase().trim()

  // Pull benchmarks for this industry
  const benchmarkReport = orgFingerprintHash
    ? await compareOrgToIndustry(orgFingerprintHash, industry, period)
    : null
  const benchmarksRaw = await computeIndustryBenchmarks(industry, period)

  // Pull market signals relevant to this industry
  const marketReport = await getMarketIntelligenceReport()
  const industrySignals = marketReport.signals.filter(
    (s) => s.affectedIndustries.includes(industry) || s.affectedRegions.includes('all'),
  )

  // Build advice summary
  const adviceSummary = buildAdviceSummary(kb, questionLc, benchmarkReport, industrySignals, benchmarksRaw)

  // Key actions — combine KB-recommended actions with benchmark-driven gaps
  const keyActions = buildKeyActions(kb, benchmarkReport)

  // Benchmarks payload
  const benchmarks: IndustryAdvisorAdvice['benchmarks'] = {}
  if (benchmarkReport) {
    for (const c of benchmarkReport.comparisons) {
      benchmarks[c.metric] = {
        yourValue: c.yourValue,
        percentile: c.percentile,
        insight: c.insight,
      }
    }
  }

  // Risk flags
  const riskFlags = buildRiskFlags(kb, benchmarkReport, industrySignals)

  // Opportunities
  const opportunities = buildOpportunities(kb, benchmarkReport, industrySignals)

  // Confidence
  const confidencePct = computeConfidence(benchmarksRaw, industrySignals)

  // Oracle closing
  const oracleClosing = buildOracleClosing(industry, benchmarkReport, opportunities.length, riskFlags.length)

  // Persist session (anonymized — no firm identity)
  const session = await db.industryAdvisorSession.create({
    data: {
      industry,
      question,
      adviceSummary,
      keyActions: JSON.stringify(keyActions),
      benchmarks: JSON.stringify(benchmarks),
      riskFlags: JSON.stringify(riskFlags),
      opportunities: JSON.stringify(opportunities),
      confidencePct,
      anonymizedForPool: true,
    },
  })

  return {
    sessionId: session.id,
    industry,
    industryLabel: kb.label,
    question,
    adviceSummary,
    keyActions,
    benchmarks,
    riskFlags,
    opportunities,
    confidencePct,
    relatedSignals: industrySignals.slice(0, 5),
    oracleClosing,
  }
}

// ─── Build Helpers ────────────────────────────────────────────────────────────

function buildAdviceSummary(
  kb: IndustryKnowledge,
  questionLc: string,
  benchmarkReport: Awaited<ReturnType<typeof compareOrgToIndustry>> | null,
  signals: MarketSignal[],
  benchmarksRaw: Awaited<ReturnType<typeof computeIndustryBenchmarks>>,
): string {
  const sampleSize = benchmarksRaw[0]?.sampleSize || 0
  const overallPct = benchmarkReport?.overallPercentile
  const topSignals = signals.slice(0, 3).map((s) => s.headline).join('; ')

  let s = `${kb.label} industry advisory. ${kb.tagline}.\n\n`

  if (questionLc.includes('gst') || questionLc.includes('tax')) {
    s += `GST focus: ${kb.regulations.filter((r) => r.toLowerCase().includes('gst')).join(', ') || 'Review applicable GST rates for your services'}. Key risks: ${kb.commonPitfalls.filter((p) => p.toLowerCase().includes('gst')).join('; ') || 'classification errors'}.\n\n`
  } else if (questionLc.includes('cash') || questionLc.includes('working capital')) {
    s += `Working capital focus: ${kb.commonPitfalls.filter((p) => p.toLowerCase().includes('cash') || p.toLowerCase().includes('capital') || p.toLowerCase().includes('collection')).join('; ') || 'monitor AR aging'}.\n\n`
  } else if (questionLc.includes('growth') || questionLc.includes('expand')) {
    s += `Growth focus: ${kb.opportunities.join('; ')}.\n\n`
  } else if (questionLc.includes('compliance') || questionLc.includes('risk')) {
    s += `Compliance focus: ${kb.regulations.join('; ')}.\n\n`
  } else {
    s += `Regulations to monitor: ${kb.regulations.slice(0, 2).join('; ')}. Key KPIs: ${kb.kpis.slice(0, 3).join(', ')}.\n\n`
  }

  if (overallPct !== null && overallPct !== undefined) {
    s += `Benchmark position: You're performing better than ${overallPct}% of ${sampleSize} peer ${kb.label} firms.\n\n`
  } else if (sampleSize > 0) {
    s += `Benchmark pool: ${sampleSize} ${kb.label} firms have contributed anonymized data.\n\n`
  } else {
    s += `Benchmark pool: Growing — encourage peers to contribute.\n\n`
  }

  if (topSignals) {
    s += `Active market signals: ${topSignals}.\n\n`
  }

  return s.trim()
}

function buildKeyActions(
  kb: IndustryKnowledge,
  benchmarkReport: Awaited<ReturnType<typeof compareOrgToIndustry>> | null,
): string[] {
  const actions = [...kb.recommendedActions]
  if (benchmarkReport) {
    // Add benchmark-gap-driven actions
    const weakMetrics = benchmarkReport.comparisons
      .filter((c) => c.percentile !== null && c.percentile < 40)
      .slice(0, 2)
    for (const m of weakMetrics) {
      actions.unshift(`Improve ${m.label}: currently in bottom quartile (${m.percentile}%ile)`)
    }
  }
  return Array.from(new Set(actions)).slice(0, 6)
}

function buildRiskFlags(
  kb: IndustryKnowledge,
  benchmarkReport: Awaited<ReturnType<typeof compareOrgToIndustry>> | null,
  signals: MarketSignal[],
): string[] {
  const flags: string[] = [...kb.commonPitfalls]
  if (benchmarkReport) {
    for (const c of benchmarkReport.comparisons) {
      if (c.percentile !== null && c.percentile < 25) {
        flags.push(`${c.label} is in the bottom quartile (peer comparison)`)
      }
    }
  }
  const negativeSignals = signals.filter((s) => s.impact === 'negative').slice(0, 3)
  for (const s of negativeSignals) {
    flags.push(`Market risk: ${s.headline}`)
  }
  return flags.slice(0, 8)
}

function buildOpportunities(
  kb: IndustryKnowledge,
  benchmarkReport: Awaited<ReturnType<typeof compareOrgToIndustry>> | null,
  signals: MarketSignal[],
): string[] {
  const opps: string[] = [...kb.opportunities]
  if (benchmarkReport) {
    const strongMetrics = benchmarkReport.comparisons
      .filter((c) => c.percentile !== null && c.percentile >= 75)
      .slice(0, 2)
    for (const m of strongMetrics) {
      opps.unshift(`Leverage your strength: ${m.label} (top quartile at ${m.percentile}%ile)`)
    }
  }
  const positiveSignals = signals.filter((s) => s.impact === 'positive').slice(0, 3)
  for (const s of positiveSignals) {
    opps.push(`Market tailwind: ${s.headline}`)
  }
  return opps.slice(0, 8)
}

function computeConfidence(
  benchmarksRaw: Awaited<ReturnType<typeof computeIndustryBenchmarks>>,
  signals: MarketSignal[],
): number {
  const sampleSize = benchmarksRaw[0]?.sampleSize || 0
  const signalBonus = Math.min(20, signals.length * 4)
  const sampleBonus = isSampleSafe(sampleSize) ? Math.min(60, sampleSize * 2) : 20
  return Math.min(95, 40 + sampleBonus + signalBonus)
}

function buildOracleClosing(
  industry: IndustryKey,
  benchmarkReport: Awaited<ReturnType<typeof compareOrgToIndustry>> | null,
  oppCount: number,
  riskCount: number,
): string {
  if (benchmarkReport?.overallPercentile !== null && benchmarkReport?.overallPercentile !== undefined) {
    return `Oracle's ${INDUSTRY_LABELS[industry]} advisor identified ${oppCount} opportunities and ${riskCount} risk flags. Your benchmark position is ${benchmarkReport.overallPercentile}%ile — focus on bottom-quartile metrics first.`
  }
  return `Oracle's ${INDUSTRY_LABELS[industry]} advisor identified ${oppCount} opportunities and ${riskCount} risk flags. As more firms contribute anonymized data, benchmark precision will improve.`
}
