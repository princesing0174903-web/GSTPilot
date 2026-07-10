import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { graphEvents } from '@/lib/graph/live-update'

const VALID_REPORT_TYPES = ['client_health', 'gst_risk', 'compliance', 'firm_performance', 'board'] as const
type ReportType = (typeof VALID_REPORT_TYPES)[number]

const VALID_FORMATS = ['pdf', 'excel'] as const
type ReportFormat = (typeof VALID_FORMATS)[number]

// GET /api/ai-reports — List ExecutiveReport records
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('reportType')

    const where: Record<string, unknown> = {}
    if (reportType) {
      if (!VALID_REPORT_TYPES.includes(reportType as ReportType)) {
        return NextResponse.json(
          { error: `Invalid reportType. Valid types: ${VALID_REPORT_TYPES.join(', ')}` },
          { status: 400 }
        )
      }
      where.reportType = reportType
    }

    const reports = await db.executiveReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const enriched = reports.map((report) => ({
      id: report.id,
      reportType: report.reportType,
      title: report.title,
      description: report.description,
      period: report.period,
      format: report.format,
      status: report.status,
      generatedBy: report.generatedBy,
      generatedDate: report.createdAt.toISOString(),
      fileSize: report.data ? Buffer.from(report.data).length : 0,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }))

    return NextResponse.json({ reports: enriched })
  } catch (error) {
    console.error('GET /api/ai-reports error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

// POST /api/ai-reports — Generate new report
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { reportType, title, description, period, format, generatedBy } = body

    // Validate required fields
    if (!reportType) {
      return NextResponse.json(
        { error: 'reportType is required' },
        { status: 400 }
      )
    }

    if (!VALID_REPORT_TYPES.includes(reportType as ReportType)) {
      return NextResponse.json(
        { error: `Invalid reportType. Valid types: ${VALID_REPORT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'title is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!period || typeof period !== 'string' || period.trim().length === 0) {
      return NextResponse.json(
        { error: 'period is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Validate format if provided
    const reportFormat = format ?? 'pdf'
    if (!VALID_FORMATS.includes(reportFormat as ReportFormat)) {
      return NextResponse.json(
        { error: `Invalid format. Valid formats: ${VALID_FORMATS.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate report data based on type
    const reportData = generateReportData(reportType as ReportType, period)

    const report = await db.executiveReport.create({
      data: {
        reportType,
        title: title.trim(),
        description: description ?? null,
        period: period.trim(),
        data: JSON.stringify(reportData),
        format: reportFormat,
        status: 'generated',
        generatedBy: generatedBy ?? null,
      },
    })

    // Construct download URL
    const downloadUrl = `/api/ai-reports/${report.id}/download`

    // ── Real Business Graph Engine™ — auto-create report node + live event ──
    graphEvents.reportGenerated(report.id, report.reportType, report.title)

    return NextResponse.json({ report, downloadUrl }, { status: 201 })
  } catch (error) {
    console.error('POST /api/ai-reports error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    )
  }
}

function generateReportData(reportType: ReportType, period: string): Record<string, unknown> {
  const timestamp = new Date().toISOString()

  switch (reportType) {
    case 'client_health':
      return {
        type: 'client_health',
        period,
        generatedAt: timestamp,
        summary: {
          totalClients: 0,
          healthyClients: 0,
          atRiskClients: 0,
          criticalClients: 0,
          averageHealthScore: 0,
        },
        breakdown: {
          byRiskLevel: { low: 0, medium: 0, high: 0, critical: 0 },
          byEntityType: { regular: 0, composition: 0, casual: 0 },
          byFilingStatus: { filed: 0, pending: 0, overdue: 0 },
        },
        recommendations: [
          'Schedule health check reviews for at-risk clients',
          'Prioritize overdue filing remediation',
          'Implement automated compliance monitoring',
        ],
      }

    case 'gst_risk':
      return {
        type: 'gst_risk',
        period,
        generatedAt: timestamp,
        summary: {
          totalRiskAssessments: 0,
          lowRiskClients: 0,
          mediumRiskClients: 0,
          highRiskClients: 0,
          averageRiskScore: 0,
          topRiskFactors: [],
        },
        riskCategories: {
          lateFilings: { count: 0, impact: 'medium' },
          noticeFrequency: { count: 0, impact: 'high' },
          gstMismatches: { count: 0, impact: 'high' },
          vendorRisk: { count: 0, impact: 'medium' },
          itcRisk: { count: 0, impact: 'high' },
        },
        mitigationActions: [
          'Implement pre-filing validation checks',
          'Set up automated reconciliation processes',
          'Review ITC claims against GSTR-2B data',
          'Monitor vendor compliance status regularly',
        ],
      }

    case 'compliance':
      return {
        type: 'compliance',
        period,
        generatedAt: timestamp,
        summary: {
          overallComplianceRate: 0,
          filingCompliance: 0,
          paymentCompliance: 0,
          returnAccuracy: 0,
          documentationCompliance: 0,
        },
        details: {
          gstr1FilingRate: 0,
          gstr3bFilingRate: 0,
          annualReturnStatus: 'pending',
          itcReconciliationStatus: 'pending',
        },
        alerts: [
          'Some clients have overdue GSTR-3B filings',
          'ITC reconciliation incomplete for multiple clients',
          'Annual return deadline approaching',
        ],
        actionItems: [
          'Complete pending ITC reconciliations',
          'File overdue returns to avoid penalties',
          'Prepare annual return data compilation',
        ],
      }

    case 'firm_performance':
      return {
        type: 'firm_performance',
        period,
        generatedAt: timestamp,
        summary: {
          totalRevenue: 0,
          clientRetentionRate: 0,
          teamUtilization: 0,
          averageProcessingTime: 0,
          clientSatisfactionScore: 0,
        },
        kpis: {
          revenue: { value: 0, trend: 'stable', change: 0 },
          activeClients: { value: 0, trend: 'stable', change: 0 },
          filingsProcessed: { value: 0, trend: 'stable', change: 0 },
          avgTurnaround: { value: 0, trend: 'stable', change: 0 },
          teamProductivity: { value: 0, trend: 'stable', change: 0 },
        },
        teamPerformance: {
          topPerformers: [],
          departmentBreakdown: [],
          workloadDistribution: 'balanced',
        },
        growthMetrics: {
          newClientAcquisition: 0,
          clientChurn: 0,
          revenueGrowth: 0,
          serviceExpansion: [],
        },
      }

    case 'board':
      return {
        type: 'board',
        period,
        generatedAt: timestamp,
        executiveSummary: {
          firmHealth: 'stable',
          keyHighlights: [
            'Firm operations running within normal parameters',
            'Client base maintained at current levels',
            'Compliance targets on track for the period',
          ],
          criticalItems: [],
        },
        financials: {
          revenue: { current: 0, previous: 0, change: 0 },
          expenses: { current: 0, previous: 0, change: 0 },
          profitability: { margin: 0, trend: 'stable' },
          gstProcessed: { volume: 0, trend: 'stable' },
        },
        operations: {
          clientMetrics: { active: 0, atRisk: 0, new: 0 },
          filingMetrics: { onTime: 0, delayed: 0, overdue: 0 },
          teamMetrics: { utilization: 0, productivity: 0, satisfaction: 0 },
        },
        riskAndCompliance: {
          riskExposure: 'low',
          complianceScore: 0,
          pendingNotices: 0,
          upcomingDeadlines: [],
        },
        strategicRecommendations: [
          'Invest in automation to improve operational efficiency',
          'Expand service offerings to increase client retention',
          'Strengthen compliance monitoring framework',
        ],
      }

    default:
      return {
        type: reportType,
        period,
        generatedAt: timestamp,
        message: 'Report generated successfully',
      }
  }
}
