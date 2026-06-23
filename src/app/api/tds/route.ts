import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedTDSRecords, calculateTDS, quarterForDate } from '@/lib/invoices/tds'

// GET /api/tds — Fetch all TDS records
export async function GET() {
  try {
    const records = await db.tDSRecord.findMany({
      orderBy: { date: 'desc' },
    })

    if (!records || records.length === 0) {
      return NextResponse.json({ records: seedTDSRecords() })
    }

    return NextResponse.json({ records })
  } catch (error) {
    console.error('GET /api/tds error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch TDS records' },
      { status: 500 }
    )
  }
}

// POST /api/tds — Record a new TDS deduction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clientId,
      section,
      deducteeName,
      deducteePan,
      paymentAmount,
      date,
      notes,
    } = body ?? {}

    if (!section || !deducteeName || paymentAmount === undefined || !date) {
      return NextResponse.json(
        { error: 'section, deducteeName, paymentAmount and date are required' },
        { status: 400 }
      )
    }

    const { rate, tdsAmount } = calculateTDS(Number(paymentAmount), String(section))
    const quarter = quarterForDate(date)

    const record = await db.tDSRecord.create({
      data: {
        clientId: clientId ?? null,
        section: String(section),
        deducteeName,
        deducteePan: deducteePan ?? null,
        paymentAmount: Number(paymentAmount) || 0,
        tdsRate: rate,
        tdsAmount,
        date,
        status: 'deducted',
        quarter,
        notes: notes ?? null,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        action: 'TDS Recorded',
        entity: 'tds_record',
        entityId: record.id,
        details: `TDS ₹${tdsAmount} (${rate}%) under ${section} — ${deducteeName}`,
      },
    })

    return NextResponse.json({ record }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tds error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record TDS' },
      { status: 500 }
    )
  }
}
