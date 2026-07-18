import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { validateGSTIN, getRiskLevel, calculateReconciliationRiskScore } from '@/lib/gst-utils'
import { invalidateGraph } from '@/lib/graph/live-update'

type MatchStatus = 'perfect_match' | 'partial_match' | 'mismatch' | 'missing_in_books' | 'missing_in_gstr' | 'unmatched' | 'duplicate'
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type AIRecommendation = 'correct_gstin' | 'correct_invoice_number' | 'adjust_gst_amount' | 'review_vendor_data' | 'mark_as_duplicate' | 'review_manually'
type WorkflowStatus = 'pending' | 'under_review' | 'resolved' | 'ignored' | 'escalated'

const VALID_WORKFLOW_STATUSES: WorkflowStatus[] = ['pending', 'under_review', 'resolved', 'ignored', 'escalated']

// Helper: detect mismatches between two invoice-like records
interface InvoiceLike {
  invoiceNumber: string
  invoiceDate: string
  sellerGstin: string
  buyerGstin?: string | null
  totalAmount: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  taxableValue: number
}

interface MismatchDetail {
  field: string
  expected: string | number
  actual: string | number
  difference?: number
}

function detectMismatches(sourceA: InvoiceLike, sourceB: InvoiceLike | null): {
  mismatches: MismatchDetail[]
  matchStatus: MatchStatus
  matchScore: number
  confidenceScore: number
  riskLevel: RiskLevel
  aiRecommendation: AIRecommendation
  aiExplanation: string
} {
  const mismatchDetails: MismatchDetail[] = []
  let scoreDeduction = 0
  let recommendation: AIRecommendation = 'review_manually'

  // No matching record found in sourceB
  if (!sourceB) {
    return {
      mismatches: [],
      matchStatus: 'missing_in_gstr',
      matchScore: 0,
      confidenceScore: 95,
      riskLevel: 'high',
      aiRecommendation: 'review_manually',
      aiExplanation: `Invoice #${sourceA.invoiceNumber} from ${sourceA.sellerGstin} present in Purchase Register but not found in GSTR-2B. This could indicate the supplier has not uploaded this invoice to the GST portal, or there may be a reporting delay. Verify with the vendor and ensure ITC eligibility.`,
    }
  }

  // GST Amount Difference
  const sourceATax = sourceA.cgst + sourceA.sgst + sourceA.igst + sourceA.cess
  const sourceBTax = sourceB.cgst + sourceB.sgst + sourceB.igst + sourceB.cess
  const taxDiff = Math.abs(sourceATax - sourceBTax)
  if (taxDiff > 0) {
    const tolerance = Math.max(sourceATax * 0.01, 1)
    if (taxDiff > tolerance) {
      mismatchDetails.push({
        field: 'gst_amount',
        expected: sourceATax,
        actual: sourceBTax,
        difference: taxDiff,
      })
      scoreDeduction += Math.min(30, Math.floor(taxDiff / 100) + 10)
    }
  }

  // Invoice Number Mismatch
  if (sourceA.invoiceNumber.trim().toLowerCase() !== sourceB.invoiceNumber.trim().toLowerCase()) {
    const isMinorDiff =
      sourceA.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '') === sourceB.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')
    if (isMinorDiff) {
      mismatchDetails.push({
        field: 'invoice_number',
        expected: sourceA.invoiceNumber,
        actual: sourceB.invoiceNumber,
      })
      scoreDeduction += 5
    } else {
      mismatchDetails.push({
        field: 'invoice_number',
        expected: sourceA.invoiceNumber,
        actual: sourceB.invoiceNumber,
      })
      scoreDeduction += 20
    }
  }

  // Date Mismatch
  const dateA = new Date(sourceA.invoiceDate)
  const dateB = new Date(sourceB.invoiceDate)
  const dateDiffDays = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24)
  if (dateDiffDays > 0) {
    mismatchDetails.push({
      field: 'invoice_date',
      expected: sourceA.invoiceDate,
      actual: sourceB.invoiceDate,
      difference: parseFloat(dateDiffDays.toFixed(1)),
    })
    if (dateDiffDays > 30) {
      scoreDeduction += 15
    } else {
      scoreDeduction += 5
    }
  }

  // Vendor GSTIN Mismatch
  const sellerA = (sourceA.sellerGstin || '').toUpperCase().trim()
  const sellerB = (sourceB.sellerGstin || '').toUpperCase().trim()
  if (sellerA && sellerB && sellerA !== sellerB) {
    mismatchDetails.push({
      field: 'vendor_gstin',
      expected: sellerA,
      actual: sellerB,
    })
    scoreDeduction += 25
  }

  // Total Amount Difference
  const amountDiff = Math.abs(sourceA.totalAmount - sourceB.totalAmount)
  if (amountDiff > 0) {
    const tolerance = Math.max(sourceA.totalAmount * 0.01, 1)
    if (amountDiff > tolerance) {
      mismatchDetails.push({
        field: 'total_amount',
        expected: sourceA.totalAmount,
        actual: sourceB.totalAmount,
        difference: amountDiff,
      })
      scoreDeduction += Math.min(20, Math.floor(amountDiff / 1000) + 5)
    }
  }

  // Duplicate Invoice Check (same number + same seller GSTIN but different amount)
  const isPotentialDuplicate =
    sourceA.invoiceNumber.trim().toLowerCase() === sourceB.invoiceNumber.trim().toLowerCase() &&
    sellerA === sellerB &&
    amountDiff === 0 &&
    taxDiff === 0

  // Determine match status, score, risk level
  const matchScore = Math.max(0, 100 - scoreDeduction)

  let matchStatus: MatchStatus
  let confidenceScore: number
  let riskLevel: RiskLevel
  let aiExplanation: string

  if (isPotentialDuplicate) {
    matchStatus = 'duplicate'
    confidenceScore = 90
    riskLevel = 'medium'
    recommendation = 'mark_as_duplicate'
    aiExplanation = `Duplicate invoice detected — Invoice #${sourceA.invoiceNumber} from GSTIN ${sellerA} appears multiple times with identical amounts. This may be a data entry error or a genuine duplicate. Verify and mark accordingly to prevent duplicate ITC claims.`
  } else if (mismatchDetails.length === 0) {
    matchStatus = 'perfect_match'
    confidenceScore = 98
    riskLevel = 'low'
    recommendation = 'review_manually'
    aiExplanation = `Invoice #${sourceA.invoiceNumber} matches perfectly between Purchase Register and GSTR-2B. All fields — GST amount, invoice number, date, vendor GSTIN, and total amount — are consistent. No action required.`
  } else if (matchScore >= 70) {
    matchStatus = 'partial_match'
    confidenceScore = Math.max(50, 90 - scoreDeduction)
    riskLevel = getRiskLevel(calculateReconciliationRiskScore({
      matchStatus: 'partial_match',
      taxDifference: taxDiff,
      dateDifference: dateDiffDays,
      gstinValid: sellerA === sellerB,
      isDuplicate: false,
    }))
    // Determine primary recommendation
    if (mismatchDetails.some(m => m.field === 'gst_amount')) {
      recommendation = 'adjust_gst_amount'
    } else if (mismatchDetails.some(m => m.field === 'vendor_gstin')) {
      recommendation = 'correct_gstin'
    } else if (mismatchDetails.some(m => m.field === 'invoice_number')) {
      recommendation = 'correct_invoice_number'
    } else if (mismatchDetails.some(m => m.field === 'invoice_date')) {
      recommendation = 'review_vendor_data'
    }

    const mismatchSummary = mismatchDetails
      .map(m => `${m.field.replace(/_/g, ' ')}: expected ₹${m.expected}, found ₹${m.actual}`)
      .join('; ')

    aiExplanation = `Partial match for Invoice #${sourceA.invoiceNumber} — ${mismatchSummary}. The invoice is largely consistent but has minor discrepancies. Review the flagged fields and correct as needed to ensure accurate ITC claims.`
  } else {
    matchStatus = 'mismatch'
    confidenceScore = Math.max(30, 80 - scoreDeduction)
    riskLevel = getRiskLevel(calculateReconciliationRiskScore({
      matchStatus: 'mismatch',
      taxDifference: taxDiff,
      dateDifference: dateDiffDays,
      gstinValid: sellerA === sellerB,
      isDuplicate: false,
    }))

    if (mismatchDetails.some(m => m.field === 'vendor_gstin')) {
      recommendation = 'correct_gstin'
    } else if (mismatchDetails.some(m => m.field === 'gst_amount')) {
      recommendation = 'adjust_gst_amount'
    } else if (mismatchDetails.some(m => m.field === 'invoice_number')) {
      recommendation = 'correct_invoice_number'
    } else {
      recommendation = 'review_manually'
    }

    const mismatchSummary = mismatchDetails
      .map(m => {
        let detail = `${m.field.replace(/_/g, ' ')}: expected ${m.expected}, found ${m.actual}`
        if (m.difference) detail += ` (diff: ${m.difference})`
        return detail
      })
      .join('; ')

    aiExplanation = `Significant mismatch for Invoice #${sourceA.invoiceNumber} — ${mismatchSummary}. Multiple fields show discrepancies that require manual review. Incorrect reconciliation may lead to ITC mismatch or compliance issues.`
  }

  return {
    mismatches: mismatchDetails,
    matchStatus,
    matchScore,
    confidenceScore,
    riskLevel,
    aiRecommendation: recommendation,
    aiExplanation,
  }
}

// Simulate GSTR-2B data for a given invoice (with potential variations)
function simulateGSTR2BData(inv: InvoiceLike): InvoiceLike | null {
  // Simulate ~15% of invoices missing from GSTR-2B
  const hash = simpleHash(inv.invoiceNumber + inv.sellerGstin)
  if (hash % 100 < 15) {
    return null // Missing in GSTR-2B
  }

  // Simulate variations in GSTR-2B data
  const variation = hash % 100
  const gstr2b = { ...inv }

  // ~10% chance of GST amount difference
  if (variation >= 15 && variation < 25) {
    const diffMultiplier = (variation % 5 === 0) ? 0.95 : 1.05
    gstr2b.cgst = parseFloat((inv.cgst * diffMultiplier).toFixed(2))
    gstr2b.sgst = parseFloat((inv.sgst * diffMultiplier).toFixed(2))
    gstr2b.igst = parseFloat((inv.igst * diffMultiplier).toFixed(2))
    gstr2b.totalAmount = parseFloat((gstr2b.taxableValue + gstr2b.cgst + gstr2b.sgst + gstr2b.igst + gstr2b.cess).toFixed(2))
  }

  // ~8% chance of invoice number mismatch
  if (variation >= 25 && variation < 33) {
    gstr2b.invoiceNumber = inv.invoiceNumber.replace(/0/g, 'O')
  }

  // ~5% chance of date mismatch
  if (variation >= 33 && variation < 38) {
    const origDate = new Date(inv.invoiceDate)
    origDate.setDate(origDate.getDate() + (variation % 2 === 0 ? 15 : 45))
    gstr2b.invoiceDate = origDate.toISOString().split('T')[0]
  }

  // ~5% chance of vendor GSTIN mismatch
  if (variation >= 38 && variation < 43) {
    // Change the last character of GSTIN
    const lastChar = inv.sellerGstin[inv.sellerGstin.length - 1]
    const newChar = lastChar === 'Z' ? '0' : String.fromCharCode(lastChar.charCodeAt(0) + 1)
    gstr2b.sellerGstin = inv.sellerGstin.slice(0, -1) + newChar
  }

  return gstr2b
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// ============================================================
// GET /api/reconciliation — Fetch reconciliation results with enhanced filters
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // action=runs — Get ReconciliationRun history
    if (action === 'runs') {
      const clientId = searchParams.get('clientId')
      const where: Record<string, unknown> = {}
      if (clientId) where.clientId = clientId

      const runs = await db.reconciliationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          results: {
            select: {
              id: true,
              matchStatus: true,
              riskLevel: true,
              workflowStatus: true,
            },
          },
        },
      })

      return NextResponse.json({ runs })
    }

    // action=stats — Get dashboard aggregate stats
    if (action === 'stats') {
      const clientId = searchParams.get('clientId')

      const where: Record<string, unknown> = {}
      if (clientId) where.clientId = clientId

      const [
        totalResults,
        perfectMatches,
        partialMatches,
        mismatches,
        missingInBooks,
        missingInGstr,
        duplicates,
        unresolved,
        highRisk,
        criticalRisk,
        pendingWorkflow,
        underReviewWorkflow,
        resolvedWorkflow,
        ignoredWorkflow,
        escalatedWorkflow,
        totalGstDifference,
        avgMatchScore,
        avgConfidenceScore,
        recentRuns,
      ] = await Promise.all([
        db.reconciliationResult.count({ where }),
        db.reconciliationResult.count({ where: { ...where, matchStatus: 'perfect_match' } }),
        db.reconciliationResult.count({ where: { ...where, matchStatus: 'partial_match' } }),
        db.reconciliationResult.count({ where: { ...where, matchStatus: 'mismatch' } }),
        db.reconciliationResult.count({ where: { ...where, matchStatus: 'missing_in_books' } }),
        db.reconciliationResult.count({ where: { ...where, matchStatus: 'missing_in_gstr' } }),
        db.reconciliationResult.count({ where: { ...where, matchStatus: 'duplicate' } }),
        db.reconciliationResult.count({ where: { ...where, resolved: false } }),
        db.reconciliationResult.count({ where: { ...where, riskLevel: 'high' } }),
        db.reconciliationResult.count({ where: { ...where, riskLevel: 'critical' } }),
        db.reconciliationResult.count({ where: { ...where, workflowStatus: 'pending' } }),
        db.reconciliationResult.count({ where: { ...where, workflowStatus: 'under_review' } }),
        db.reconciliationResult.count({ where: { ...where, workflowStatus: 'resolved' } }),
        db.reconciliationResult.count({ where: { ...where, workflowStatus: 'ignored' } }),
        db.reconciliationResult.count({ where: { ...where, workflowStatus: 'escalated' } }),
        db.reconciliationResult.aggregate({ where, _sum: { matchScore: true } }),
        db.reconciliationResult.aggregate({ where, _avg: { matchScore: true, confidenceScore: true } }),
        db.reconciliationRun.findMany({
          where: clientId ? { clientId } : {},
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

      // Calculate total GST difference from mismatches
      const mismatchedResults = await db.reconciliationResult.findMany({
        where: { ...where, matchStatus: { in: ['mismatch', 'partial_match'] } },
        select: { mismatches: true },
      })

      let totalGstDiff = 0
      for (const r of mismatchedResults) {
        if (r.mismatches) {
          try {
            const parsed = JSON.parse(r.mismatches)
            if (Array.isArray(parsed)) {
              for (const m of parsed) {
                if (m.field === 'gst_amount' && m.difference) {
                  totalGstDiff += Math.abs(m.difference)
                }
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      const matchPercentage = totalResults > 0 ? parseFloat(((perfectMatches / totalResults) * 100).toFixed(1)) : 0
      const riskPercentage = totalResults > 0 ? parseFloat((((highRisk + criticalRisk) / totalResults) * 100).toFixed(1)) : 0

      return NextResponse.json({
        stats: {
          totalResults,
          matchBreakdown: {
            perfect_match: perfectMatches,
            partial_match: partialMatches,
            mismatch: mismatches,
            missing_in_books: missingInBooks,
            missing_in_gstr: missingInGstr,
            duplicate: duplicates,
          },
          unresolved,
          riskBreakdown: {
            high: highRisk,
            critical: criticalRisk,
            highAndCritical: highRisk + criticalRisk,
          },
          workflowBreakdown: {
            pending: pendingWorkflow,
            under_review: underReviewWorkflow,
            resolved: resolvedWorkflow,
            ignored: ignoredWorkflow,
            escalated: escalatedWorkflow,
          },
          matchPercentage,
          riskPercentage,
          totalGstDifference: parseFloat(totalGstDiff.toFixed(2)),
          avgMatchScore: avgMatchScore._avg.matchScore ? parseFloat(avgMatchScore._avg.matchScore.toFixed(1)) : 0,
          avgConfidenceScore: avgMatchScore._avg.confidenceScore ? parseFloat(avgMatchScore._avg.confidenceScore.toFixed(1)) : 0,
          recentRuns,
        },
      })
    }

    // Default: Fetch reconciliation results with enhanced filters
    const clientId = searchParams.get('clientId')
    const matchStatus = searchParams.get('matchStatus')
    const resolved = searchParams.get('resolved')
    const workflowStatus = searchParams.get('workflowStatus')
    const riskLevel = searchParams.get('riskLevel')
    const runId = searchParams.get('runId')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (clientId) where.clientId = clientId
    if (matchStatus) where.matchStatus = matchStatus
    if (resolved !== null && resolved !== undefined && resolved !== '') {
      where.resolved = resolved === 'true'
    }
    if (workflowStatus) where.workflowStatus = workflowStatus
    if (riskLevel) where.riskLevel = riskLevel
    if (runId) where.runId = runId

    // Search filter — search by invoice number, seller GSTIN, or buyer GSTIN
    if (search) {
      where.invoice = {
        OR: [
          { invoiceNumber: { contains: search } },
          { sellerGstin: { contains: search } },
          { buyerGstin: { contains: search } },
          { buyerName: { contains: search } },
        ],
      }
    }

    const results = await db.reconciliationResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          include: {
            client: {
              select: {
                id: true,
                tradeName: true,
                gstin: true,
              },
            },
          },
        },
        run: {
          select: {
            id: true,
            period: true,
            sources: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('GET /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reconciliation results' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/reconciliation — Run reconciliation, update workflow, or export
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body.action

    // ----------------------------------------------------------
    // action=run — Run a full reconciliation
    // ----------------------------------------------------------
    if (action === 'run' && body.clientId) {
      const { clientId, period, sources, runBy } = body

      // Verify client exists
      const client = await db.client.findUnique({ where: { id: clientId } })
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      // Determine sources
      const sourceList = sources ? String(sources).split(',').map((s: string) => s.trim()) : ['Purchase Register', 'GSTR-2B']
      const sourceA = sourceList[0] || 'Purchase Register'
      const sourceB = sourceList[1] || 'GSTR-2B'

      // Fetch all invoices for this client
      const invoices = await db.invoice.findMany({
        where: { clientId },
      })

      if (invoices.length === 0) {
        return NextResponse.json(
          { error: 'No invoices found for this client' },
          { status: 400 }
        )
      }

      // Create ReconciliationRun record
      const run = await db.reconciliationRun.create({
        data: {
          clientId,
          period: period || new Date().toISOString().slice(0, 7),
          sources: sourceList.join(','),
          totalRecords: invoices.length,
          status: 'running',
          runBy: runBy || null,
        },
      })

      let matched = 0
      let unmatched = 0
      let partialMatches = 0
      let highRiskCount = 0
      let totalGstDifference = 0

      // Track seen invoices for duplicate detection
      const seenInvoices = new Map<string, string[]>()
      const createdResults: Awaited<ReturnType<typeof db.reconciliationResult.create>>[] = []

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i]

        // Build sourceA representation from the invoice (Purchase Register data)
        const sourceAData: InvoiceLike = {
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          sellerGstin: inv.sellerGstin,
          buyerGstin: inv.buyerGstin,
          totalAmount: inv.totalAmount,
          cgst: inv.cgst,
          sgst: inv.sgst,
          igst: inv.igst,
          cess: inv.cess,
          taxableValue: inv.taxableValue,
        }

        // Simulate sourceB (GSTR-2B) data with potential variations
        const sourceBData = simulateGSTR2BData(sourceAData)

        // Check for duplicate invoices (same invoice number + seller GSTIN)
        const duplicateKey = `${inv.invoiceNumber.trim().toLowerCase()}_${inv.sellerGstin.trim().toUpperCase()}`
        const isDuplicate = seenInvoices.has(duplicateKey)
        if (!seenInvoices.has(duplicateKey)) {
          seenInvoices.set(duplicateKey, [inv.id])
        } else {
          seenInvoices.get(duplicateKey)!.push(inv.id)
        }

        let analysis: ReturnType<typeof detectMismatches>

        if (isDuplicate) {
          // Mark as duplicate
          analysis = {
            mismatches: [],
            matchStatus: 'duplicate',
            matchScore: 50,
            confidenceScore: 90,
            riskLevel: 'medium',
            aiRecommendation: 'mark_as_duplicate',
            aiExplanation: `Duplicate invoice detected — Invoice #${inv.invoiceNumber} from GSTIN ${inv.sellerGstin} appears multiple times in the data. This may indicate a data entry error or a genuine duplicate submission. Verify and mark accordingly to prevent duplicate ITC claims.`,
          }
        } else {
          // Perform multi-source comparison
          analysis = detectMismatches(sourceAData, sourceBData)
        }

        // Accumulate stats
        if (analysis.matchStatus === 'perfect_match') matched++
        else if (analysis.matchStatus === 'partial_match') partialMatches++
        else unmatched++

        if (analysis.riskLevel === 'high' || analysis.riskLevel === 'critical') highRiskCount++

        // Accumulate GST difference
        const gstDiffMismatch = analysis.mismatches.find(m => m.field === 'gst_amount')
        if (gstDiffMismatch && gstDiffMismatch.difference) {
          totalGstDifference += Math.abs(gstDiffMismatch.difference)
        }

        // Determine workflow status
        const workflowStatus: WorkflowStatus = analysis.matchStatus === 'perfect_match' ? 'resolved' : 'pending'

        // Delete existing reconciliation result for this invoice (if any) to allow re-runs
        await db.reconciliationResult.deleteMany({
          where: { invoiceId: inv.id },
        })

        // Create reconciliation result
        const result = await db.reconciliationResult.create({
          data: {
            clientId,
            invoiceId: inv.id,
            sourceType: 'books',
            sourceA,
            sourceB,
            sourceGstin: inv.sellerGstin,
            matchedGstin: inv.buyerGstin,
            matchStatus: analysis.matchStatus,
            matchScore: analysis.matchScore,
            mismatches: analysis.mismatches.length > 0 ? JSON.stringify(analysis.mismatches) : null,
            aiExplanation: analysis.aiExplanation,
            aiRecommendation: analysis.aiRecommendation,
            confidenceScore: analysis.confidenceScore,
            workflowStatus,
            riskLevel: analysis.riskLevel,
            resolved: analysis.matchStatus === 'perfect_match',
            resolvedBy: analysis.matchStatus === 'perfect_match' ? (runBy || 'system') : null,
            resolvedAt: analysis.matchStatus === 'perfect_match' ? new Date().toISOString().split('T')[0] : null,
            runId: run.id,
          },
        })

        createdResults.push(result)

        // Update invoice matchStatus and riskLevel
        await db.invoice.update({
          where: { id: inv.id },
          data: {
            matchStatus: analysis.matchStatus,
            riskLevel: analysis.riskLevel,
            riskScore: Math.round(analysis.matchStatus === 'perfect_match' ? 0 : (100 - analysis.matchScore)),
            aiExplanation: analysis.aiExplanation,
          },
        })
      }

      // Update the run with summary stats
      const updatedRun = await db.reconciliationRun.update({
        where: { id: run.id },
        data: {
          matched,
          unmatched,
          partialMatches,
          highRisk: highRiskCount,
          gstDifference: parseFloat(totalGstDifference.toFixed(2)),
          status: 'completed',
        },
      })

      // Create audit log
      await db.auditLog.create({
        data: {
          clientId,
          action: 'Reconciliation Run',
          entity: 'reconciliation',
          entityId: run.id,
          details: `Reconciliation run completed for ${client.tradeName} (${sourceA} vs ${sourceB}) — Total: ${invoices.length}, Matched: ${matched}, Partial: ${partialMatches}, Unmatched: ${unmatched}, High Risk: ${highRiskCount}, GST Diff: ₹${totalGstDifference.toFixed(2)}`,
        },
      })

      // ── Real Business Graph Engine™ — reconciliation updates invoice match status; refresh graph ──
      invalidateGraph()

      return NextResponse.json({
        message: `Reconciliation completed — ${invoices.length} records processed, ${matched} matched, ${partialMatches} partial, ${unmatched} unmatched`,
        run: updatedRun,
        results: createdResults,
        summary: {
          totalRecords: invoices.length,
          matched,
          partialMatches,
          unmatched,
          highRisk: highRiskCount,
          totalGstDifference: parseFloat(totalGstDifference.toFixed(2)),
        },
      })
    }

    // ----------------------------------------------------------
    // action=update_workflow — Update workflow status
    // ----------------------------------------------------------
    if (action === 'update_workflow') {
      const { id, workflowStatus } = body

      if (!id) {
        return NextResponse.json(
          { error: 'id is required' },
          { status: 400 }
        )
      }

      if (!workflowStatus || !VALID_WORKFLOW_STATUSES.includes(workflowStatus)) {
        return NextResponse.json(
          { error: `workflowStatus must be one of: ${VALID_WORKFLOW_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }

      const existing = await db.reconciliationResult.findUnique({
        where: { id },
        include: { invoice: { include: { client: true } } },
      })

      if (!existing) {
        return NextResponse.json(
          { error: 'Reconciliation result not found' },
          { status: 404 }
        )
      }

      const previousStatus = existing.workflowStatus

      const result = await db.reconciliationResult.update({
        where: { id },
        data: {
          workflowStatus,
          updatedAt: new Date(),
          // If resolved, also mark as resolved
          ...(workflowStatus === 'resolved' ? {
            resolved: true,
            resolvedAt: new Date().toISOString().split('T')[0],
          } : {}),
        },
      })

      // Create audit log
      await db.auditLog.create({
        data: {
          clientId: existing.clientId,
          action: 'Workflow Status Updated',
          entity: 'reconciliation',
          entityId: id,
          details: `Workflow status changed from '${previousStatus}' to '${workflowStatus}' for invoice ${existing.invoice?.invoiceNumber ?? id}`,
        },
      })

      // ── Real Business Graph Engine™ — invalidate cache so workflow change reflects instantly ──
      invalidateGraph()

      return NextResponse.json({ result })
    }

    // ----------------------------------------------------------
    // action=export — Export reconciliation data
    // ----------------------------------------------------------
    if (action === 'export') {
      const { format, clientId, filters } = body

      if (!format || !['excel', 'pdf', 'summary', 'mismatch', 'risk'].includes(format)) {
        return NextResponse.json(
          { error: 'format must be one of: excel, pdf, summary, mismatch, risk' },
          { status: 400 }
        )
      }

      // Build where clause from filters
      const where: Record<string, unknown> = {}
      if (clientId) where.clientId = clientId
      if (filters?.matchStatus) where.matchStatus = filters.matchStatus
      if (filters?.riskLevel) where.riskLevel = filters.riskLevel
      if (filters?.workflowStatus) where.workflowStatus = filters.workflowStatus
      if (filters?.runId) where.runId = filters.runId
      if (filters?.resolved !== undefined && filters?.resolved !== null && filters?.resolved !== '') {
        where.resolved = filters.resolved === 'true'
      }
      if (filters?.search) {
        where.invoice = {
          OR: [
            { invoiceNumber: { contains: filters.search } },
            { sellerGstin: { contains: filters.search } },
            { buyerGstin: { contains: filters.search } },
            { buyerName: { contains: filters.search } },
          ],
        }
      }

      // Apply format-specific filters
      if (format === 'mismatch') {
        where.matchStatus = { in: ['mismatch', 'partial_match', 'missing_in_books', 'missing_in_gstr', 'duplicate'] }
      }
      if (format === 'risk') {
        where.riskLevel = { in: ['high', 'critical'] }
      }

      const results = await db.reconciliationResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            include: {
              client: {
                select: {
                  id: true,
                  tradeName: true,
                  gstin: true,
                },
              },
            },
          },
        },
      })

      // Build export data based on format
      let exportData: Record<string, unknown> = {}

      if (format === 'summary') {
        const statusCounts: Record<string, number> = {}
        const riskCounts: Record<string, number> = {}
        const workflowCounts: Record<string, number> = {}
        let totalGstDiff = 0

        for (const r of results) {
          statusCounts[r.matchStatus] = (statusCounts[r.matchStatus] || 0) + 1
          riskCounts[r.riskLevel || 'unknown'] = (riskCounts[r.riskLevel || 'unknown'] || 0) + 1
          workflowCounts[r.workflowStatus || 'unknown'] = (workflowCounts[r.workflowStatus || 'unknown'] || 0) + 1

          if (r.mismatches) {
            try {
              const parsed = JSON.parse(r.mismatches)
              if (Array.isArray(parsed)) {
                for (const m of parsed) {
                  if (m.field === 'gst_amount' && m.difference) {
                    totalGstDiff += Math.abs(m.difference)
                  }
                }
              }
            } catch { /* ignore */ }
          }
        }

        exportData = {
          totalRecords: results.length,
          matchStatusBreakdown: statusCounts,
          riskLevelBreakdown: riskCounts,
          workflowStatusBreakdown: workflowCounts,
          totalGstDifference: parseFloat(totalGstDiff.toFixed(2)),
          unresolved: results.filter(r => !r.resolved).length,
        }
      } else {
        // Excel, PDF, mismatch, risk — return detailed records
        exportData = {
          records: results.map(r => ({
            id: r.id,
            clientName: (r.invoice as { client?: { tradeName: string } })?.client?.tradeName ?? 'Unknown',
            clientGstin: (r.invoice as { client?: { gstin: string } })?.client?.gstin ?? 'Unknown',
            invoiceNumber: (r.invoice as { invoiceNumber?: string })?.invoiceNumber ?? 'Unknown',
            invoiceDate: (r.invoice as { invoiceDate?: string })?.invoiceDate ?? 'Unknown',
            sellerGstin: (r.invoice as { sellerGstin?: string })?.sellerGstin ?? 'Unknown',
            buyerGstin: (r.invoice as { buyerGstin?: string })?.buyerGstin ?? 'Unknown',
            totalAmount: (r.invoice as { totalAmount?: number })?.totalAmount ?? 0,
            cgst: (r.invoice as { cgst?: number })?.cgst ?? 0,
            sgst: (r.invoice as { sgst?: number })?.sgst ?? 0,
            igst: (r.invoice as { igst?: number })?.igst ?? 0,
            matchStatus: r.matchStatus,
            matchScore: r.matchScore,
            confidenceScore: r.confidenceScore,
            riskLevel: r.riskLevel,
            workflowStatus: r.workflowStatus,
            sourceA: r.sourceA,
            sourceB: r.sourceB,
            aiRecommendation: r.aiRecommendation,
            aiExplanation: r.aiExplanation,
            mismatches: r.mismatches,
            resolved: r.resolved,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
        }
      }

      return NextResponse.json({
        export: {
          format,
          generatedAt: new Date().toISOString(),
          clientId: clientId || 'all',
          filters: filters || {},
          totalRecords: results.length,
          ...exportData,
        },
      })
    }

    // ----------------------------------------------------------
    // Default: Create a single reconciliation result
    // ----------------------------------------------------------
    const {
      clientId,
      invoiceId,
      sourceType,
      sourceA,
      sourceB,
      sourceGstin,
      matchedGstin,
      matchStatus,
      matchScore,
      mismatches,
      aiExplanation,
      aiRecommendation,
      confidenceScore,
      workflowStatus,
      riskLevel,
      runId,
    } = body

    if (!clientId || !invoiceId) {
      return NextResponse.json(
        { error: 'clientId and invoiceId are required' },
        { status: 400 }
      )
    }

    const result = await db.reconciliationResult.create({
      data: {
        clientId,
        invoiceId,
        sourceType: sourceType ?? 'books',
        sourceA: sourceA ?? 'Purchase Register',
        sourceB: sourceB ?? 'GSTR-2B',
        sourceGstin: sourceGstin ?? null,
        matchedGstin: matchedGstin ?? null,
        matchStatus: matchStatus ?? 'unmatched',
        matchScore: matchScore ?? 0,
        mismatches: mismatches ?? null,
        aiExplanation: aiExplanation ?? null,
        aiRecommendation: aiRecommendation ?? null,
        confidenceScore: confidenceScore ?? 0,
        workflowStatus: workflowStatus ?? 'pending',
        riskLevel: riskLevel ?? 'low',
        runId: runId ?? null,
      },
    })

    return NextResponse.json({ result }, { status: 201 })
  } catch (error) {
    console.error('POST /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process reconciliation' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/reconciliation — Resolve a reconciliation result
// ============================================================
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, resolvedBy } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.reconciliationResult.findUnique({
      where: { id },
      include: { invoice: { include: { client: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Reconciliation result not found' },
        { status: 404 }
      )
    }

    const result = await db.reconciliationResult.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: resolvedBy ?? null,
        resolvedAt: new Date().toISOString().split('T')[0],
        workflowStatus: 'resolved',
        updatedAt: new Date(),
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'Reconciliation Resolved',
        entity: 'reconciliation',
        entityId: id,
        details: `Reconciliation result resolved for invoice ${existing.invoice?.invoiceNumber ?? id}. Workflow status updated to 'resolved'.`,
      },
    })

    return NextResponse.json({ result })
  } catch (error) {
    console.error('PUT /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve reconciliation' },
      { status: 500 }
    )
  }
}

// PATCH /api/reconciliation?id=... — Update a reconciliation run (e.g. rename, change status)
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Reconciliation run id is required (use ?id=)' },
        { status: 400 }
      )
    }

    const existing = await db.reconciliationRun.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Reconciliation run not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.totalRecords !== undefined) updateData.totalRecords = body.totalRecords
    if (body.matchedRecords !== undefined) updateData.matchedRecords = body.matchedRecords
    if (body.mismatchedRecords !== undefined) updateData.mismatchedRecords = body.mismatchedRecords

    const run = await db.reconciliationRun.update({
      where: { id },
      data: updateData,
    })

    invalidateGraph()

    return NextResponse.json({ run })
  } catch (error) {
    console.error('PATCH /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update reconciliation' },
      { status: 500 }
    )
  }
}

// DELETE /api/reconciliation?id=... — Delete a reconciliation run and its results
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Reconciliation run id is required (use ?id=)' },
        { status: 400 }
      )
    }

    const existing = await db.reconciliationRun.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Reconciliation run not found' },
        { status: 404 }
      )
    }

    // Delete results first (FK), then the run
    await db.reconciliationResult.deleteMany({ where: { runId: id } })
    await db.reconciliationRun.delete({ where: { id } })

    invalidateGraph()

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error('DELETE /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete reconciliation' },
      { status: 500 }
    )
  }
}
