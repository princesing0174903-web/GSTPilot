import { NextResponse } from 'next/server';
import { deleteAccount } from '@/lib/banking/accounts';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Account id is required' }, { status: 400 });
    }
    await deleteAccount(id);
    return NextResponse.json({ success: true, message: "I've disconnected the bank account." });
  } catch (err) {
    console.error('[API /banking/accounts/:id] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
