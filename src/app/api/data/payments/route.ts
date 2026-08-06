import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/data/payments — read payments (bank/razorpay/upi/cash/manual/excel)
//
//   Query params:
//     ?clientId=...&source=...&direction=...(in/out)
//     ?limit=50&offset=0
//
//   Returns { payments: [], total: 0 } on empty DB. NO fake data.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId') ?? undefined
    const paymentMode = url.searchParams.get('source') ?? undefined
    const partyType = url.searchParams.get('direction') ?? undefined
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    // Map legacy query params to actual Payment model fields:
    //   ?source=...     → paymentMode (upi|bank|cash|cheque|card)
    //   ?direction=...  → partyType (customer|vendor) — 'in' = vendor, 'out' = customer
    const where: {
      clientId?: string
      paymentMode?: string
      partyType?: string
    } = {}
    if (clientId) where.clientId = clientId
    if (paymentMode) where.paymentMode = paymentMode
    if (partyType) {
      where.partyType = partyType === 'in' ? 'vendor' : partyType === 'out' ? 'customer' : partyType
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.payment.count({ where }),
    ])

    return NextResponse.json({ payments, total })
  } catch (error) {
    console.error('[/api/data/payments] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load payments.' },
      { status: 500 },
    )
  }
}
