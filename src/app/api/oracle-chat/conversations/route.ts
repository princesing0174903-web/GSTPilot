// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Conversations List API
// GET /api/oracle-chat/conversations
//
// Returns all persisted OracleAISession rows (newest first). These survive
// page refreshes — real database memory, not browser memory.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/oracle-chat/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conversations = await listSessions();
    return NextResponse.json({ conversations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load conversations';
    return NextResponse.json({ conversations: [], error: msg }, { status: 500 });
  }
}
