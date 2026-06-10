import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const filings = await db.gSTRFiling.findMany({
      include: {
        client: true,
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ filings });
  } catch (error) {
    console.error('Error fetching GSTR filings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GSTR filings' },
      { status: 500 }
    );
  }
}
