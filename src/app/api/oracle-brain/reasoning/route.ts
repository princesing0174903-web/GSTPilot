// GET /api/oracle-brain/reasoning — Oracle Reasoning Engine conclusions.
import { NextResponse } from 'next/server';
import { buildReasoning } from '@/lib/oracle-intelligence/reasoning-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const reasoning = await buildReasoning();
    return NextResponse.json(reasoning);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[oracle-brain/reasoning] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
