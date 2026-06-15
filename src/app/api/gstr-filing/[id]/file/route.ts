import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Generate ARN: "AA" + date digits + random 6 digits (acceptable for simulated filing)
function generateARN(): string {
  const now = new Date()
  const dateDigits =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  // Use Math.random for the 6-digit suffix — acceptable per spec for simulated filing
  const randomDigits = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  return `AA${dateDigits}${randomDigits}`
}

// POST /api/gstr-filing/[id]/file — File a return (simulated)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Generate acknowledgment number (ARN)
    const acknowledgmentNumber = generateARN()
    const filedDate = new Date().toISOString().split('T')[0]
    const previousStatus = filing.status

    // Update filing: status="filed", filedDate=today, acknowledgmentNumber=ARN
    const updatedFiling = await db.gSTRFiling.update({
      where: { id },
      data: {
        status: 'filed',
        filedDate,
        acknowledgmentNumber,
      },
      include: { client: true },
    })

    // Create FilingHistory record with previousStatus, newStatus="filed"
    await db.filingHistory.create({
      data: {
        filingId: id,
        clientId: filing.clientId,
        previousStatus,
        newStatus: 'filed',
        acknowledgmentNumber,
        notes: `Filed via GSTPilot on ${filedDate}`,
      },
    })

    // Create FilingEvent with eventType="filed"
    await db.filingEvent.create({
      data: {
        filingId: id,
        clientId: filing.clientId,
        eventType: 'filed',
        description: `${filing.returnType} for period ${filing.period} filed successfully. ARN: ${acknowledgmentNumber}`,
        userId: null,
      },
    })

    // Create Notification for the client
    await db.notification.create({
      data: {
        clientId: filing.clientId,
        type: 'success',
        category: 'filing',
        title: `${filing.returnType} Filed Successfully`,
        message: `${filing.returnType} for period ${filing.period} has been filed successfully for ${filing.client.tradeName}. Acknowledgment Number: ${acknowledgmentNumber}`,
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
        details: `${filing.returnType} for period ${filing.period} filed for ${filing.client.tradeName}. ARN: ${acknowledgmentNumber}`,
      },
    })

    return NextResponse.json({
      filing: updatedFiling,
      acknowledgmentNumber,
    })
  } catch (error) {
    console.error('POST /api/gstr-filing/[id]/file error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to file return' },
      { status: 500 }
    )
  }
}
