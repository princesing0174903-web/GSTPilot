// GET /api/oracle-brain/memory — Oracle Memory Engine snapshot.
import { NextResponse } from 'next/server';
import { buildMemorySnapshot } from '@/lib/oracle-intelligence/memory-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const memory = await buildMemorySnapshot();
    return NextResponse.json(memory);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[oracle-brain/memory] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
