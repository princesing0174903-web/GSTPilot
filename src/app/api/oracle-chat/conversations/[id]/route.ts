// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Single Conversation API
// GET    /api/oracle-chat/conversations/[id]   → load session + all messages
// PATCH  /api/oracle-chat/conversations/[id]   → rename / pin / archive
// DELETE /api/oracle-chat/conversations/[id]   → soft-delete (status=deleted)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  loadSession, renameSession, setPinned, deleteSession,
} from '@/lib/oracle-chat/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, messages } = await loadSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({ session, messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load conversation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { title?: string; pinned?: boolean };
    if (typeof body.title === 'string' && body.title.trim()) {
      await renameSession(id, body.title.trim());
    }
    if (typeof body.pinned === 'boolean') {
      await setPinned(id, body.pinned);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update conversation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete conversation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
