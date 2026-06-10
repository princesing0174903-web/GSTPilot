import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type ForecastType = 'notice' | 'filing_delay' | 'reconciliation_issue' | 'itc_loss'

interface ComplianceForecastItem {
  clientId: string | null
  clientName: string | null
  forecastType: ForecastType
  predictedEvent: string
  probability: number
  confidence: number
  expectedDate: string | null
  impact: string
  mitigatingActions: string[]
}

interface ForecastsByType {
  notice: ComplianceForecastItem[]
  filing_delay: ComplianceForecastItem[]
  reconciliation_issue: ComplianceForecastItem[]
  itc_loss: ComplianceForecastItem[]
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getImpactFromProbability(prob: number): string {
  if (prob >= 0.8) return 'critical'
  if (prob >= 0.6) return 'high'
  if (prob >= 0.4) return 'medium'
  return 'low'
}

export async function GET() {
  try {
    // Check for existing ComplianceForecast records
    const existingForecasts = await db.complianceForecast.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, tradeName: true },
        },
      },
    })

    const forecasts: ForecastsByType = {
      notice: [],
      filing_delay: [],
      reconciliation_issue: [],
      itc_loss: [],
    }

    if (existingForecasts.length > 0) {
      // Use existing records, group by forecastType
      for (const f of existingForecasts) {
        const type = f.forecastType as ForecastType
        if (forecasts[type]) {
          const mitigatingActions = f.mitigatingActions
            ? JSON.parse(f.mitigatingActions)
            : []

          forecasts[type].push({
            clientId: f.clientId,
            clientName: f.client?.tradeName ?? null,
            forecastType: type,
            predictedEvent: f.predictedEvent,
            probability: f.probability,
            confidence: f.confidence,
            expectedDate: f.expectedDate,
            impact: f.impact,
            mitigatingActions,
          })
        }
      }
    } else {
      // Generate forecasts from existing data
      const now = new Date()

      // Fetch all clients with their related data
      const allClients = await db.client.findMany({
        select: {
          id: true,
          tradeName: true,
          healthScore: true,
          status: true,
          gstrFilings: {
            select: { status: true, period: true, returnType: true },
          },
          notices: {
            select: { id: true, noticeType: true, status: true },
          },
          invoices: {
            select: {
              matchStatus: true,
              igst: true,
              cgst: true,
              sgst: true,
              taxableValue: true,
            },
          },
        },
      })

      for (const client of allClients) {
        const lateFilings = client.gstrFilings.filter(
          (f) => f.status !== 'filed'
        )
        const mismatchInvoices = client.invoices.filter((inv) =>
          ['mismatch', 'missing_in_books', 'missing_in_gstr'].includes(
            inv.matchStatus
          )
        )
        const totalITC = client.invoices.reduce(
          (sum, inv) => sum + inv.igst + inv.cgst + inv.sgst,
          0
        )

        // ─── Notice Forecasts ───
        // Clients with low healthScore (<60) → predict notice probability
        if (client.healthScore < 60) {
          const prob = Math.min(0.95, (100 - client.healthScore) / 100)
          const conf = 0.7 + Math.random() * 0.15
          const expectedDate = formatDate(addMonths(now, Math.ceil(Math.random() * 3)))

          const mitigatingActions: string[] = []
          if (lateFilings.length > 0) {
            mitigatingActions.push('Ensure timely filing of all pending GSTR returns')
          }
          if (client.notices.length > 0) {
            mitigatingActions.push('Respond to all open notices within due date')
          }
          mitigatingActions.push('Schedule compliance health review with client')
          mitigatingActions.push('Maintain proper documentation for all transactions')

          forecasts.notice.push({
            clientId: client.id,
            clientName: client.tradeName,
            forecastType: 'notice',
            predictedEvent: `GST notice likely for ${client.tradeName} due to low compliance health (${client.healthScore}/100)`,
            probability: Math.round(prob * 100) / 100,
            confidence: Math.round(conf * 100) / 100,
            expectedDate,
            impact: getImpactFromProbability(prob),
            mitigatingActions,
          })
        }

        // ─── Filing Delay Forecasts ───
        // Clients with past late filings → predict delay probability
        if (lateFilings.length > 0) {
          const delayRatio = lateFilings.length / Math.max(1, client.gstrFilings.length)
          const prob = Math.min(0.9, delayRatio * 1.5 + 0.2)
          const conf = 0.65 + Math.random() * 0.2
          const nextPeriod = addMonths(now, 1)
          const expectedDate = formatDate(nextPeriod)

          const mitigatingActions: string[] = []
          mitigatingActions.push('Set up automated filing reminders 15 days before due date')
          mitigatingActions.push('Assign dedicated team member for this client\'s filings')
          if (lateFilings.length > 2) {
            mitigatingActions.push('Escalate to senior management for priority handling')
          }
          mitigatingActions.push('Pre-validate invoice data before filing period starts')

          forecasts.filing_delay.push({
            clientId: client.id,
            clientName: client.tradeName,
            forecastType: 'filing_delay',
            predictedEvent: `Filing delay expected for ${client.tradeName} - ${lateFilings.length} late filing(s) in history`,
            probability: Math.round(prob * 100) / 100,
            confidence: Math.round(conf * 100) / 100,
            expectedDate,
            impact: getImpactFromProbability(prob),
            mitigatingActions,
          })
        }

        // ─── Reconciliation Issue Forecasts ───
        // Clients with high mismatch count → predict issues
        if (mismatchInvoices.length > 0) {
          const mismatchRatio =
            mismatchInvoices.length / Math.max(1, client.invoices.length)
          const prob = Math.min(0.85, mismatchRatio * 2 + 0.3)
          const conf = 0.6 + Math.random() * 0.2
          const expectedDate = formatDate(addMonths(now, 1))

          const mitigatingActions: string[] = []
          mitigatingActions.push('Run reconciliation before filing period')
          mitigatingActions.push('Verify vendor GSTIN details before booking invoices')
          if (mismatchInvoices.length > 3) {
            mitigatingActions.push('Schedule vendor communication to resolve mismatches')
          }
          mitigatingActions.push('Enable automated 2B matching alerts')

          forecasts.reconciliation_issue.push({
            clientId: client.id,
            clientName: client.tradeName,
            forecastType: 'reconciliation_issue',
            predictedEvent: `${mismatchInvoices.length} reconciliation mismatch(es) expected for ${client.tradeName}`,
            probability: Math.round(prob * 100) / 100,
            confidence: Math.round(conf * 100) / 100,
            expectedDate,
            impact: getImpactFromProbability(prob),
            mitigatingActions,
          })
        }

        // ─── ITC Loss Forecasts ───
        // Clients with high ITC risk → predict loss amount
        if (totalITC > 0 && (client.healthScore < 70 || mismatchInvoices.length > 2)) {
          const itcLossEstimate = totalITC * (0.05 + Math.random() * 0.1) // 5-15% potential loss
          const prob = mismatchInvoices.length > 3 ? 0.75 : 0.45
          const conf = 0.55 + Math.random() * 0.2
          const expectedDate = formatDate(addMonths(now, 2))

          const mitigatingActions: string[] = []
          mitigatingActions.push('Verify all ITC claims against GSTR-2B before filing')
          mitigatingActions.push('Flag and resolve mismatched invoices immediately')
          mitigatingActions.push('Maintain proper tax invoices and delivery challans')
          if (itcLossEstimate > 50000) {
            mitigatingActions.push('Engage tax consultant for ITC optimization review')
          }
          mitigatingActions.push('Implement vendor compliance verification process')

          forecasts.itc_loss.push({
            clientId: client.id,
            clientName: client.tradeName,
            forecastType: 'itc_loss',
            predictedEvent: `Potential ITC loss of ₹${Math.round(itcLossEstimate).toLocaleString()} for ${client.tradeName}`,
            probability: Math.round(prob * 100) / 100,
            confidence: Math.round(conf * 100) / 100,
            expectedDate,
            impact: itcLossEstimate > 100000 ? 'critical' : itcLossEstimate > 50000 ? 'high' : 'medium',
            mitigatingActions,
          })
        }
      }

      // If no client-specific forecasts were generated, add generic ones
      if (
        forecasts.notice.length === 0 &&
        forecasts.filing_delay.length === 0 &&
        forecasts.reconciliation_issue.length === 0 &&
        forecasts.itc_loss.length === 0
      ) {
        forecasts.notice.push({
          clientId: null,
          clientName: null,
          forecastType: 'notice',
          predictedEvent: 'No specific notice risks identified - continue monitoring compliance health',
          probability: 0.15,
          confidence: 0.6,
          expectedDate: null,
          impact: 'low',
          mitigatingActions: [
            'Continue monthly compliance health checks',
            'Keep all filings up to date',
            'Monitor GST portal for any updates',
          ],
        })

        forecasts.filing_delay.push({
          clientId: null,
          clientName: null,
          forecastType: 'filing_delay',
          predictedEvent: 'No immediate filing delay risks detected',
          probability: 0.1,
          confidence: 0.65,
          expectedDate: null,
          impact: 'low',
          mitigatingActions: [
            'Set up automated filing reminders',
            'Pre-validate invoice data monthly',
          ],
        })

        forecasts.reconciliation_issue.push({
          clientId: null,
          clientName: null,
          forecastType: 'reconciliation_issue',
          predictedEvent: 'No reconciliation issues forecasted',
          probability: 0.12,
          confidence: 0.6,
          expectedDate: null,
          impact: 'low',
          mitigatingActions: [
            'Run periodic reconciliation checks',
            'Enable automated 2B matching',
          ],
        })

        forecasts.itc_loss.push({
          clientId: null,
          clientName: null,
          forecastType: 'itc_loss',
          predictedEvent: 'No significant ITC loss risks identified',
          probability: 0.08,
          confidence: 0.55,
          expectedDate: null,
          impact: 'low',
          mitigatingActions: [
            'Verify ITC claims against GSTR-2B regularly',
            'Maintain proper documentation',
          ],
        })
      }
    }

    // Calculate overall confidence
    const allForecasts = [
      ...forecasts.notice,
      ...forecasts.filing_delay,
      ...forecasts.reconciliation_issue,
      ...forecasts.itc_loss,
    ]

    const overallConfidence =
      allForecasts.length > 0
        ? Math.round(
            (allForecasts.reduce((sum, f) => sum + f.confidence, 0) /
              allForecasts.length) *
              100
          ) / 100
        : 0

    return NextResponse.json({
      forecasts,
      overallConfidence,
    })
  } catch (error) {
    console.error('[AI-COMPLIANCE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI Compliance data' },
      { status: 500 }
    )
  }
}
