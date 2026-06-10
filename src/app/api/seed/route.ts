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
        tradeName: 'Tata Consultancy Services Ltd',
        gstin: '27AABCT1332L1ZP',
        address: 'TCS House, Raveline Street, Fort',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'gst@tcs.com',
        contactPhone: '+91-22-67789999',
        legalName: 'Tata Consultancy Services Limited',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 92,
      },
      {
        tradeName: 'Infosys Limited',
        gstin: '29AABCI6228L1Z5',
        address: '44, Electronics City, Hosur Road',
        state: 'Karnataka',
        stateCode: '29',
        contactEmail: 'gst@infosys.com',
        contactPhone: '+91-80-28520358',
        legalName: 'Infosys Limited',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 88,
      },
      {
        tradeName: 'Reliance Industries Ltd',
        gstin: '27AABCR5638L1Z1',
        address: 'Maker Chambers IV, Nariman Point',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'gst@ril.com',
        contactPhone: '+91-22-22785000',
        legalName: 'Reliance Industries Limited',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 75,
      },
      {
        tradeName: 'Wipro Technologies',
        gstin: '29AABCW5982L1Z3',
        address: 'Doddakannelli, Sarjapur Road',
        state: 'Karnataka',
        stateCode: '29',
        contactEmail: 'gst@wipro.com',
        contactPhone: '+91-80-28440011',
        legalName: 'Wipro Limited',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 68,
      },
      {
        tradeName: 'Mahindra & Mahindra Ltd',
        gstin: '27AABCM5638L1Z9',
        address: 'Mahindra Towers, Worli',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'gst@mahindra.com',
        contactPhone: '+91-22-24901341',
        legalName: 'Mahindra & Mahindra Limited',
        entityType: 'regular',
        returnPeriod: 'quarterly',
        status: 'inactive',
        healthScore: 52,
      },
      {
        tradeName: 'Bajaj Finserv Ltd',
        gstin: '27AABCB4298L1Z7',
        address: 'Bajaj Finserv Corporate Office, Pune-Satara Road',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'gst@bajajfinserv.in',
        contactPhone: '+91-20-67275555',
        legalName: 'Bajaj Finserv Limited',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 81,
      },
      {
        tradeName: 'HDFC Bank Limited',
        gstin: '27AABCH5682L1Z4',
        address: 'HDFC Bank House, Senapati Bapat Marg',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'gst@hdfcbank.com',
        contactPhone: '+91-22-26612300',
        legalName: 'HDFC Bank Limited',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
        healthScore: 95,
      },
      {
        tradeName: 'Larsen & Toubro Ltd',
        gstin: '27AABCL5298L1Z6',
        address: 'L&T House, Ballard Estate',
        state: 'Maharashtra',
        stateCode: '27',
        contactEmail: 'gst@lant.com',
        contactPhone: '+91-22-67659999',
        legalName: 'Larsen & Toubro Limited',
        entityType: 'regular',
        returnPeriod: 'monthly',
        status: 'active',
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
      'Tech Solutions Pvt Ltd',
      'Global Traders India',
      'Sunrise Industries Ltd',
      'Metro Distributors Pvt Ltd',
      'Southern Exports Ltd',
      'Pacific Solutions India',
      'Eastern Manufacturing Co',
      'Digital Services Pvt Ltd',
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
        const period = `2024-${String(month).padStart(2, '0')}`
        const invoiceDate = randomDate(2024, month, [1, 28])

        const taxableValue = rand(50000, 2500000)
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
            invoiceNumber: `INV/2024/${String(invIdx).padStart(3, '0')}`,
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
            hsnCode: pick(['998314', '998315', '998311', '8471', '8517', '7308', '8703', '9996']),
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
        const period = `2024-${String(periodMonth).padStart(2, '0')}`
        const key = `${returnType}-${period}`

        // avoid duplicates for same returnType+period on same client
        if (usedPeriods.has(key)) continue
        usedPeriods.add(key)

        const statusIdx = rand(0, filingStatuses.length - 1)
        const status = filingStatuses[statusIdx]
        const isFiled = status === 'filed'

        const totalTaxable = rand(500000, 15000000)
        const totalTax = Math.round(totalTaxable * 0.18)

        const filing = await db.gSTRFiling.create({
          data: {
            clientId: client.id,
            returnType,
            period,
            financialYear: '2024-25',
            status,
            filedDate: isFiled ? randomDate(2024, periodMonth > 1 ? periodMonth - 1 : 1, [1, 20]) : null,
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
              2024,
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
        const period = `2024-${String(month).padStart(2, '0')}`

        // Avoid duplicate periods for same client runs (allow some overlap for different sources)
        const runKey = `${period}-${i}`
        if (usedRunPeriods.has(runKey)) continue
        usedRunPeriods.add(runKey)

        const sources = runSources[i % runSources.length]
        const status = pick(runStatuses)

        const totalRecords = rand(20, 120)
        const matched = rand(Math.floor(totalRecords * 0.3), Math.floor(totalRecords * 0.7))
        const partialMatches = rand(Math.floor(totalRecords * 0.05), Math.floor(totalRecords * 0.2))
        const unmatched = totalRecords - matched - partialMatches
        const highRisk = rand(Math.floor(unmatched * 0.1), Math.floor(unmatched * 0.5))
        const gstDifference = rand(5000, 250000)

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
          resolvedAt: resolved ? randomDate(2024, rand(2, 6), [1, 28]) : null,
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
        const resolvedAt = issueStatus === 'resolved' ? randomDate(2024, rand(2, 6), [1, 28]) : null

        await db.issue.create({
          data: {
            clientId: client.id,
            invoiceId: clientInvoices.length > 0 ? pick(clientInvoices).id : null,
            filingId: clientFilings.length > 0 ? pick(clientFilings).id : null,
            severity,
            category,
            title,
            description: `${title} — detected during reconciliation for period 2024-${String(rand(1, 6)).padStart(2, '0')}. Requires review by the GST compliance team.`,
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
        const period = `2024-${String(month).padStart(2, '0')}`

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
          timestamp: new Date(2024, rand(0, 5), rand(1, 28), rand(9, 18), rand(0, 59)),
        },
      })
      totalAuditLogs++
    }

    // ─── Summary ────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully with GST data',
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
