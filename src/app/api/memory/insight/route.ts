// ═══════════════════════════════════════════════════════════════════════════════
// /api/memory/insight — Oracle Insight CRUD
//
//   POST   { email, category, content }  → create insight
//   DELETE ?id=...&email=...              → delete insight
//   PATCH  { id, email }                  → toggle pin
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  addInsight,
  deleteInsight,
  togglePinInsight,
} from '@/lib/business-memory'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, category, content } = body

    if (!email || !category || !content) {
      return NextResponse.json(
        { error: 'email, category, and content are required' },
        { status: 400 },
      )
    }

    const insight = await addInsight(email, { category, content })
    return NextResponse.json({ insight })
  } catch (error) {
    console.error('[/api/memory/insight] POST failed:', error)
    return NextResponse.json({ error: 'Failed to add insight' }, { status: 500 })
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

    await deleteInsight(id, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/insight] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete insight' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, email } = body

    if (!id || !email) {
      return NextResponse.json({ error: 'id and email are required' }, { status: 400 })
    }

    await togglePinInsight(id, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/insight] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to toggle pin' }, { status: 500 })
  }
}
