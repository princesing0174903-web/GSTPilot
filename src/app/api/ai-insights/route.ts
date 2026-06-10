import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

type InsightCategory = 'growth' | 'compliance' | 'risk' | 'gst' | 'payment'
type TrendDirection = 'improving' | 'declining' | 'stable'

interface GeneratedInsight {
  category: InsightCategory
  trend: TrendDirection
  observation: string
  confidence: number
  dataPoints: string
}


function inferComplianceTrend(healthScore: number): TrendDirection {
  if (healthScore > 80) return 'improving'
  if (healthScore < 60) return 'declining'
  return 'stable'
}

function inferRiskTrend(
  riskLevel: string,
  issueCount: number
): TrendDirection {
  if (riskLevel === 'high' || riskLevel === 'critical' || issueCount > 5) return 'declining'
  if (riskLevel === 'low' && issueCount <= 1) return 'improving'
  return 'stable'
}

function inferGrowthTrend(invoiceCount: number, totalAmount: number): TrendDirection {
  if (invoiceCount > 15 || totalAmount > 500000) return 'improving'
  if (invoiceCount < 5 && totalAmount < 100000) return 'declining'
  return 'stable'
}

function inferGstTrend(totalTax: number, filingCount: number): TrendDirection {
  if (filingCount > 2 && totalTax > 50000) return 'improving'
  if (filingCount === 0 || totalTax < 5000) return 'declining'
  return 'stable'
}

function inferPaymentTrend(lastFilingDate: string | null, healthScore: number): TrendDirection {
  if (!lastFilingDate) return 'declining'
  const daysSinceFiling = Math.floor(
    (Date.now() - new Date(lastFilingDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSinceFiling <= 30 && healthScore >= 70) return 'improving'
  if (daysSinceFiling > 60 || healthScore < 50) return 'declining'
  return 'stable'
}

function generateComplianceObservation(
  clientName: string,
  healthScore: number,
  trend: TrendDirection
): string {
  if (trend === 'improving') {
    return `${clientName} shows strong compliance posture with a health score of ${healthScore}/100. Filing patterns indicate consistent adherence to GST regulations. Recommend maintaining current practices and monitoring for any upcoming rule changes.`
  }
  if (trend === 'declining') {
    return `${clientName} compliance health has dropped to ${healthScore}/100, indicating potential issues with filing timeliness or data accuracy. Immediate review of outstanding filings and ITC reconciliation is recommended.`
  }
  return `${clientName} compliance posture is stable at ${healthScore}/100. While no critical issues detected, proactive monitoring of upcoming deadlines and ITC claims will help maintain standing.`
}

function generateRiskObservation(
  clientName: string,
  riskLevel: string,
  issueCount: number,
  trend: TrendDirection
): string {
  if (trend === 'declining') {
    return `${clientName} has elevated risk exposure with ${riskLevel} risk level and ${issueCount} open issues. Risk factors include potential ITC mismatches and filing delays. Prioritize resolution of flagged items to prevent penalty exposure.`
  }
  if (trend === 'improving') {
    return `${clientName} risk profile is favorable with ${riskLevel} risk level and only ${issueCount} open issues. Continue monitoring vendor compliance and cross-verify GSTR-2B data to sustain this trajectory.`
  }
  return `${clientName} risk profile is moderate with ${issueCount} open issues at ${riskLevel} risk level. Regular reconciliation and timely filing will help prevent escalation.`
}

function generateGrowthObservation(
  clientName: string,
  invoiceCount: number,
  totalAmount: number,
  trend: TrendDirection
): string {
  if (trend === 'improving') {
    return `${clientName} shows positive growth trajectory with ${invoiceCount} invoices totaling ₹${totalAmount.toLocaleString()}. Increasing transaction volume suggests expanding business operations. Ensure ITC eligibility scales with procurement.`
  }
  if (trend === 'declining') {
    return `${clientName} transaction volume has decreased with only ${invoiceCount} invoices (₹${totalAmount.toLocaleString()}). This may indicate seasonal variation or business contraction. Monitor for compliance threshold changes under GST composition scheme limits.`
  }
  return `${clientName} transaction volume is steady with ${invoiceCount} invoices totaling ₹${totalAmount.toLocaleString()}. Stable operations observed; track for any threshold crossings that may affect GST registration status.`
}

function generateGstObservation(
  clientName: string,
  totalTax: number,
  filingCount: number,
  trend: TrendDirection
): string {
  if (trend === 'improving') {
    return `${clientName} GST liability management is effective with ₹${totalTax.toLocaleString()} in total tax across ${filingCount} filings. Regular filing pattern suggests robust tax compliance processes.`
  }
  if (trend === 'declining') {
    return `${clientName} GST obligations show concerns — ₹${totalTax.toLocaleString()} total tax with ${filingCount} filings on record. Low filing frequency may result in penalties or interest charges. Prioritize pending GSTR filings.`
  }
  return `${clientName} GST obligations are on track with ₹${totalTax.toLocaleString()} across ${filingCount} filings. Continue monitoring for accuracy in tax computations and timely filing of returns.`
}

function generatePaymentObservation(
  clientName: string,
  lastFilingDate: string | null,
  trend: TrendDirection
): string {
  const filingInfo = lastFilingDate
    ? `Last filed on ${new Date(lastFilingDate).toLocaleDateString()}`
    : 'No filing date on record'
  if (trend === 'improving') {
    return `${clientName} payment and filing timeliness is strong. ${filingInfo}. Consistent on-time filings contribute to positive compliance standing.`
  }
  if (trend === 'declining') {
    return `${clientName} shows filing delays. ${filingInfo}. Late filings attract interest under Section 50 of CGST Act. Recommend setting up automated filing reminders and DCC-3 advance payments.`
  }
  return `${clientName} filing and payment patterns are normal. ${filingInfo}. Maintain current discipline to avoid any interest or penalty exposure.`
}

async function generateInsightsFromData(): Promise<void> {
  const clients = await db.client.findMany({
    include: {
      invoices: {
        select: {
          totalAmount: true,
          cgst: true,
          sgst: true,
          igst: true,
          cess: true,
        },
      },
      gstrFilings: {
        select: {
          id: true,
          status: true,
          filedDate: true,
          totalTax: true,
        },
      },
      issues: {
        where: { status: 'open' },
        select: { id: true, severity: true },
      },
      riskScores: {
        select: { riskLevel: true, overallScore: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      healthScores: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { score: true, period: true },
      },
    },
  })

  const currentPeriod = new Date().toISOString().slice(0, 7)

  for (const client of clients) {
    const invoiceCount = client.invoices.length
    const totalAmount = client.invoices.reduce((s, i) => s + i.totalAmount, 0)
    const totalTax = client.invoices.reduce(
      (s, i) => s + i.cgst + i.sgst + i.igst + i.cess,
      0
    )
    const filingCount = client.gstrFilings.length
    const issueCount = client.issues.length
    const riskLevel = client.riskScores[0]?.riskLevel ?? 'low'
    const healthScore = client.healthScore

    const insights: GeneratedInsight[] = []

    // Compliance insight
    const complianceTrend = inferComplianceTrend(healthScore)
    insights.push({
      category: 'compliance',
      trend: complianceTrend,
      observation: generateComplianceObservation(client.tradeName, healthScore, complianceTrend),
      confidence: healthScore > 75 ? 0.9 : healthScore > 50 ? 0.7 : 0.6,
      dataPoints: JSON.stringify({ healthScore, healthHistory: client.healthScores.map(h => h.score) }),
    })

    // Risk insight
    const riskTrend = inferRiskTrend(riskLevel, issueCount)
    insights.push({
      category: 'risk',
      trend: riskTrend,
      observation: generateRiskObservation(client.tradeName, riskLevel, issueCount, riskTrend),
      confidence: riskLevel === 'critical' ? 0.95 : riskLevel === 'high' ? 0.85 : 0.7,
      dataPoints: JSON.stringify({ riskLevel, issueCount, riskScore: client.riskScores[0]?.overallScore ?? 0 }),
    })

    // Growth insight
    const growthTrend = inferGrowthTrend(invoiceCount, totalAmount)
    insights.push({
      category: 'growth',
      trend: growthTrend,
      observation: generateGrowthObservation(client.tradeName, invoiceCount, totalAmount, growthTrend),
      confidence: invoiceCount > 10 ? 0.85 : 0.6,
      dataPoints: JSON.stringify({ invoiceCount, totalAmount }),
    })

    // GST insight
    const gstTrend = inferGstTrend(totalTax, filingCount)
    insights.push({
      category: 'gst',
      trend: gstTrend,
      observation: generateGstObservation(client.tradeName, totalTax, filingCount, gstTrend),
      confidence: filingCount > 2 ? 0.8 : 0.55,
      dataPoints: JSON.stringify({ totalTax, filingCount }),
    })

    // Payment insight
    const paymentTrend = inferPaymentTrend(client.lastFilingDate, healthScore)
    insights.push({
      category: 'payment',
      trend: paymentTrend,
      observation: generatePaymentObservation(client.tradeName, client.lastFilingDate, paymentTrend),
      confidence: client.lastFilingDate ? 0.8 : 0.5,
      dataPoints: JSON.stringify({ lastFilingDate: client.lastFilingDate, healthScore }),
    })

    // Create ClientInsight records
    for (const insight of insights) {
      await db.clientInsight.create({
        data: {
          clientId: client.id,
          category: insight.category,
          trend: insight.trend,
          observation: insight.observation,
          confidence: insight.confidence,
          dataPoints: insight.dataPoints,
          period: currentPeriod,
        },
      })
    }
  }
}

// GET /api/ai-insights — Return AI Client Insights grouped by client
export async function GET() {
  try {
    // Check if insights already exist
    let insights = await db.clientInsight.findMany({
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
          },
        },
      },
      orderBy: { confidence: 'desc' },
    })

    // If no insights exist, generate from current data
    if (insights.length === 0) {
      await generateInsightsFromData()
      insights = await db.clientInsight.findMany({
        include: {
          client: {
            select: {
              id: true,
              tradeName: true,
              gstin: true,
            },
          },
        },
        orderBy: { confidence: 'desc' },
      })
    }

    // Group by clientId
    const groupedInsights: Record<
      string,
      {
        clientName: string
        insights: {
          id: string
          category: string
          trend: string
          observation: string
          confidence: number
          dataPoints: string | null
          period: string
          createdAt: Date
        }[]
      }
    > = {}

    for (const insight of insights) {
      const clientId = insight.clientId
      if (!groupedInsights[clientId]) {
        groupedInsights[clientId] = {
          clientName: insight.client.tradeName,
          insights: [],
        }
      }
      groupedInsights[clientId].insights.push({
        id: insight.id,
        category: insight.category,
        trend: insight.trend,
        observation: insight.observation,
        confidence: insight.confidence,
        dataPoints: insight.dataPoints,
        period: insight.period,
        createdAt: insight.createdAt,
      })
    }

    // Compute summary
    const totalObservations = insights.length
    const highConfidence = insights.filter((i) => i.confidence >= 0.8).length
    const trending = {
      improving: insights.filter((i) => i.trend === 'improving').length,
      declining: insights.filter((i) => i.trend === 'declining').length,
      stable: insights.filter((i) => i.trend === 'stable').length,
    }

    return NextResponse.json({
      insights: groupedInsights,
      summary: {
        totalObservations,
        highConfidence,
        trending,
      },
    })
  } catch (error) {
    console.error('GET /api/ai-insights error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch AI insights' },
      { status: 500 }
    )
  }
}
