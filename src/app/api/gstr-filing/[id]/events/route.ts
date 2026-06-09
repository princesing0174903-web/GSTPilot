import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const events = await db.filingEvent.findMany({
      where: { filingId: id },
      orderBy: { timestamp: 'asc' },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching filing events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filing events' },
      { status: 500 }
    );
  }
}
