import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { graphEvents } from '@/lib/graph/live-update'
import { getGSTProvider } from '@/lib/gstn-provider/server/registry'

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gstr-filing/[id]/file — File a GST return with GSTN
//
// CRITICAL: This route MUST NEVER fake an ARN (acknowledgment number).
// GSTPilot never simulates successful government filings.
//
// Filing flow:
//   1. Fetch the filing from Prisma
//   2. Resolve the active GSTN provider
//   3. If mock provider: return 400 "Cannot file in mock mode"
//   4. If official provider: call provider.fileReturn() → real ARN
//   5. Only mark as "filed" if a real ARN is returned
//
// Status transitions:
//   draft → prepared → validated → reviewed → submitted (awaiting GSTN ack)
//   submitted → filed (only when real ARN received from GSTN)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    void request // body not used — filing payload comes from the DB record

    // Fetch the filing
    const filing = await db.gSTRFiling.findUnique({
      where: { id },
      include: { client: true },
    })

    if (!filing) {
      return NextResponse.json(
        { error: 'Filing not found' },
        { status: 404 }
      )
    }

    if (filing.status === 'filed') {
      return NextResponse.json(
        { error: 'This filing has already been filed', filing },
        { status: 409 }
      )
    }

    // ── Step 1: Resolve the active GSTN provider ──────────────────────────
    const provider = getGSTProvider()

    // ── Step 2: Enforce — sandbox provider cannot file ────────────────────
    // The sandbox provider can simulate read-only sync operations (returns,
    // notices, ledgers) but CANNOT file returns. Filing requires the official
    // GSTN API with real credentials. We never fake a successful filing.
    if (!provider.isLive) {
      return NextResponse.json(
        {
          error:
            'Live GSTN integration required to file. Your return has been prepared and validated — ' +
            'to file directly with the GST portal, configure GSTN API credentials ' +
            '(GSTN_CLIENT_ID, GSTN_CLIENT_SECRET, GSTN_PROVIDER=official). ' +
            'GSTPilot never simulates successful government filings.',
          code: 'MOCK_PROVIDER_CANNOT_FILE',
          provider: provider.name,
        },
        { status: 400 }
      )
    }

    // ── Step 3: Attempt to file with the official GSTN provider ──────────
    // The provider.fileReturn() method will either:
    //   a) Return a real ARN → we mark as "filed"
    //   b) Throw NotImplementedError → we return a clear error (501)
    //   c) Throw a GSTN error → we return the error (502)
    //
    // We do NOT mark the return as filed unless we have a real ARN.
    const previousStatus = filing.status

    try {
      // The official provider currently throws NotImplementedError.
      // When implemented, this call will make a real HTTP request to GSTN
      // and return { arn, acknowledgedAt, status }.
      const result = await provider.fileReturn(
        // The session would be decrypted here using the server-only master key.
        // The official provider throws before using it (NotImplementedError).
        { authToken: '', gstin: '', username: '', expiresAt: '' },
        {
          returnType: filing.returnType as 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B' | 'GSTR-9' | 'GSTR-9C',
          financialYear: filing.period ?? '',
          period: filing.period ?? '',
          payload: {},
        }
      )

      // ── Step 4: Real ARN received — mark as "filed" ───────────────────
      const filedDate = new Date().toISOString().split('T')[0]

      const updatedFiling = await db.gSTRFiling.update({
        where: { id },
        data: {
          status: 'filed',
          filedDate,
          acknowledgmentNumber: result.arn,
        },
        include: { client: true },
      })

      // Create FilingHistory record
      await db.filingHistory.create({
        data: {
          filingId: id,
          clientId: filing.clientId,
          previousStatus,
          newStatus: 'filed',
          acknowledgmentNumber: result.arn,
          notes: `Filed via GSTN on ${filedDate}. ARN: ${result.arn}`,
        },
      })

      // Create FilingEvent
      await db.filingEvent.create({
        data: {
          filingId: id,
          clientId: filing.clientId,
          eventType: 'filed',
          description: `${filing.returnType} for period ${filing.period} filed successfully. ARN: ${result.arn}`,
          userId: null,
        },
      })

      // Create Notification
      await db.notification.create({
        data: {
          clientId: filing.clientId,
          type: 'success',
          category: 'filing',
          title: `${filing.returnType} Filed Successfully`,
          message: `${filing.returnType} for period ${filing.period} has been filed successfully for ${filing.client.tradeName}. Acknowledgment Number: ${result.arn}`,
          actionUrl: `/returns?id=${id}`,
          priority: 'medium',
          isRead: false,
          dismissed: false,
        },
      })

      // Create AuditLog
      await db.auditLog.create({
        data: {
          clientId: filing.clientId,
          action: 'Return Filed',
          entity: 'gstr_filing',
          entityId: id,
          oldValue: previousStatus,
          newValue: 'filed',
          details: `${filing.returnType} for period ${filing.period} filed for ${filing.client.tradeName}. ARN: ${result.arn}`,
        },
      })

      // Real Business Graph Engine™ — auto-create/refresh nodes + live event
      graphEvents.gstFiled(updatedFiling.id, filing.returnType, filing.period, filing.totalTax ?? 0)

      return NextResponse.json({
        filing: updatedFiling,
        acknowledgmentNumber: result.arn,
        acknowledgedAt: result.acknowledgedAt,
      })
    } catch (fileError) {
      // The provider threw — the filing did NOT succeed.
      // We do NOT mark the return as filed. We return the error.
      const errorMsg = fileError instanceof Error ? fileError.message : 'Filing failed'
      const isNotImplemented = errorMsg.includes('NotImplemented') || errorMsg.includes('not yet implemented')

      return NextResponse.json(
        {
          error: isNotImplemented
            ? 'GSTN filing is not yet configured. The official GSTN provider requires API credentials (GSTN_CLIENT_ID, GSTN_CLIENT_SECRET). Contact your administrator to configure GSTN integration. GSTPilot never simulates successful government filings.'
            : `GSTN filing failed: ${errorMsg}`,
          code: isNotImplemented ? 'NOT_IMPLEMENTED' : 'FILING_FAILED',
          provider: provider.name,
        },
        { status: isNotImplemented ? 501 : 502 }
      )
    }
  } catch (error) {
    console.error('POST /api/gstr-filing/[id]/file error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to file return' },
      { status: 500 }
    )
  }
}
