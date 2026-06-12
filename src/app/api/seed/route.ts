import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ─── helpers ────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(baseYear: number, month: number, dayRange: [number, number]): string {
  const day = rand(dayRange[0], dayRange[1])
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${baseYear}-${m}-${d}`
}

// ─── POST handler ───────────────────────────────────────────────────────────
export async function POST() {
  try {
    // 1. Clear existing data (respect foreign key order)
    await db.clientBenchmark.deleteMany()
    await db.executiveReport.deleteMany()
    await db.documentChatSession.deleteMany()
    await db.knowledgeEntry.deleteMany()
    await db.aITask.deleteMany()
    await db.clientInsight.deleteMany()
    await db.complianceForecast.deleteMany()
    await db.riskScore.deleteMany()
    await db.aIPrediction.deleteMany()
    await db.automationLog.deleteMany()
    await db.automationRule.deleteMany()
    await db.workloadAssignment.deleteMany()
    await db.teamPerformance.deleteMany()
    await db.notice.deleteMany()
    await db.document.deleteMany()
    await db.firmMetrics.deleteMany()
    await db.firmSettings.deleteMany()
    await db.teamMember.deleteMany()
    await db.filingEvent.deleteMany()
    await db.reconciliationResult.deleteMany()
    await db.reconciliationRun.deleteMany()
    await db.issue.deleteMany()
    await db.auditLog.deleteMany()
    await db.healthScore.deleteMany()
    await db.gSTRFiling.deleteMany()
    await db.invoice.deleteMany()
    await db.client.deleteMany()
    await db.user.deleteMany()

    // 2. Create Users
    const users = await Promise.all([
      db.user.create({
        data: { name: 'CA Rajesh Kumar', email: 'rajesh@gstpilot.ai', role: 'admin' },
      }),
      db.user.create({
        data: { name: 'Priya Sharma', email: 'priya@gstpilot.ai', role: 'manager' },
      }),
      db.user.create({
        data: { name: 'Amit Patel', email: 'amit@gstpilot.ai', role: 'staff' },
      }),
    ])

    // 3. Create Clients
    const clientDefs = [
      {
        tradeName: 'Sharma Enterprises',
        gstin: '27AABCS1429B1Z5',
        address: '302, Laxmi Nagar, Andheri East',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'accounts@sharmaent.com',
        contactPhone: '+91-22-2847-3001',
        legalName: 'Sharma Enterprises Pvt Ltd',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 92,
      },
      {
        tradeName: 'Patel & Sons',
        gstin: '24AABCP5678G1Z3',
        address: '15, CG Road, Navrangpura',
        state: 'Gujarat',
        stateCode: '24',
        contactEmail: 'gst@patelsons.com',
        contactPhone: '+91-79-6677-8888',
        legalName: 'Patel & Sons Trading Co',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 78,
      },
      {
        tradeName: 'Krishna Traders',
        gstin: '06AABCK9012H1Z1',
        address: 'Plot 45, Udyog Vihar, Phase III',
        state: 'Haryana',
        stateCode: '06',
        contactEmail: 'gst@krishnatraders.in',
        contactPhone: '+91-124-2852-0261',
        legalName: 'Krishna Traders Pvt Ltd',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 88,
      },
      {
        tradeName: 'Metro Retail',
        gstin: '33AABCM3456J1Z7',
        address: '78, T Nagar, Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        contactEmail: 'tax@metroretail.com',
        contactPhone: '+91-44-6778-9999',
        legalName: 'Metro Retail India Pvt Ltd',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 65,
      },
      {
        tradeName: 'Gupta Manufacturing',
        gstin: '09AABCG2345L1Z2',
        address: '12, Sector 62, Noida',
        state: 'Uttar Pradesh',
        stateCode: '09',
        contactEmail: 'finance@guptamfg.com',
        contactPhone: '+91-120-2345-6789',
        legalName: 'Gupta Manufacturing Co',
        entityType: 'composition',
        returnPeriod: 'quarterly',
        status: 'active',
        healthScore: 91,
      },
      {
        tradeName: 'Sunrise Exports',
        gstin: '27AABCS7890K1Z9',
        address: '501, MIDC, Andheri East',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'compliance@sunriseexports.com',
        contactPhone: '+91-22-4567-8901',
        legalName: 'Sunrise Exports India Ltd',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 85,
      },
      {
        tradeName: 'RK Electronics',
        gstin: '29AABCD6789M1Z4',
        address: '22, Electronic City, Phase I',
        state: 'Karnataka',
        stateCode: '29',
        contactEmail: 'gst@rkelectronics.in',
        contactPhone: '+91-80-4567-8901',
        legalName: 'RK Electronics Pvt Ltd',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 73,
      },
      {
        tradeName: 'Apex Logistics',
        gstin: '27AABCA0123N1Z6',
        address: '8, Transport Nagar, Kalamboli',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'tax@apexlogistics.com',
        contactPhone: '+91-22-8901-2345',
        legalName: 'Apex Logistics India Pvt Ltd',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'inactive',
        healthScore: 45,
      },
    ]

    const clients = []
    for (const def of clientDefs) {
      const client = await db.client.create({ data: def })
      clients.push(client)
    }

    // 4. Create Invoices for each client
    const invoiceTypes = ['B2B', 'B2C Large', 'B2C Small', 'Export', 'Credit Note']
    const gstr1Sections = ['b2b', 'b2cl', 'b2cs', 'exp', 'cdnr']
    const matchStatuses = ['perfect_match', 'partial_match', 'mismatch', 'missing_in_books', 'missing_in_gstr', 'unmatched']
    const riskLevels = ['low', 'medium', 'high', 'critical']
    const taxRates = [0.05, 0.12, 0.18]

    const buyerGstins = [
      '06AABCR5638L1Z5', // Haryana
      '07AABCI6228L1Z8', // Delhi
      '33AABCT1332L1Z2', // Tamil Nadu
      '09AABCW5982L1Z1', // UP
      '24AABCM5638L1Z3', // Gujarat
      '19AABCB4298L1Z9', // West Bengal
      '32AABCH5682L1Z6', // Kerala
      '36AABCL5298L1Z4', // Telangana
    ]
    const buyerNames = [
      'Vijay Components Pvt Ltd',
      'Delhi Auto Parts',
      'Chennai Textiles Ltd',
      'UP Agro Industries',
      'Rajkot Engineering',
      'Kolkata Traders',
      'Kerala Spices Co',
      'Hyderabad IT Solutions',
    ]

    const allInvoices: Awaited<ReturnType<typeof db.invoice.create>>[] = []

    for (const client of clients) {
      const invoiceCount = rand(5, 8)
      for (let i = 0; i < invoiceCount; i++) {
        const invIdx = i + 1
        const invType = invoiceTypes[i % invoiceTypes.length]
        const sectionIdx = invoiceTypes.indexOf(invType)
        const isCreditNote = invType === 'Credit Note'
        const isExport = invType === 'Export'
        const isB2CSmall = invType === 'B2C Small'

        const month = rand(1, 6)
        const period = `2025-${String(month).padStart(2, '0')}`
        const invoiceDate = randomDate(2025, month, [1, 28])

        const taxableValue = rand(15000, 500000)
        const rate = pick(taxRates)
        const isInterState = client.stateCode !== buyerGstins[i % buyerGstins.length].substring(0, 2)

        let cgst = 0
        let sgst = 0
        let igst = 0
        if (isExport) {
          igst = Math.round(taxableValue * rate)
        } else if (isInterState) {
          igst = Math.round(taxableValue * rate)
        } else {
          cgst = Math.round(taxableValue * rate / 2)
          sgst = Math.round(taxableValue * rate / 2)
        }

        const totalAmount = taxableValue + cgst + sgst + igst

        const matchStatus = pick(matchStatuses)
        const riskLevel = pick(riskLevels)
        const riskScore =
          matchStatus === 'perfect_match' ? rand(0, 20) :
          matchStatus === 'partial_match' ? rand(20, 50) :
          matchStatus === 'mismatch' ? rand(50, 80) :
          matchStatus === 'missing_in_books' ? rand(70, 90) :
          matchStatus === 'missing_in_gstr' ? rand(60, 85) :
          rand(30, 70)

        const aiExplanation =
          matchStatus === 'mismatch'
            ? `AI detected a tax amount discrepancy of ₹${Math.abs(rand(1000, 15000))} between books and GSTR-1 for this invoice. Possible cause: incorrect tax rate applied.`
            : matchStatus === 'partial_match'
            ? `Partial match found — taxable value matches but GSTIN of buyer differs. Likely a data entry error in recipient GSTIN.`
            : matchStatus === 'missing_in_gstr'
            ? `Invoice present in books but not found in GSTR-1. This may indicate the invoice was not reported or was reported under a different number.`
            : matchStatus === 'missing_in_books'
            ? `Invoice appears in GSTR-1 but not in company books. Possible omission or timing difference in recording.`
            : undefined

        const invoice = await db.invoice.create({
          data: {
            clientId: client.id,
            invoiceNumber: `INV/2025/${String(invIdx).padStart(3, '0')}`,
            invoiceDate,
            sellerGstin: client.gstin,
            buyerGstin: isB2CSmall ? null : buyerGstins[i % buyerGstins.length],
            buyerName: isB2CSmall ? null : buyerNames[i % buyerNames.length],
            invoiceType: invType,
            gstr1Section: gstr1Sections[sectionIdx] ?? 'b2b',
            taxableValue,
            cgst,
            sgst,
            igst,
            cess: 0,
            totalAmount,
            hsnCode: pick(['998314', '998315', '8471', '8517', '7308', '8703', '6109', '2106']),
            reverseCharge: i % 7 === 0,
            status: isCreditNote ? 'credit_note' : 'posted',
            matchStatus,
            riskLevel,
            riskScore,
            aiExplanation,
            period,
          },
        })
        allInvoices.push(invoice)
      }
    }

    // 5. Create GSTR Filings for each client
    const returnTypes = ['GSTR-1', 'GSTR-3B']
    const filingStatuses = ['draft', 'prepared', 'validated', 'reviewed', 'generated', 'filed']

    const allFilings: Awaited<ReturnType<typeof db.gSTRFiling.create>>[] = []

    for (const client of clients) {
      const filingCount = rand(3, 4)
      const usedPeriods = new Set<string>()

      for (let i = 0; i < filingCount; i++) {
        const returnType = returnTypes[i % 2]
        const periodMonth = rand(1, 6)
        const period = `2025-${String(periodMonth).padStart(2, '0')}`
        const key = `${returnType}-${period}`

        // avoid duplicates for same returnType+period on same client
        if (usedPeriods.has(key)) continue
        usedPeriods.add(key)

        const statusIdx = rand(0, filingStatuses.length - 1)
        const status = filingStatuses[statusIdx]
        const isFiled = status === 'filed'

        const totalTaxable = rand(200000, 5000000)
        const totalTax = Math.round(totalTaxable * 0.18)

        const filing = await db.gSTRFiling.create({
          data: {
            clientId: client.id,
            returnType,
            period,
            financialYear: '2025-26',
            status,
            filedDate: isFiled ? randomDate(2025, periodMonth > 1 ? periodMonth - 1 : 1, [1, 20]) : null,
            acknowledgmentNumber: isFiled ? `ACK${rand(10000000, 99999999)}` : null,
            totalInvoices: rand(15, 80),
            readyForFiling: rand(10, 70),
            issuesFound: rand(0, 8),
            criticalErrors: rand(0, 3),
            warnings: rand(0, 5),
            totalTaxableValue: totalTaxable,
            totalTax,
          },
        })
        allFilings.push(filing)
      }
    }

    // 6. Create Filing Events for each filing
    const eventTypes = ['data_imported', 'validation_completed', 'review_completed', 'gstr_generated', 'filed']
    const eventDescriptions: Record<string, string> = {
      data_imported: 'Invoice data imported from ERP system',
      validation_completed: 'Validation checks completed successfully',
      review_completed: 'Manager review completed',
      gstr_generated: 'GSTR JSON file generated',
      filed: 'Return filed on GST portal',
    }

    let totalFilingEvents = 0

    for (const filing of allFilings) {
      const eventCount = rand(4, 6)
      for (let i = 0; i < eventCount; i++) {
        const eventType = eventTypes[i % eventTypes.length]
        const user = pick(users)

        await db.filingEvent.create({
          data: {
            filingId: filing.id,
            clientId: filing.clientId,
            eventType,
            description: eventDescriptions[eventType],
            userId: user.id,
            timestamp: new Date(
              2025,
              rand(0, 5),
              rand(1, 28),
              rand(9, 18),
              rand(0, 59),
            ),
          },
        })
        totalFilingEvents++
      }
    }

    // 7. Create Reconciliation Runs for each client (2-3 per client)
    const runSources = [
      'Purchase Register,GSTR-2B',
      'Purchase Register,GSTR-2A',
      'Books,GSTR-1',
      'Sales Register,GSTR-1',
      'Purchase Register,GSTR-2B',
    ]
    const runStatuses = ['completed', 'completed', 'completed', 'in_progress', 'failed']

    const allRuns: Awaited<ReturnType<typeof db.reconciliationRun.create>>[] = []

    for (const client of clients) {
      const runCount = rand(2, 3)
      const usedRunPeriods = new Set<string>()

      for (let i = 0; i < runCount; i++) {
        const month = rand(1, 6)
        const period = `2025-${String(month).padStart(2, '0')}`

        // Avoid duplicate periods for same client runs (allow some overlap for different sources)
        const runKey = `${period}-${i}`
        if (usedRunPeriods.has(runKey)) continue
        usedRunPeriods.add(runKey)

        const sources = runSources[i % runSources.length]
        const status = pick(runStatuses)

        const totalRecords = rand(10, 60)
        const matched = rand(Math.floor(totalRecords * 0.3), Math.floor(totalRecords * 0.7))
        const partialMatches = rand(Math.floor(totalRecords * 0.05), Math.floor(totalRecords * 0.2))
        const unmatched = totalRecords - matched - partialMatches
        const highRisk = rand(Math.floor(unmatched * 0.1), Math.floor(unmatched * 0.5))
        const gstDifference = rand(2000, 50000)

        const run = await db.reconciliationRun.create({
          data: {
            clientId: client.id,
            period,
            sources,
            totalRecords,
            matched,
            unmatched,
            partialMatches,
            highRisk,
            gstDifference,
            status,
            runBy: pick(users).id,
          },
        })
        allRuns.push(run)
      }
    }

    // 8. Create Reconciliation Results for some invoices (with enhanced fields)
    const recMatchStatuses = ['perfect_match', 'partial_match', 'mismatch', 'missing_in_books', 'missing_in_gstr']
    let totalReconciliations = 0

    // Helper to determine workflowStatus based on matchStatus
    function getWorkflowStatus(matchStatus: string): string {
      switch (matchStatus) {
        case 'perfect_match':
          return 'resolved'
        case 'mismatch':
          return 'pending'
        case 'missing_in_books':
        case 'missing_in_gstr':
          return 'pending'
        case 'partial_match':
          // Some partial matches are under_review, most are pending
          return Math.random() < 0.4 ? 'under_review' : 'pending'
        default:
          return 'pending'
      }
    }

    // Helper to determine confidenceScore based on matchStatus
    function getConfidenceScore(matchStatus: string): number {
      switch (matchStatus) {
        case 'perfect_match':
          return rand(85, 98)
        case 'partial_match':
          return rand(50, 84)
        case 'mismatch':
          return rand(20, 49)
        case 'missing_in_books':
        case 'missing_in_gstr':
          return rand(0, 19)
        default:
          return rand(0, 50)
      }
    }

    // Helper to determine aiRecommendation based on mismatch type
    function getAiRecommendation(matchStatus: string, mismatches: string | null): string {
      if (matchStatus === 'perfect_match') {
        return 'no_action_needed'
      }

      // Parse mismatches to determine recommendation
      if (mismatches) {
        try {
          const mismatchArr = JSON.parse(mismatches) as Array<{ field: string }>
          const fields = mismatchArr.map((m) => m.field)

          if (fields.includes('buyerGstin') || fields.includes('sellerGstin') || fields.includes('matchedGstin')) {
            return 'correct_gstin'
          }
          if (fields.includes('taxableValue') || fields.includes('cgst') || fields.includes('sgst') || fields.includes('igst')) {
            return 'adjust_gst_amount'
          }
          if (fields.includes('invoiceNumber')) {
            return 'correct_invoice_number'
          }
        } catch {
          // fallback below
        }
      }

      // Default recommendations by matchStatus
      switch (matchStatus) {
        case 'mismatch':
          return pick(['adjust_gst_amount', 'correct_gstin', 'review_vendor_data'])
        case 'partial_match':
          return pick(['correct_gstin', 'correct_invoice_number', 'review_vendor_data'])
        case 'missing_in_books':
          return pick(['mark_as_duplicate', 'review_manually'])
        case 'missing_in_gstr':
          return 'review_manually'
        default:
          return 'review_manually'
      }
    }

    for (const invoice of allInvoices) {
      // Create reconciliation for roughly 60% of invoices
      if (Math.random() < 0.4) continue

      const resolvedMatchStatus = invoice.matchStatus === 'unmatched'
        ? pick(recMatchStatuses)
        : invoice.matchStatus as string

      const matchScore =
        resolvedMatchStatus === 'perfect_match' ? rand(90, 100) :
        resolvedMatchStatus === 'partial_match' ? rand(50, 89) :
        resolvedMatchStatus === 'mismatch' ? rand(10, 49) :
        rand(0, 30)

      const resolved = resolvedMatchStatus === 'perfect_match' || (Math.random() < 0.3)
      const client = clients.find((c) => c.id === invoice.clientId)

      const mismatches = resolvedMatchStatus === 'mismatch'
        ? JSON.stringify([{ field: 'taxableValue', books: invoice.taxableValue, gstr: invoice.taxableValue + rand(500, 5000) }])
        : resolvedMatchStatus === 'partial_match'
        ? JSON.stringify([{ field: 'buyerGstin', books: invoice.buyerGstin, gstr: invoice.buyerGstin?.replace(/.$/, 'X') ?? null }])
        : resolvedMatchStatus === 'missing_in_books'
        ? JSON.stringify([{ field: 'invoiceNumber', books: null, gstr: invoice.invoiceNumber }])
        : resolvedMatchStatus === 'missing_in_gstr'
        ? JSON.stringify([{ field: 'invoiceNumber', books: invoice.invoiceNumber, gstr: null }])
        : null

      const aiRecExplanation =
        resolvedMatchStatus === 'mismatch'
          ? `Reconciliation mismatch: Tax amount differs between books (₹${invoice.cgst + invoice.sgst + invoice.igst}) and GSTR-1. Recommend verifying tax rate applied.`
          : resolvedMatchStatus === 'partial_match'
          ? `Partial reconciliation — buyer GSTIN mismatch detected. Verify recipient details before filing.`
          : resolvedMatchStatus === 'missing_in_books'
          ? `Invoice found in GSTR but missing from company books. Possible data entry omission or timing difference.`
          : resolvedMatchStatus === 'missing_in_gstr'
          ? `Invoice present in books but not reflected in GSTR. May require manual reporting or amendment.`
          : undefined

      const confidenceScore = getConfidenceScore(resolvedMatchStatus)
      const workflowStatus = getWorkflowStatus(resolvedMatchStatus)
      const aiRecommendation = getAiRecommendation(resolvedMatchStatus, mismatches)

      // Determine sourceA and sourceB based on sourceType
      const sourceType = pick(['books', 'gstr1', 'gstr2a'])
      const sourceA = sourceType === 'gstr2a' ? 'Purchase Register' : 'Sales Register'
      const sourceB = sourceType === 'gstr2a' ? 'GSTR-2B' : sourceType === 'gstr1' ? 'GSTR-1' : 'GSTR-2B'

      // Find a matching run for this client (prefer one in the same period)
      const clientRuns = allRuns.filter((r) => r.clientId === invoice.clientId)
      const periodRuns = clientRuns.filter((r) => r.period === invoice.period)
      const runId = periodRuns.length > 0
        ? pick(periodRuns).id
        : clientRuns.length > 0
          ? pick(clientRuns).id
          : null

      await db.reconciliationResult.create({
        data: {
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          sourceType,
          sourceA,
          sourceB,
          sourceGstin: client?.gstin ?? null,
          matchedGstin: invoice.buyerGstin,
          matchStatus: resolvedMatchStatus,
          matchScore,
          mismatches,
          aiExplanation: aiRecExplanation,
          aiRecommendation,
          confidenceScore,
          workflowStatus,
          resolved,
          resolvedBy: resolved ? pick(users).id : null,
          resolvedAt: resolved ? randomDate(2025, rand(2, 6), [1, 28]) : null,
          runId,
        },
      })
      totalReconciliations++
    }

    // 9. Create Issues for each client
    const severities = ['critical', 'warning', 'info']
    const categories = ['GST Mismatch', 'Tax Mismatch', 'Date Mismatch', 'Missing Invoice', 'Duplicate', 'Invalid GSTIN']
    const issueStatuses = ['open', 'resolved', 'ignored']

    const issueTitles: Record<string, string[]> = {
      'GST Mismatch': [
        'GSTIN mismatch in invoice vs GSTR-1',
        'Recipient GSTIN not matching with GSTR-2A',
        'Supplier GSTIN discrepancy found',
      ],
      'Tax Mismatch': [
        'CGST/SGST calculation discrepancy',
        'IGST amount differs between books and return',
        'Tax rate applied incorrectly on invoice',
        'Cess amount mismatch detected',
      ],
      'Date Mismatch': [
        'Invoice date outside reporting period',
        'Filing date exceeds due date',
      ],
      'Missing Invoice': [
        'Invoice found in GSTR-2A but not in books',
        'Invoice in books missing from GSTR-1',
        'Credit note not reflected in return',
      ],
      'Duplicate': [
        'Duplicate invoice number detected',
        'Same GSTIN and invoice amount found twice',
      ],
      'Invalid GSTIN': [
        'Buyer GSTIN failed validation check',
        'GSTIN checksum verification failed',
      ],
    }

    let totalIssues = 0

    for (const client of clients) {
      const issueCount = rand(3, 5)
      const clientInvoices = allInvoices.filter((inv) => inv.clientId === client.id)
      const clientFilings = allFilings.filter((f) => f.clientId === client.id)

      for (let i = 0; i < issueCount; i++) {
        const category = categories[i % categories.length]
        const severity = pick(severities)
        const title = pick(issueTitles[category] ?? [category])

        const issueStatus = severity === 'info'
          ? pick(['resolved', 'ignored'])
          : pick(issueStatuses)

        const assignedTo = issueStatus === 'open' ? pick(users).id : null
        const resolvedAt = issueStatus === 'resolved' ? randomDate(2025, rand(2, 6), [1, 28]) : null

        await db.issue.create({
          data: {
            clientId: client.id,
            invoiceId: clientInvoices.length > 0 ? pick(clientInvoices).id : null,
            filingId: clientFilings.length > 0 ? pick(clientFilings).id : null,
            severity,
            category,
            title,
            description: `${title} — detected during reconciliation for period 2025-${String(rand(1, 6)).padStart(2, '0')}. Requires review by the GST compliance team.`,
            status: issueStatus,
            assignedTo,
            notes: issueStatus === 'resolved' ? 'Issue reviewed and resolved by team.' : issueStatus === 'ignored' ? 'False positive — acknowledged and ignored.' : null,
            resolvedAt,
          },
        })
        totalIssues++
      }
    }

    // 10. Create Health Score Records for each client
    let totalHealthScores = 0

    for (const client of clients) {
      const recordCount = rand(3, 6)
      for (let i = 0; i < recordCount; i++) {
        const month = i + 1
        const period = `2025-${String(month).padStart(2, '0')}`

        await db.healthScore.create({
          data: {
            clientId: client.id,
            score: Math.max(0, Math.min(100, client.healthScore + rand(-15, 15))),
            missingGstin: rand(0, 5),
            invalidGstin: rand(0, 3),
            duplicateInvoices: rand(0, 2),
            filingDelays: rand(0, 4),
            validationErrors: rand(0, 6),
            period,
          },
        })
        totalHealthScores++
      }
    }

    // 11. Create Audit Log Entries
    const auditActions = [
      'GSTR Generated',
      'GSTR Downloaded',
      'Return Filed',
      'Invoice Approved',
      'Reconciliation Completed',
      'Client Onboarded',
      'User Login',
      'Report Exported',
      'Invoice Uploaded',
      'Settings Updated',
    ]

    let totalAuditLogs = 0
    const logCount = rand(15, 20)

    for (let i = 0; i < logCount; i++) {
      const action = pick(auditActions)
      const client = pick(clients)
      const user = pick(users)

      await db.auditLog.create({
        data: {
          clientId: client.id,
          userId: user.id,
          action,
          entity: pick(['invoice', 'filing', 'client', 'reconciliation', 'report']),
          entityId: pick([...allInvoices, ...allFilings]).id,
          details: `${action} for ${client.tradeName} by ${user.name}`,
          timestamp: new Date(2025, rand(0, 5), rand(1, 28), rand(9, 18), rand(0, 59)),
        },
      })
      totalAuditLogs++
    }

    // ─── CA Firm Operations Layer Seed Data ───

    // 12. Create Team Members
    const teamMembers = await Promise.all([
      db.teamMember.create({
        data: { name: 'CA Rajesh Kumar', email: 'rajesh@gstpilot.ai', role: 'admin', department: 'management', isActive: true },
      }),
      db.teamMember.create({
        data: { name: 'Priya Sharma', email: 'priya@gstpilot.ai', role: 'manager', department: 'audit', isActive: true },
      }),
      db.teamMember.create({
        data: { name: 'Amit Patel', email: 'amit@gstpilot.ai', role: 'auditor', department: 'audit', isActive: true },
      }),
      db.teamMember.create({
        data: { name: 'Sneha Reddy', email: 'sneha@gstpilot.ai', role: 'auditor', department: 'tax', isActive: true },
      }),
      db.teamMember.create({
        data: { name: 'Vikram Singh', email: 'vikram@gstpilot.ai', role: 'staff', department: 'compliance', isActive: true },
      }),
      db.teamMember.create({
        data: { name: 'Neha Gupta', email: 'neha@gstpilot.ai', role: 'staff', department: 'data-entry', isActive: true },
      }),
      db.teamMember.create({
        data: { name: 'Ravi Krishnan', email: 'ravi@gstpilot.ai', role: 'manager', department: 'tax', isActive: true },
      }),
      db.teamMember.create({
        data: { name: 'Anjali Desai', email: 'anjali@gstpilot.ai', role: 'staff', department: 'compliance', isActive: false },
      }),
    ])

    // 13. Create Team Performance Records
    let totalPerformanceRecords = 0
    for (const member of teamMembers) {
      if (!member.isActive) continue
      for (let m = 1; m <= 6; m++) {
        const period = `2025-${String(m).padStart(2, '0')}`
        const baseVolume = member.role === 'admin' ? 20 : member.role === 'manager' ? 40 : member.role === 'auditor' ? 60 : 80
        const invoicesProcessed = rand(baseVolume, baseVolume + 30)
        const reviewsCompleted = member.role === 'auditor' || member.role === 'manager' ? rand(15, 40) : rand(5, 15)
        const approvalsCompleted = member.role === 'manager' || member.role === 'admin' ? rand(10, 30) : rand(0, 5)
        const averageAccuracy = rand(88, 99)
        const averageTurnaround = rand(2, 24)
        const totalActions = invoicesProcessed + reviewsCompleted + approvalsCompleted
        const score = (averageAccuracy * 0.3) + (totalActions / 150 * 25) + ((24 - averageTurnaround) / 24 * 25) + (reviewsCompleted / 40 * 20)

        await db.teamPerformance.create({
          data: {
            teamMemberId: member.id,
            period,
            invoicesProcessed,
            reviewsCompleted,
            approvalsCompleted,
            averageAccuracy,
            averageTurnaround,
            totalActions,
            score: Math.min(100, Math.max(0, score)),
          },
        })
        totalPerformanceRecords++
      }
    }

    // 14. Create Workload Assignments
    let totalAssignments = 0
    const assignmentTypes = ['invoice', 'review', 'approval', 'notice']
    const assignmentStatuses = ['pending', 'in-progress', 'completed']
    const priorities = ['low', 'medium', 'high', 'urgent']

    for (const member of teamMembers) {
      if (!member.isActive) continue
      const assignmentCount = rand(4, 8)
      for (let i = 0; i < assignmentCount; i++) {
        const status = pick(assignmentStatuses)
        const client = pick(clients)
        await db.workloadAssignment.create({
          data: {
            teamMemberId: member.id,
            entityType: pick(assignmentTypes),
            title: `${pick(['Process', 'Review', 'Approve', 'Verify'])} ${pick(['Invoice', 'Return', 'Notice', 'Document'])} - ${client.tradeName}`,
            clientId: client.id,
            status,
            priority: pick(priorities),
            dueDate: `2025-${String(rand(3, 8)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
            assignedBy: teamMembers[0].id,
          },
        })
        totalAssignments++
      }
    }

    // 15. Create Notices
    let totalNotices = 0
    const noticeTypes = ['gst_notice', 'department_notice', 'tax_query']
    const noticeSubjects = [
      'GST Assessment Notice for FY 2023-24',
      'Show Cause Notice for ITC Discrepancy',
      'Demand Notice for Short Payment',
      'Tax Query on Input Tax Credit Claims',
      'Department Notice for Filing Delay',
      'GST Audit Intimation Notice',
      'Scrutiny Notice for GSTR-1 Data',
      'Assessment Order for FY 2022-23',
    ]

    for (const client of clients) {
      const noticeCount = rand(1, 3)
      for (let i = 0; i < noticeCount; i++) {
        const status = pick(['open', 'in_progress', 'resolved'])
        await db.notice.create({
          data: {
            clientId: client.id,
            noticeType: pick(noticeTypes),
            noticeNumber: `GST/NOT/${rand(100000, 999999)}`,
            noticeDate: `2025-${String(rand(1, 6)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
            subject: pick(noticeSubjects),
            description: `Notice received from GST department regarding compliance for client ${client.tradeName}. Immediate attention required.`,
            status,
            assignedTo: pick(teamMembers.filter(m => m.isActive)).id,
            priority: pick(priorities),
            dueDate: `2025-${String(rand(4, 9)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
            resolution: status === 'resolved' ? 'Resolved with supporting documentation provided to the department.' : null,
          },
        })
        totalNotices++
      }
    }

    // 16. Create Documents
    let totalDocuments = 0
    const folders = ['invoices', 'returns', 'reports', 'client-documents', 'notices']
    const fileTypes = ['pdf', 'xlsx', 'docx', 'jpg', 'png']
    const docNames = [
      'GSTR-1 Return Summary', 'Purchase Register', 'Sales Invoice Batch',
      'ITC Reconciliation Report', 'Tax Computation Sheet', 'Client KYC Documents',
      'GST Assessment Order', 'Annual Return GSTR-9', 'Audit Report FY2025',
      'Input Tax Credit Register', 'GST Payment Challan', 'E-Way Bill Report',
    ]

    for (const client of clients) {
      const docCount = rand(3, 6)
      for (let i = 0; i < docCount; i++) {
        await db.document.create({
          data: {
            clientId: client.id,
            folder: pick(folders),
            name: `${pick(docNames)} - ${client.tradeName.slice(0, 15)}`,
            fileType: pick(fileTypes),
            size: rand(50000, 5000000),
            tags: pick(['gst', 'filing', 'compliance', 'audit', 'invoice', 'return']),
            description: `Document for ${client.tradeName}`,
            uploadedBy: pick(teamMembers).name,
            version: 1,
            isLatest: true,
          },
        })
        totalDocuments++
      }
    }

    // 17. Create Automation Rules
    const automationRules = await Promise.all([
      db.automationRule.create({
        data: {
          name: 'Invoice Auto-Extract',
          description: 'Automatically extract invoice data when a new invoice is uploaded',
          trigger: 'invoice_uploaded',
          conditions: JSON.stringify({ fileType: 'pdf', source: 'email' }),
          actions: JSON.stringify({ extract: true, notify: 'manager', createTask: true }),
          isActive: true,
          runCount: rand(50, 200),
          lastRunAt: new Date(2025, rand(3, 5), rand(1, 28)),
          createdBy: teamMembers[0].id,
        },
      }),
      db.automationRule.create({
        data: {
          name: 'Return Filing Notification',
          description: 'Notify manager when a return is ready for filing',
          trigger: 'return_ready',
          conditions: JSON.stringify({ status: 'validated', criticalErrors: 0 }),
          actions: JSON.stringify({ notify: 'manager', createTask: true, sendEmail: true }),
          isActive: true,
          runCount: rand(20, 80),
          lastRunAt: new Date(2025, rand(3, 5), rand(1, 28)),
          createdBy: teamMembers[0].id,
        },
      }),
      db.automationRule.create({
        data: {
          name: 'Client Filing Confirmation',
          description: 'Send confirmation email to client when return is filed',
          trigger: 'return_filed',
          conditions: JSON.stringify({ returnType: 'GSTR-1' }),
          actions: JSON.stringify({ sendEmail: true, notify: 'client', updateStatus: true }),
          isActive: true,
          runCount: rand(30, 100),
          lastRunAt: new Date(2025, rand(3, 5), rand(1, 28)),
          createdBy: teamMembers[0].id,
        },
      }),
      db.automationRule.create({
        data: {
          name: 'Notice Alert Task',
          description: 'Create urgent task when a GST notice is received',
          trigger: 'notice_received',
          conditions: JSON.stringify({ priority: ['high', 'urgent'] }),
          actions: JSON.stringify({ createTask: true, notify: 'manager', assignTo: 'senior_auditor' }),
          isActive: true,
          runCount: rand(5, 25),
          lastRunAt: new Date(2025, rand(3, 5), rand(1, 28)),
          createdBy: teamMembers[0].id,
        },
      }),
      db.automationRule.create({
        data: {
          name: 'Weekly Compliance Report',
          description: 'Generate weekly compliance status report for all active clients',
          trigger: 'invoice_uploaded',
          conditions: JSON.stringify({ schedule: 'weekly', clientStatus: 'active' }),
          actions: JSON.stringify({ generateReport: true, sendEmail: true, notify: 'admin' }),
          isActive: false,
          runCount: rand(2, 10),
          createdBy: teamMembers[0].id,
        },
      }),
    ])

    // 18. Create Automation Logs
    let totalAutomationLogs = 0
    for (const rule of automationRules) {
      const logCount = rand(3, 8)
      for (let i = 0; i < logCount; i++) {
        await db.automationLog.create({
          data: {
            ruleId: rule.id,
            trigger: rule.trigger,
            status: pick(['success', 'success', 'success', 'failed']),
            details: `Automated execution of "${rule.name}"`,
            executedAt: new Date(2025, rand(2, 5), rand(1, 28), rand(9, 18), rand(0, 59)),
          },
        })
        totalAutomationLogs++
      }
    }

    // 19. Create Firm Settings
    await db.firmSettings.create({
      data: {
        firmName: 'GSTPilot Associates',
        primaryColor: '#059669',
        accentColor: '#7c3aed',
        emailFromName: 'GSTPilot Associates',
      },
    })

    // 20. Create Firm Metrics (6 months)
    let totalFirmMetrics = 0
    for (let m = 1; m <= 6; m++) {
      const period = `2025-${String(m).padStart(2, '0')}`
      const totalRevenue = rand(300000, 800000)
      await db.firmMetrics.create({
        data: {
          period,
          totalRevenue,
          mrr: Math.round(totalRevenue * (0.6 + Math.random() * 0.3)),
          arr: Math.round(totalRevenue * 12 * (0.7 + Math.random() * 0.2)),
          clientsOnboarded: rand(1, 4),
          activeClients: clients.filter(c => c.status === 'active').length + rand(-2, 2),
          inactiveClients: clients.filter(c => c.status === 'inactive').length + rand(-1, 1),
          teamUtilization: rand(65, 92),
          avgProcessingTime: rand(2, 8),
          avgFilingTime: rand(1, 4),
          gstProcessed: rand(1000000, 8000000),
          profitability: rand(18, 38),
          clientGrowth: rand(-2, 8),
        },
      })
      totalFirmMetrics++
    }

    // ─── AI Tax Intelligence Layer Seed Data ───

    // 21. Create AI Predictions (CFO Dashboard)
    const predictionCategories = [
      { category: 'revenue', base: 1500000, variance: 300000 },
      { category: 'gst_liability', base: 450000, variance: 100000 },
      { category: 'collections', base: 1200000, variance: 200000 },
      { category: 'churn', base: 12, variance: 5 },
      { category: 'filing_load', base: 24, variance: 8 },
      { category: 'team_load', base: 78, variance: 12 },
    ]
    let totalPredictions = 0
    for (let m = 1; m <= 9; m++) {
      const period = m <= 6 ? `2025-${String(m).padStart(2, '0')}` : `2025-${String(m).padStart(2, '0')}`
      for (const cat of predictionCategories) {
        const predictedValue = cat.base + (Math.random() - 0.5) * cat.variance * 2
        const confidence = m <= 6 ? rand(85, 98) : Math.max(55, 95 - (m - 6) * 12)
        await db.aIPrediction.create({
          data: {
            category: cat.category,
            period,
            predictedValue: Math.round(predictedValue),
            confidence,
            lowerBound: Math.round(predictedValue * 0.88),
            upperBound: Math.round(predictedValue * 1.12),
            trend: m > 6 ? pick(['up', 'up', 'stable']) : pick(['up', 'down', 'stable']),
            modelVersion: 'v2',
            factors: JSON.stringify({ seasonality: rand(80, 100), trendStrength: rand(60, 95) }),
          },
        })
        totalPredictions++
      }
    }

    // 22. Create Risk Scores per client
    let totalRiskScores = 0
    for (const client of clients) {
      const lateFilings = client.healthScore < 60 ? rand(2, 5) : client.healthScore < 80 ? rand(0, 2) : 0
      const noticeFrequency = client.healthScore < 60 ? rand(2, 4) : client.healthScore < 80 ? rand(0, 2) : 0
      const gstMismatches = client.healthScore < 60 ? rand(3, 8) : client.healthScore < 80 ? rand(1, 3) : rand(0, 1)
      const vendorRisk = client.healthScore < 60 ? rand(40, 80) / 100 : rand(5, 30) / 100
      const itcRisk = client.healthScore < 60 ? rand(30, 70) / 100 : rand(5, 25) / 100
      const overallScore = Math.min(100, lateFilings * 20 + noticeFrequency * 15 + gstMismatches * 10)
      const riskLevel = overallScore <= 25 ? 'low' : overallScore <= 50 ? 'medium' : overallScore <= 75 ? 'high' : 'critical'

      await db.riskScore.create({
        data: {
          clientId: client.id,
          overallScore,
          category: 'overall',
          lateFilings,
          noticeFrequency,
          gstMismatches,
          vendorRisk,
          itcRisk,
          riskLevel,
          period: '2025-06',
          factors: JSON.stringify({ healthScore: client.healthScore, filingPattern: riskLevel === 'low' ? 'consistent' : 'irregular' }),
          recommendations: riskLevel === 'high' || riskLevel === 'critical'
            ? 'Immediate review required. Consider assigning senior auditor for compliance remediation.'
            : 'Monitor regularly. Schedule periodic compliance reviews.',
        },
      })
      totalRiskScores++
    }

    // 23. Create Compliance Forecasts
    let totalForecasts = 0
    for (const client of clients) {
      if (client.healthScore < 70) {
        await db.complianceForecast.create({
          data: {
            clientId: client.id,
            forecastType: 'notice',
            predictedEvent: `GST Notice expected for ${client.tradeName}`,
            probability: Math.round((100 - client.healthScore) * 0.8),
            confidence: rand(65, 85),
            expectedDate: '2025-08-15',
            impact: client.healthScore < 50 ? 'critical' : 'high',
            mitigatingActions: 'Proactive filing compliance review and ITC verification recommended.',
            period: '2025-06',
          },
        })
        totalForecasts++
      }
      if (client.healthScore < 80) {
        await db.complianceForecast.create({
          data: {
            clientId: client.id,
            forecastType: 'filing_delay',
            predictedEvent: `Filing delay expected for ${client.tradeName}`,
            probability: Math.round((100 - client.healthScore) * 0.6),
            confidence: rand(60, 80),
            expectedDate: '2025-07-20',
            impact: client.healthScore < 60 ? 'high' : 'medium',
            mitigatingActions: 'Pre-filing preparation and early data collection recommended.',
            period: '2025-06',
          },
        })
        totalForecasts++
      }
      await db.complianceForecast.create({
        data: {
          clientId: client.id,
          forecastType: 'reconciliation_issue',
          predictedEvent: `Reconciliation discrepancies for ${client.tradeName}`,
          probability: rand(20, 60),
          confidence: rand(55, 80),
          impact: 'medium',
          mitigatingActions: 'Regular reconciliation runs and vendor communication.',
          period: '2025-06',
        },
      })
      totalForecasts++

      if (client.healthScore < 65) {
        await db.complianceForecast.create({
          data: {
            clientId: client.id,
            forecastType: 'itc_loss',
            predictedEvent: `Potential ITC loss for ${client.tradeName}`,
            probability: Math.round((100 - client.healthScore) * 0.5),
            confidence: rand(55, 75),
            expectedDate: '2025-09-30',
            impact: 'high',
            mitigatingActions: 'ITC reconciliation and vendor compliance verification recommended.',
            period: '2025-06',
          },
        })
        totalForecasts++
      }
    }

    // 24. Create Client Insights
    let totalInsights = 0
    const insightCategories = ['growth', 'compliance', 'risk', 'gst', 'payment']
    const insightTrends = ['improving', 'declining', 'stable']
    for (const client of clients) {
      for (const cat of insightCategories) {
        const trend = cat === 'compliance' ? (client.healthScore > 80 ? 'improving' : client.healthScore > 60 ? 'stable' : 'declining')
          : cat === 'risk' ? (client.healthScore > 80 ? 'stable' : client.healthScore > 60 ? 'improving' : 'declining')
          : pick(insightTrends)
        const observations: Record<string, string> = {
          growth: trend === 'improving' ? `${client.tradeName} shows positive growth trajectory with increasing transaction volume.` : trend === 'declining' ? `${client.tradeName} transaction volume has decreased over the last quarter.` : `${client.tradeName} maintains steady business volume.`,
          compliance: trend === 'improving' ? `Compliance score improved to ${client.healthScore}%. Filing patterns are becoming more consistent.` : trend === 'declining' ? `Client compliance score dropped ${rand(5, 15)}% in the last quarter. Immediate attention needed.` : `Compliance score stable at ${client.healthScore}%. Regular monitoring recommended.`,
          risk: trend === 'improving' ? 'Risk profile improving with reduced mismatches and timely filings.' : trend === 'declining' ? 'Risk profile deteriorating with increasing notice frequency and filing delays.' : 'Risk profile stable. Continue standard monitoring protocols.',
          gst: trend === 'improving' ? 'GST liability management improving with better ITC utilization.' : trend === 'declining' ? 'GST liability trending upward. Consider ITC optimization review.' : 'GST liability patterns remain consistent with business volume.',
          payment: trend === 'improving' ? 'Payment and collection patterns improving with faster settlement cycles.' : trend === 'declining' ? 'Payment delays increasing. Consider proactive collection follow-up.' : 'Payment patterns stable and within expected ranges.',
        }
        await db.clientInsight.create({
          data: {
            clientId: client.id,
            category: cat,
            trend,
            observation: observations[cat],
            confidence: rand(65, 95) / 100,
            dataPoints: JSON.stringify({ healthScore: client.healthScore, period: '2025-Q2' }),
            period: '2025-06',
          },
        })
        totalInsights++
      }
    }

    // 25. Create Knowledge Entries
    const knowledgeEntries = [
      { title: 'GST Section 16 - Input Tax Credit Eligibility', category: 'rule', content: 'Every registered person shall be entitled to take credit of input tax on any supply of goods or services to him which are used or intended to be used in the course or furtherance of business, subject to conditions prescribed.', source: 'CGST Act 2017', referenceNumber: 'Sec 16', tags: 'itc,eligibility,input tax credit' },
      { title: 'GSTR-1 Filing Due Date Extension - Q1 2025', category: 'circular', content: 'CBIC has extended the due date for filing GSTR-1 for the quarter ending March 2025. Taxpayers are advised to file returns at the earliest to avoid penalties.', source: 'CBIC Circular 208/2025', referenceNumber: 'CBIC/208/2025', tags: 'gstr1,due date,extension,q1 2025' },
      { title: 'E-Way Bill Validity Extension Notification', category: 'notification', content: 'The validity period of e-way bills has been extended from 1 day per 200 km to 1 day per 200 km for ordinary vehicles and 1 day per 300 km for over-dimensional cargo vehicles.', source: 'Notification 12/2025', referenceNumber: 'Notif 12/2025', tags: 'eway bill,validity,transport' },
      { title: 'Supreme Court Ruling on GST Refund Claims', category: 'case_law', content: 'The Supreme Court held that the limitation period for filing refund claims under GST is governed by Section 54 of the CGST Act and not by the general limitation act. Refund claims must be filed within 2 years from the relevant date.', source: 'Supreme Court of India', referenceNumber: 'SC/2025/GST/142', tags: 'refund,supreme court,limitation,gst' },
      { title: 'New GST Rate for Online Gaming - 28%', category: 'department_update', content: 'GST Council has approved 28% GST on online gaming, casinos, and horse racing. The new rate is applicable from October 2023. All online gaming platforms must comply with the revised rate structure.', source: 'GST Council Meeting 51', referenceNumber: 'GCM/51/2023', tags: 'online gaming,gst rate,28%,casino' },
      { title: 'GSTR-3B Auto-Population from GSTR-1', category: 'rule', content: 'From January 2025, GSTR-3B will be auto-populated based on GSTR-1 data filed by the taxpayer. Taxpayers need to verify and can edit the auto-populated data before filing.', source: 'CGST Act 2017', referenceNumber: 'Sec 39', tags: 'gstr3b,autopopulation,gstr1,filing' },
      { title: 'ITC Reversal for Exempt Supplies - Rule 42', category: 'rule', content: 'Input tax credit attributable to exempt supplies must be reversed proportionately. The formula under Rule 42 of CGST Rules prescribes the method for computing the amount of ITC to be reversed.', source: 'CGST Rules 2017', referenceNumber: 'Rule 42', tags: 'itc,reversal,exempt supplies,rule 42' },
      { title: 'Annual Return Filing Requirement - GSTR-9', category: 'circular', content: 'All registered taxpayers with turnover exceeding Rs 2 crore must file GSTR-9 (Annual Return) for each financial year. The due date is December 31 of the year following the financial year.', source: 'CBIC Circular 205/2025', referenceNumber: 'CBIC/205/2025', tags: 'gstr9,annual return,filing requirement' },
    ]
    let totalKnowledge = 0
    for (const entry of knowledgeEntries) {
      await db.knowledgeEntry.create({
        data: {
          title: entry.title,
          category: entry.category,
          content: entry.content,
          summary: entry.content.slice(0, 120) + '...',
          tags: entry.tags,
          source: entry.source,
          referenceNumber: entry.referenceNumber,
          effectiveDate: '2025-01-01',
          relevanceScore: rand(70, 100) / 100,
        },
      })
      totalKnowledge++
    }

    // 26. Create Executive Reports
    const reportTypes = ['client_health', 'gst_risk', 'compliance', 'firm_performance', 'board']
    const reportTitles = ['Client Health Report Q2 2025', 'GST Risk Assessment Report', 'Compliance Summary Report', 'Firm Performance Report Q2', 'Board Report - Q2 2025']
    let totalReports = 0
    for (let i = 0; i < reportTypes.length; i++) {
      await db.executiveReport.create({
        data: {
          reportType: reportTypes[i],
          title: reportTitles[i],
          description: `Comprehensive ${reportTypes[i].replace(/_/g, ' ')} report for Q2 2025`,
          period: '2025-Q2',
          data: JSON.stringify({ generated: true, period: '2025-Q2' }),
          format: pick(['pdf', 'excel']),
          status: 'generated',
          generatedBy: teamMembers[0].id,
        },
      })
      totalReports++
    }

    // 27. Create Client Benchmarks
    let totalBenchmarks = 0
    const benchmarkMetrics = ['compliance_score', 'filing_timeliness', 'gst_volume', 'risk_score']
    for (const client of clients) {
      for (const metric of benchmarkMetrics) {
        const clientValue = metric === 'compliance_score' ? client.healthScore
          : metric === 'filing_timeliness' ? rand(60, 100)
          : metric === 'gst_volume' ? rand(40, 95)
          : 100 - client.healthScore
        const industryAvg = clientValue + (Math.random() - 0.5) * 20
        const stateAvg = clientValue + (Math.random() - 0.5) * 15
        const firmAvg = clients.reduce((sum, c) => sum + (metric === 'compliance_score' ? c.healthScore : metric === 'risk_score' ? 100 - c.healthScore : rand(50, 90)), 0) / clients.length

        await db.clientBenchmark.create({
          data: {
            clientId: client.id,
            metric,
            clientValue: Math.round(clientValue),
            industryAverage: Math.round(industryAvg),
            stateAverage: Math.round(stateAvg),
            firmAverage: Math.round(firmAvg),
            industryPercentile: Math.round(rand(20, 95)),
            statePercentile: Math.round(rand(25, 90)),
            firmPercentile: Math.round(rand(15, 85)),
            period: '2025-Q2',
          },
        })
        totalBenchmarks++
      }
    }

    // ─── Summary ────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully with AI Tax Intelligence data',
      counts: {
        users: users.length,
        clients: clients.length,
        invoices: allInvoices.length,
        gstrFilings: allFilings.length,
        filingEvents: totalFilingEvents,
        reconciliationRuns: allRuns.length,
        reconciliationResults: totalReconciliations,
        issues: totalIssues,
        healthScores: totalHealthScores,
        auditLogs: totalAuditLogs,
        teamMembers: teamMembers.length,
        performanceRecords: totalPerformanceRecords,
        assignments: totalAssignments,
        notices: totalNotices,
        documents: totalDocuments,
        automationRules: automationRules.length,
        automationLogs: totalAutomationLogs,
        firmMetrics: totalFirmMetrics,
        predictions: totalPredictions,
        riskScores: totalRiskScores,
        forecasts: totalForecasts,
        insights: totalInsights,
        knowledgeEntries: totalKnowledge,
        reports: totalReports,
        benchmarks: totalBenchmarks,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
