import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const PREDICTION_CATEGORIES = [
  'revenue',
  'gst_liability',
  'collections',
  'churn',
  'filing_load',
  'team_load',
] as const

type PredictionCategory = (typeof PREDICTION_CATEGORIES)[number]

interface CategoryPrediction {
  category: PredictionCategory
  predictedValue: number
  confidence: number
  lowerBound: number
  upperBound: number
  trend: string
}

interface MonthlyDataPoint {
  month: string
  category: PredictionCategory
  value: number
  isPredicted: boolean
}

function getMonthLabel(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function getRiskLevel(score: number): string {
  if (score <= 25) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 75) return 'high'
  return 'critical'
}

export async function GET() {
  try {
    // Check if AIPrediction records exist
    const existingPredictions = await db.aIPrediction.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const predictions: CategoryPrediction[] = []
    const monthlyData: MonthlyDataPoint[] = []

    if (existingPredictions.length > 0) {
      // Use existing AIPrediction records
      for (const category of PREDICTION_CATEGORIES) {
        const latest = existingPredictions.find((p) => p.category === category)
        if (latest) {
          predictions.push({
            category,
            predictedValue: latest.predictedValue,
            confidence: latest.confidence,
            lowerBound: latest.lowerBound,
            upperBound: latest.upperBound,
            trend: latest.trend,
          })
        }
      }

      // Build monthly data from all prediction records
      const allByCategory = existingPredictions.reduce(
        (acc, p) => {
          if (!acc[p.category]) acc[p.category] = []
          acc[p.category].push(p)
          return acc
        },
        {} as Record<string, typeof existingPredictions>
      )

      for (const [cat, records] of Object.entries(allByCategory)) {
        // Sort by period ascending
        const sorted = [...records].sort((a, b) =>
          a.period.localeCompare(b.period)
        )
        for (const r of sorted) {
          const isPredicted =
            new Date(r.period + '-01') > new Date() ? true : false
          monthlyData.push({
            month: r.period,
            category: cat as PredictionCategory,
            value: r.predictedValue,
            isPredicted,
          })
        }
      }
    } else {
      // Calculate from existing data
      const now = new Date()
      const threeMonthsAgo = new Date(now)
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      // --- Revenue ---
      const invoices = await db.invoice.findMany({
        where: {
          invoiceDate: {
            gte: threeMonthsAgo.toISOString().split('T')[0],
          },
        },
      })
      const totalRevenue = invoices.reduce(
        (sum, inv) => sum + inv.totalAmount,
        0
      )
      const monthlyRevenueAvg = totalRevenue / 3
      const revenueVariance = 1 + (Math.random() * 0.1 + 0.05) // 5-15% variance
      const predictedRevenue = Math.round(monthlyRevenueAvg * revenueVariance)
      const revenueConfidence = invoices.length > 0 ? 0.82 : 0.5

      predictions.push({
        category: 'revenue',
        predictedValue: predictedRevenue,
        confidence: revenueConfidence,
        lowerBound: Math.round(predictedRevenue * 0.85),
        upperBound: Math.round(predictedRevenue * 1.15),
        trend: predictedRevenue > monthlyRevenueAvg ? 'up' : 'stable',
      })

      // --- GST Liability ---
      const totalGST = invoices.reduce(
        (sum, inv) => sum + inv.cgst + inv.sgst + inv.igst,
        0
      )
      const monthlyGSTAvg = totalGST / 3
      const projectedGST = Math.round(monthlyGSTAvg * 1.1)

      predictions.push({
        category: 'gst_liability',
        predictedValue: projectedGST,
        confidence: invoices.length > 0 ? 0.78 : 0.45,
        lowerBound: Math.round(projectedGST * 0.88),
        upperBound: Math.round(projectedGST * 1.12),
        trend: 'up',
      })

      // --- Collections ---
      const projectedCollections = Math.round(predictedRevenue * 0.85)
      predictions.push({
        category: 'collections',
        predictedValue: projectedCollections,
        confidence: 0.75,
        lowerBound: Math.round(projectedCollections * 0.8),
        upperBound: Math.round(projectedCollections * 1.05),
        trend: 'stable',
      })

      // --- Churn ---
      const totalClients = await db.client.count()
      const inactiveClients = await db.client.count({
        where: { status: 'inactive' },
      })
      const churnRate = totalClients > 0 ? (inactiveClients / totalClients) * 100 : 0

      predictions.push({
        category: 'churn',
        predictedValue: Math.round(churnRate * 100) / 100,
        confidence: totalClients > 0 ? 0.7 : 0.3,
        lowerBound: Math.max(0, Math.round((churnRate - 2) * 100) / 100),
        upperBound: Math.round((churnRate + 3) * 100) / 100,
        trend: churnRate > 10 ? 'up' : 'stable',
      })

      // --- Filing Load ---
      const pendingFilings = await db.gSTRFiling.count({
        where: { status: { not: 'filed' } },
      })

      predictions.push({
        category: 'filing_load',
        predictedValue: pendingFilings,
        confidence: 0.85,
        lowerBound: Math.max(0, pendingFilings - 2),
        upperBound: pendingFilings + 5,
        trend: pendingFilings > 10 ? 'up' : 'stable',
      })

      // --- Team Load ---
      const firmMetrics = await db.firmMetrics.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1,
      })
      const teamUtilization =
        firmMetrics.length > 0 ? firmMetrics[0].teamUtilization : 65

      predictions.push({
        category: 'team_load',
        predictedValue: teamUtilization,
        confidence: firmMetrics.length > 0 ? 0.8 : 0.4,
        lowerBound: Math.max(0, teamUtilization - 10),
        upperBound: Math.min(100, teamUtilization + 10),
        trend: teamUtilization > 80 ? 'up' : 'stable',
      })

      // --- Build monthly data (last 6 months + next 3 predicted) ---
      for (let i = -5; i <= 3; i++) {
        const date = addMonths(now, i)
        const monthLabel = getMonthLabel(date)
        const isPredicted = i > 0

        // Revenue monthly data
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
          .toISOString()
          .split('T')[0]
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0]

        let revenueValue: number
        let gstValue: number
        let collectionsValue: number
        let churnValue: number
        let filingLoadValue: number
        let teamLoadValue: number

        if (isPredicted) {
          // Projected values with some variance
          revenueValue = Math.round(
            monthlyRevenueAvg * (1 + (Math.random() * 0.1 - 0.03))
          )
          gstValue = Math.round(monthlyGSTAvg * 1.1)
          collectionsValue = Math.round(revenueValue * 0.85)
          churnValue = Math.round(churnRate * 100) / 100
          filingLoadValue = Math.max(0, pendingFilings + Math.round(Math.random() * 4 - 2))
          teamLoadValue = Math.min(100, teamUtilization + Math.round(Math.random() * 10 - 5))
        } else {
          // Historical values from actual invoice data for that month
          const monthInvoices = await db.invoice.findMany({
            where: {
              invoiceDate: { gte: monthStart, lte: monthEnd },
            },
          })
          revenueValue = monthInvoices.reduce(
            (sum, inv) => sum + inv.totalAmount,
            0
          )
          gstValue = monthInvoices.reduce(
            (sum, inv) => sum + inv.cgst + inv.sgst + inv.igst,
            0
          )
          collectionsValue = Math.round(revenueValue * 0.85)
          churnValue = churnRate
          filingLoadValue = pendingFilings
          teamLoadValue = teamUtilization
        }

        monthlyData.push({
          month: monthLabel,
          category: 'revenue',
          value: revenueValue,
          isPredicted,
        })
        monthlyData.push({
          month: monthLabel,
          category: 'gst_liability',
          value: gstValue,
          isPredicted,
        })
        monthlyData.push({
          month: monthLabel,
          category: 'collections',
          value: collectionsValue,
          isPredicted,
        })
        monthlyData.push({
          month: monthLabel,
          category: 'churn',
          value: churnValue,
          isPredicted,
        })
        monthlyData.push({
          month: monthLabel,
          category: 'filing_load',
          value: filingLoadValue,
          isPredicted,
        })
        monthlyData.push({
          month: monthLabel,
          category: 'team_load',
          value: teamLoadValue,
          isPredicted,
        })
      }
    }

    // Calculate overall confidence
    const overallConfidence =
      predictions.length > 0
        ? Math.round(
            (predictions.reduce((sum, p) => sum + p.confidence, 0) /
              predictions.length) *
              100
          ) / 100
        : 0

    // Build prediction map for easy access
    const predictionMap: Record<string, CategoryPrediction> = {}
    for (const p of predictions) {
      predictionMap[p.category] = p
    }

    return NextResponse.json({
      predictions: predictionMap,
      monthlyData,
      confidence: overallConfidence,
    })
  } catch (error) {
    console.error('[AI-CFO] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI CFO data' },
      { status: 500 }
    )
  }
}
