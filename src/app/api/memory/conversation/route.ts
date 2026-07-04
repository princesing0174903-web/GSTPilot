// ═══════════════════════════════════════════════════════════════════════════════
// /api/memory/conversation — Internal: record a conversation turn
//
//   POST { email, userMessage, oracleResponse, role?, fn? }
//
// Called by the Oracle chat route AFTER the stream completes (fire-and-forget).
// Stores the turn so Oracle can reference past conversations in future sessions.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { recordConversation } from '@/lib/business-memory'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, userMessage, oracleResponse, role, fn } = body

    if (!email || !userMessage || !oracleResponse) {
      return NextResponse.json(
        { error: 'email, userMessage, and oracleResponse are required' },
        { status: 400 },
      )
    }

    await recordConversation(email, userMessage, oracleResponse, role, fn)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/memory/conversation] POST failed:', error)
    return NextResponse.json({ error: 'Failed to record conversation' }, { status: 500 })
  }
}
