// ═══════════════════════════════════════════════════════════════════════════════
// /api/memory/goal — Business Goal CRUD
//
//   POST   { email, type, target, period?, notes? }  → create goal
//   DELETE ?id=...&email=...                          → delete goal
//   PATCH  { id, email }                              → toggle pin
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  addGoal,
  deleteGoal,
  togglePinGoal,
} from '@/lib/business-memory'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, type, target, period, notes } = body

    if (!email || !type || !target) {
      return NextResponse.json(
        { error: 'email, type, and target are required' },
        { status: 400 },
      )
    }

    const goal = await addGoal(email, { type, target, period, notes })
    return NextResponse.json({ goal })
  } catch (error) {
    console.error('[/api/memory/goal] POST failed:', error)
    return NextResponse.json({ error: 'Failed to add goal' }, { status: 500 })
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

    await deleteGoal(id, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/goal] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, email } = body

    if (!id || !email) {
      return NextResponse.json({ error: 'id and email are required' }, { status: 400 })
    }

    await togglePinGoal(id, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/goal] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to toggle pin' }, { status: 500 })
  }
}
