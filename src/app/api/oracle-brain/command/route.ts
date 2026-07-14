// POST /api/oracle-brain/command — Oracle Command Center natural-language query.
import { NextRequest, NextResponse } from 'next/server';
import { runCommand } from '@/lib/oracle-intelligence/command-center';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query: string = body.query || body.command || body.q || '';
    if (!query.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    const result = await runCommand(query);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[oracle-brain/command] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
