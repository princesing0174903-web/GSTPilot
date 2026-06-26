// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/connectors/[id]?userId=<firebase_uid>
// Deletes a data connection + all its synced records.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    // Verify ownership
    const conn = await db.dataConnection.findUnique({ where: { id } });
    if (!conn || conn.userId !== userId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Delete synced records first (cascade), then the connection
    await db.syncedRecord.deleteMany({ where: { connectionId: id } }).catch(() => {});
    await db.dataConnection.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Connectors] Delete error:', err);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
