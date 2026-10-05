import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session'

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-tenant scoping — P3-AUTH-FIX
//
// `/api/export` historically had NO auth at all. The `report` branch ran
// `db.client.count()` with NO filter → returned ALL clients platform-wide in
// the export summary. The `csv` branch filtered by `clientId` from the body —
// anyone knowing a clientId could export any org's invoices. The `json`
// branch fetched the filing via `findUnique` with no org filter.
//
// Fix: requireAuth → resolve tenantId from header/body → requireOrgMembership
// → scope every query via `client: { firmId: tenantId }` (or `firmId: tenantId`
// for Client itself). Resource-level checks (filing lookups) use findFirst
// with the tenant filter so a foreign filingId returns 404 — never reveals
// existence. Mirrors /api/invoices + /api/returns patterns.
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/export — Generate export (JSON / CSV / Report)
export async function POST(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const body = await request.json()
    const { type, filingId, clientId } = body

    if (!type || !['json', 'csv', 'report'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "json", "csv", or "report"' },
        { status: 400 }
      )
    }

    // ── 2. AUTHORIZATION — resolve tenantId, verify membership ─────────────
    // Priority: x-gstpilot-orgid header → body.organizationId → body.firmId.
    // If clientId is provided but no tenantId, resolve via Client.firmId.
    const headerOrgId = request.headers.get('x-gstpilot-orgid')
    let tenantId: string | null =
      (typeof headerOrgId === 'string' && headerOrgId.trim()) ||
      (typeof body.organizationId === 'string' && body.organizationId.trim()) ||
      (typeof body.firmId === 'string' && body.firmId.trim()) ||
      null

    if (!tenantId && clientId) {
      try {
        const client = await db.client.findUnique({
          where: { id: clientId },
          select: { firmId: true },
        })
        if (client?.firmId) tenantId = client.firmId
      } catch {
        /* ignore — best-effort */
      }
    }

    if (!tenantId) {
      // No tenant scope → no data. For json/csv branches, return 400 because
      // they cannot be meaningfully scoped; for report, return empty summary.
      if (type === 'report') {
        return NextResponse.json({
          generatedAt: new Date().toISOString(),
          summary: {
            totalClients: 0,
            totalInvoices: 0,
            filedReturns: 0,
            pendingReturns: 0,
            averageHealthScore: 0,
            criticalIssues: 0,
            warnings: 0,
            totalTaxableValue: 0,
            totalTax: 0,
          },
          clients: [],
          filings: [],
        })
      }
      return NextResponse.json(
        { error: 'organizationId (or firmId) is required for export' },
        { status: 400 }
      )
    }
    const memberResult = await requireOrgMembership(uid, tenantId)
    if (memberResult instanceof NextResponse) return memberResult

    // ── JSON Export: GSTR-1 JSON structure ──────────────────────────────────
    if (type === 'json') {
      if (!filingId) {
        return NextResponse.json(
          { error: 'filingId is required for JSON export' },
          { status: 400 }
        )
      }

      // Fetch filing scoped by the caller's tenant via the client relation.
      // findFirst (not findUnique) so a foreign filingId returns 404 — never
      // reveals existence.
      const filing = await db.gSTRFiling.findFirst({
        where: { id: filingId, client: { firmId: tenantId } },
        include: { client: true },
      })
      if (!filing) {
        return NextResponse.json({ error: 'Filing not found' }, { status: 404 })
      }

      // Fetch invoices for this filing's client and period (already verified
      // to belong to the tenant via the filing lookup above).
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
      // Always scope by the caller's tenant via the client relation.
      const where: Record<string, unknown> = { client: { firmId: tenantId } }
      if (clientId) where.clientId = clientId
      if (filingId) {
        // Resolve the filing's clientId+period; scope by tenant too so a foreign
        // filingId returns an empty result set (no leak).
        const filing = await db.gSTRFiling.findFirst({
          where: { id: filingId, client: { firmId: tenantId } },
        })
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
      // CRITICAL FIX: every query is now scoped by the caller's tenant.
      // Previously `db.client.count()` had NO filter → returned ALL clients
      // platform-wide in the export summary.
      const clientWhere: Record<string, unknown> = { firmId: tenantId }
      if (clientId) clientWhere.id = clientId
      // Invoice / GSTRFiling / Issue scope through client.firmId (no direct
      // firmId on those models — mirrors /api/invoices + /api/returns).
      const invoiceWhere: Record<string, unknown> = { client: { firmId: tenantId } }
      if (clientId) invoiceWhere.clientId = clientId
      const filingWhere: Record<string, unknown> = { client: { firmId: tenantId } }
      if (clientId) filingWhere.clientId = clientId
      const issueWhere: Record<string, unknown> = { client: { firmId: tenantId } }
      if (clientId) issueWhere.clientId = clientId

      const [
        totalClients,
        totalInvoices,
        clientData,
        filingData,
        issueData,
      ] = await Promise.all([
        db.client.count({ where: clientWhere }),
        db.invoice.count({ where: invoiceWhere }),
        db.client.findMany({
          where: clientWhere,
          select: {
            id: true,
            tradeName: true,
            gstin: true,
            healthScore: true,
            _count: { select: { invoices: true, gstrFilings: true } },
          },
        }),
        db.gSTRFiling.findMany({
          where: filingWhere,
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
          where: issueWhere,
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
          clientId: clientId ?? null,
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
    return friendlyApiError(error, 'We could not generate the export right now. Please try again.')
  }
}
