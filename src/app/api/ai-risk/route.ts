import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ClientRiskData {
  clientId: string
  clientName: string
  gstin: string
  overallScore: number
  riskLevel: string
  lateFilings: number
  noticeFrequency: number
  gstMismatches: number
  vendorRisk: number
  itcRisk: number
}

interface AggregateStats {
  low: number
  medium: number
  high: number
  critical: number
  averageScore: number
}

interface HeatmapEntry {
  clientId: string
  clientName: string
  scores: {
    lateFilings: number
    noticeFrequency: number
    gstMismatches: number
    vendorRisk: number
    itcRisk: number
  }
}

function computeRiskLevel(score: number): string {
  if (score <= 25) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 75) return 'high'
  return 'critical'
}

export async function GET() {
  try {
    // Check for existing RiskScore records
    const existingRiskScores = await db.riskScore.findMany({
      where: { category: 'overall' },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, tradeName: true, gstin: true },
        },
      },
    })

    const clients: ClientRiskData[] = []
    const heatmapData: HeatmapEntry[] = []

    if (existingRiskScores.length > 0) {
      // Deduplicate: keep only the latest per client
      const seenClients = new Set<string>()
      const latestPerClient = existingRiskScores.filter((rs) => {
        if (seenClients.has(rs.clientId)) return false
        seenClients.add(rs.clientId)
        return true
      })

      for (const rs of latestPerClient) {
        clients.push({
          clientId: rs.clientId,
          clientName: rs.client.tradeName,
          gstin: rs.client.gstin,
          overallScore: rs.overallScore,
          riskLevel: rs.riskLevel || computeRiskLevel(rs.overallScore),
          lateFilings: rs.lateFilings,
          noticeFrequency: rs.noticeFrequency,
          gstMismatches: rs.gstMismatches,
          vendorRisk: rs.vendorRisk,
          itcRisk: rs.itcRisk,
        })

        heatmapData.push({
          clientId: rs.clientId,
          clientName: rs.client.tradeName,
          scores: {
            lateFilings: rs.lateFilings,
            noticeFrequency: rs.noticeFrequency,
            gstMismatches: rs.gstMismatches,
            vendorRisk: rs.vendorRisk,
            itcRisk: rs.itcRisk,
          },
        })
      }
    } else {
      // Calculate from existing data
      const allClients = await db.client.findMany({
        select: {
          id: true,
          tradeName: true,
          gstin: true,
          healthScore: true,
          gstrFilings: {
            select: { status: true },
          },
          notices: {
            select: { id: true },
          },
          invoices: {
            select: { matchStatus: true, igst: true, cgst: true, sgst: true },
          },
        },
      })

      for (const client of allClients) {
        // Late filings = count of GSTRFilings where status != 'filed'
        const lateFilings = client.gstrFilings.filter(
          (f) => f.status !== 'filed'
        ).length

        // Notice frequency = count of notices
        const noticeFrequency = client.notices.length

        // GST mismatches = count of invoices with matchStatus in problematic states
        const gstMismatches = client.invoices.filter((inv) =>
          ['mismatch', 'missing_in_books', 'missing_in_gstr'].includes(
            inv.matchStatus
          )
        ).length

        // Vendor risk: derived from mismatch ratio (0-100)
        const totalInvoices = client.invoices.length
        const vendorRisk =
          totalInvoices > 0
            ? Math.round((gstMismatches / totalInvoices) * 100)
            : 0

        // ITC risk: based on IGST amounts relative to total tax (higher IGST = more ITC risk)
        const totalITC = client.invoices.reduce(
          (sum, inv) => sum + inv.igst + inv.cgst + inv.sgst,
          0
        )
        const totalIGST = client.invoices.reduce(
          (sum, inv) => sum + inv.igst,
          0
        )
        const itcRisk =
          totalITC > 0 ? Math.round((totalIGST / totalITC) * 100) : 0

        // Overall score: lateFilings*20 + noticeFrequency*15 + gstMismatches*10, capped 0-100
        const rawScore =
          lateFilings * 20 + noticeFrequency * 15 + gstMismatches * 10
        const overallScore = Math.min(100, Math.max(0, rawScore))
        const riskLevel = computeRiskLevel(overallScore)

        clients.push({
          clientId: client.id,
          clientName: client.tradeName,
          gstin: client.gstin,
          overallScore,
          riskLevel,
          lateFilings,
          noticeFrequency,
          gstMismatches,
          vendorRisk,
          itcRisk,
        })

        heatmapData.push({
          clientId: client.id,
          clientName: client.tradeName,
          scores: {
            lateFilings,
            noticeFrequency,
            gstMismatches,
            vendorRisk,
            itcRisk,
          },
        })
      }
    }

    // Compute aggregate stats
    const aggregate: AggregateStats = {
      low: clients.filter((c) => c.riskLevel === 'low').length,
      medium: clients.filter((c) => c.riskLevel === 'medium').length,
      high: clients.filter((c) => c.riskLevel === 'high').length,
      critical: clients.filter((c) => c.riskLevel === 'critical').length,
      averageScore:
        clients.length > 0
          ? Math.round(
              (clients.reduce((sum, c) => sum + c.overallScore, 0) /
                clients.length) *
                100
            ) / 100
          : 0,
    }

    return NextResponse.json({
      clients,
      aggregate,
      heatmapData,
    })
  } catch (error) {
    console.error('[AI-RISK] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI Risk data' },
      { status: 500 }
    )
  }
}
