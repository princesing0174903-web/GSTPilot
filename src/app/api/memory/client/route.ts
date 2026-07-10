// ═══════════════════════════════════════════════════════════════════════════════
// /api/memory/client — Client Memory CRUD
//
//   POST   { email, clientId, paymentBehaviour?, riskNotes?, customNotes? }  → upsert
//   DELETE ?clientId=...&email=...                                           → delete
//   PATCH  { clientId, email }                                               → toggle pin
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
  upsertClientMemory,
  deleteClientMemory,
  togglePinClientMemory,
} from '@/lib/business-memory'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, clientId, paymentBehaviour, riskNotes, customNotes } = body

    if (!email || !clientId) {
      return NextResponse.json(
        { error: 'email and clientId are required' },
        { status: 400 },
      )
    }

    await upsertClientMemory(clientId, email, {
      paymentBehaviour,
      riskNotes,
      customNotes,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/client] POST failed:', error)
    return NextResponse.json({ error: 'Failed to save client memory' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get('clientId')
    const email = url.searchParams.get('email')

    if (!clientId || !email) {
      return NextResponse.json({ error: 'clientId and email are required' }, { status: 400 })
    }

    await deleteClientMemory(clientId, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/client] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete client memory' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientId, email } = body

    if (!clientId || !email) {
      return NextResponse.json({ error: 'clientId and email are required' }, { status: 400 })
    }

    await togglePinClientMemory(clientId, email)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/client] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to toggle pin' }, { status: 500 })
  }
}
