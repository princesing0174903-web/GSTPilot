// ═══════════════════════════════════════════════════════════════════════════════
// /api/memory/financial — Financial Metric CRUD
//
//   POST   { email, metricType, period?, value, trend?, annotation? }  → create
//   DELETE ?id=...&email=...                                              → delete
//   PATCH  { id, email }                                                  → toggle pin
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  addFinancialMetric,
  deleteFinancialMetric,
  togglePinFinancialMetric,
} from '@/lib/business-memory'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, metricType, period, value, trend, annotation } = body

    if (!email || !metricType || value === undefined) {
      return NextResponse.json(
        { error: 'email, metricType, and value are required' },
        { status: 400 },
      )
    }

    const metric = await addFinancialMetric(email, {
      metricType,
      period,
      value: Number(value),
      trend,
      annotation,
    })
    return NextResponse.json({ metric })
  } catch (error) {
    console.error('[/api/memory/financial] POST failed:', error)
    return NextResponse.json({ error: 'Failed to add metric' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const email = url.searchParams.get('email')

    if (!id || !email) {
      return NextResponse.json({ error: 'id and email are required' }, { status: 400 })
    }

    await deleteFinancialMetric(id, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/financial] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete metric' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, email } = body

    if (!id || !email) {
      return NextResponse.json({ error: 'id and email are required' }, { status: 400 })
    }

    await togglePinFinancialMetric(id, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/financial] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to toggle pin' }, { status: 500 })
  }
}
