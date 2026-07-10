import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/export — Generate export (JSON / CSV / Report)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, filingId, clientId } = body

    if (!type || !['json', 'csv', 'report'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "json", "csv", or "report"' },
        { status: 400 }
      )
    }

    // ── JSON Export: GSTR-1 JSON structure ──────────────────────────────────
    if (type === 'json') {
      if (!filingId) {
        return NextResponse.json(
          { error: 'filingId is required for JSON export' },
          { status: 400 }
        )
      }

      const filing = await db.gSTRFiling.findUnique({
        where: { id: filingId },
        include: { client: true },
      })
      if (!filing) {
        return NextResponse.json({ error: 'Filing not found' }, { status: 404 })
      }

      // Fetch invoices for this filing's client and period
      const invoices = await db.invoice.findMany({
        where: {
          clientId: filing.clientId,
          period: filing.period,
        },
      })

      // Build GSTR-1 JSON structure
      const b2b = invoices
        .filter((inv) => inv.gstr1Section === 'b2b')
        .reduce<Record<string, { ctin: string; inv: unknown[] }>>((acc, inv) => {
          const ctin = inv.buyerGstin ?? 'UNKNOWN'
          if (!acc[ctin]) acc[ctin] = { ctin, inv: [] }
          ;(acc[ctin] as { ctin: string; inv: unknown[] }).inv.push({
            inum: inv.invoiceNumber,
            idt: inv.invoiceDate,
            val: inv.totalAmount,
            pos: inv.sellerGstin.substring(0, 2),
            rchrg: inv.reverseCharge ? 'Y' : 'N',
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: inv.taxableValue,
                  camt: inv.cgst,
                  samt: inv.sgst,
                  iamt: inv.igst,
                  csamt: inv.cess,
                },
              },
            ],
          })
          return acc
        }, {})

      const b2cl = invoices
        .filter((inv) => inv.gstr1Section === 'b2cl')
        .map((inv) => ({
          inum: inv.invoiceNumber,
          idt: inv.invoiceDate,
          val: inv.totalAmount,
          pos: inv.sellerGstin.substring(0, 2),
          itms: [
            {
              num: 1,
              itm_det: {
                txval: inv.taxableValue,
                camt: inv.cgst,
                samt: inv.sgst,
                iamt: inv.igst,
                csamt: inv.cess,
              },
            },
          ],
        }))

      const b2cs = invoices
        .filter((inv) => inv.gstr1Section === 'b2cs')
        .map((inv) => ({
          sply_ty: 'INTRA',
          pos: inv.sellerGstin.substring(0, 2),
          txval: inv.taxableValue,
          camt: inv.cgst,
          samt: inv.sgst,
          iamt: inv.igst,
          csamt: inv.cess,
        }))

      const cdnr = invoices
        .filter((inv) => inv.gstr1Section === 'cdnr')
        .reduce<Record<string, { ctin: string; nt: unknown[] }>>((acc, inv) => {
          const ctin = inv.buyerGstin ?? 'UNKNOWN'
          if (!acc[ctin]) acc[ctin] = { ctin, nt: [] }
          ;(acc[ctin] as { ctin: string; nt: unknown[] }).nt.push({
            nt_num: inv.invoiceNumber,
            nt_dt: inv.invoiceDate,
            val: inv.totalAmount,
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: inv.taxableValue,
                  camt: inv.cgst,
                  samt: inv.sgst,
                  iamt: inv.igst,
                  csamt: inv.cess,
                },
              },
            ],
          })
          return acc
        }, {})

      const cdnur = invoices
        .filter((inv) => inv.gstr1Section === 'cdnur')
        .map((inv) => ({
          ur_typ: 'B2CL',
          nt_num: inv.invoiceNumber,
          nt_dt: inv.invoiceDate,
          val: inv.totalAmount,
          itms: [
            {
              num: 1,
              itm_det: {
                txval: inv.taxableValue,
                camt: inv.cgst,
                samt: inv.sgst,
                iamt: inv.igst,
                csamt: inv.cess,
              },
            },
          ],
        }))

      const exp = invoices
        .filter((inv) => inv.gstr1Section === 'exp')
        .map((inv) => ({
          exp_typ: inv.igst > 0 ? 'WPAY' : 'WOPAY',
          inv: [
            {
              inum: inv.invoiceNumber,
              idt: inv.invoiceDate,
              val: inv.totalAmount,
              itms: [
                {
                  num: 1,
                  itm_det: {
                    txval: inv.taxableValue,
                    iamt: inv.igst,
                    csamt: inv.cess,
                  },
                },
              ],
            },
          ],
        }))

      const gstr1Json = {
        gstr1: {
          gstin: filing.client.gstin,
          fp: filing.period,
          b2b: Object.values(b2b),
          b2cl,
          b2cs,
          cdnr: Object.values(cdnr),
          cdnur,
          exp,
        },
      }

      // Create audit log
      await db.auditLog.create({
        data: {
          clientId: filing.clientId,
          action: 'Report Exported',
          entity: 'filing',
          entityId: filingId,
          details: `GSTR-1 JSON exported for period ${filing.period}`,
        },
      })

      return NextResponse.json(gstr1Json)
    }

    // ── CSV Export ──────────────────────────────────────────────────────────
    if (type === 'csv') {
      const where: Record<string, unknown> = {}
      if (clientId) where.clientId = clientId
      if (filingId) {
        const filing = await db.gSTRFiling.findUnique({ where: { id: filingId } })
        if (filing) {
          where.clientId = filing.clientId
          where.period = filing.period
        }
      }

      const invoices = await db.invoice.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        include: {
          client: {
            select: { tradeName: true, gstin: true },
          },
        },
      })

      // Build CSV
      const headers = [
        'Invoice Number',
        'Invoice Date',
        'Seller GSTIN',
        'Buyer GSTIN',
        'Buyer Name',
        'Invoice Type',
        'GSTR1 Section',
        'Taxable Value',
        'CGST',
        'SGST',
        'IGST',
        'Cess',
        'Total Amount',
        'HSN Code',
        'Match Status',
        'Risk Level',
        'Client Name',
        'Period',
      ]

      const rows = invoices.map((inv) =>
        [
          inv.invoiceNumber,
          inv.invoiceDate,
          inv.sellerGstin,
          inv.buyerGstin ?? '',
          inv.buyerName ?? '',
          inv.invoiceType,
          inv.gstr1Section,
          inv.taxableValue.toString(),
          inv.cgst.toString(),
          inv.sgst.toString(),
          inv.igst.toString(),
          inv.cess.toString(),
          inv.totalAmount.toString(),
          inv.hsnCode ?? '',
          inv.matchStatus,
          inv.riskLevel,
          inv.client.tradeName,
          inv.period ?? '',
        ]
          .map((v) => `"${v.replace(/"/g, '""')}"`)
          .join(',')
      )

      const csv = [headers.join(','), ...rows].join('\n')

      // Create audit log
      await db.auditLog.create({
        data: {
          clientId: clientId ?? null,
          action: 'Report Exported',
          entity: 'invoice',
          details: `CSV export generated with ${invoices.length} invoices`,
        },
      })

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="gst-invoices.csv"',
        },
      })
    }

    // ── Report Export ───────────────────────────────────────────────────────
    if (type === 'report') {
      const clientFilter = clientId ?? undefined

      const [
        totalClients,
        totalInvoices,
        clientData,
        filingData,
        issueData,
      ] = await Promise.all([
        db.client.count(),
        db.invoice.count(clientFilter ? { where: { clientId: clientFilter } } : undefined),
        db.client.findMany({
          where: clientFilter ? { id: clientFilter } : undefined,
          select: {
            id: true,
            tradeName: true,
            gstin: true,
            healthScore: true,
            _count: { select: { invoices: true, gstrFilings: true } },
          },
        }),
        db.gSTRFiling.findMany({
          where: clientFilter ? { clientId: clientFilter } : undefined,
          select: {
            id: true,
            returnType: true,
            period: true,
            status: true,
            totalTaxableValue: true,
            totalTax: true,
            client: { select: { tradeName: true } },
          },
        }),
        db.issue.findMany({
          where: clientFilter ? { clientId: clientFilter } : undefined,
          select: {
            severity: true,
            status: true,
            category: true,
          },
        }),
      ])

      const filedReturns = filingData.filter((f) => f.status === 'filed').length
      const pendingReturns = filingData.filter((f) => f.status !== 'filed').length

      const criticalIssues = issueData.filter((i) => i.severity === 'critical' && i.status === 'open').length
      const warnings = issueData.filter((i) => i.severity === 'warning' && i.status === 'open').length

      const avgHealth =
        clientData.length > 0
          ? Math.round(clientData.reduce((sum, c) => sum + c.healthScore, 0) / clientData.length)
          : 0

      const totalTaxableValue = filingData.reduce((sum, f) => sum + f.totalTaxableValue, 0)
      const totalTax = filingData.reduce((sum, f) => sum + f.totalTax, 0)

      const report = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalClients,
          totalInvoices,
          filedReturns,
          pendingReturns,
          averageHealthScore: avgHealth,
          criticalIssues,
          warnings,
          totalTaxableValue,
          totalTax,
        },
        clients: clientData.map((c) => ({
          tradeName: c.tradeName,
          gstin: c.gstin,
          healthScore: c.healthScore,
          invoiceCount: c._count.invoices,
          filingCount: c._count.gstrFilings,
        })),
        filings: filingData.map((f) => ({
          clientName: f.client.tradeName,
          returnType: f.returnType,
          period: f.period,
          status: f.status,
          totalTaxableValue: f.totalTaxableValue,
          totalTax: f.totalTax,
        })),
      }

      // Create audit log
      await db.auditLog.create({
        data: {
          clientId: clientFilter ?? null,
          action: 'Report Exported',
          entity: 'report',
          details: `Summary report generated — ${totalClients} clients, ${totalInvoices} invoices`,
        },
      })

      return NextResponse.json(report)
    }

    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate export' },
      { status: 500 }
    )
  }
}
