// GET  /api/oracle/brain/sessions/:id/messages — list messages in a session
// DELETE /api/oracle/brain/sessions/:id — delete (archive) a session

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  // Verify session belongs to org
  const session = await db.oracleAISession.findFirst({
    where: { id, firmId: orgId },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const messages = await db.oracleAIMessage.findMany({
    where: { sessionId: id, status: { in: ['completed', 'streaming'] } },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: {
      id: true, role: true, content: true, parts: true,
      model: true, status: true, createdAt: true,
    },
  });

  const parsed = messages.map(m => {
    let parts: any[] = [];
    try { parts = JSON.parse(m.parts || '[]'); } catch {}
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      parts,
      model: m.model,
      status: m.status,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    };
  });

  return NextResponse.json({ messages: parsed });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });

  await db.oracleAISession.updateMany({
    where: { id, firmId: orgId },
    data: { status: 'deleted' },
  });
  return NextResponse.json({ ok: true });
}
