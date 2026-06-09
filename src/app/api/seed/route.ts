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

    // 7. Create Reconciliation Results for some invoices
    const recMatchStatuses = ['perfect_match', 'partial_match', 'mismatch', 'missing_in_books', 'missing_in_gstr']
    let totalReconciliations = 0

    for (const invoice of allInvoices) {
      // Create reconciliation for roughly 60% of invoices
      if (Math.random() < 0.4) continue

      const matchScore =
        invoice.matchStatus === 'perfect_match' ? rand(90, 100) :
        invoice.matchStatus === 'partial_match' ? rand(50, 89) :
        invoice.matchStatus === 'mismatch' ? rand(10, 49) :
        rand(0, 30)

      const resolved = invoice.matchStatus === 'perfect_match' || (Math.random() < 0.3)
      const client = clients.find((c) => c.id === invoice.clientId)

      const mismatches = invoice.matchStatus === 'mismatch'
        ? JSON.stringify([{ field: 'taxableValue', books: invoice.taxableValue, gstr: invoice.taxableValue + rand(500, 5000) }])
        : invoice.matchStatus === 'partial_match'
        ? JSON.stringify([{ field: 'buyerGstin', books: invoice.buyerGstin, gstr: invoice.buyerGstin?.replace(/.$/, 'X') ?? null }])
        : null

      const aiRecExplanation =
        invoice.matchStatus === 'mismatch'
          ? `Reconciliation mismatch: Tax amount differs between books (₹${invoice.cgst + invoice.sgst + invoice.igst}) and GSTR-1. Recommend verifying tax rate applied.`
          : invoice.matchStatus === 'partial_match'
          ? `Partial reconciliation — buyer GSTIN mismatch detected. Verify recipient details before filing.`
          : undefined

      await db.reconciliationResult.create({
        data: {
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          sourceType: pick(['books', 'gstr1', 'gstr2a']),
          sourceGstin: client?.gstin ?? null,
          matchedGstin: invoice.buyerGstin,
          matchStatus: invoice.matchStatus === 'unmatched'
            ? pick(recMatchStatuses)
            : invoice.matchStatus as string,
          matchScore,
          mismatches,
          aiExplanation: aiRecExplanation,
          resolved,
          resolvedBy: resolved ? pick(users).id : null,
          resolvedAt: resolved ? randomDate(2024, rand(2, 6), [1, 28]) : null,
        },
      })
      totalReconciliations++
    }

    // 8. Create Issues for each client
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

    // 9. Create Health Score Records for each client
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

    // 10. Create Audit Log Entries
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
