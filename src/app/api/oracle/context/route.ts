// GET /api/oracle/context — Context Engine™ live business context
import { NextResponse } from 'next/server';
import { gatherBusinessContext, formatContextForPrompt, getCachedContext } from '@/lib/oracle-core/context';

export async function GET() {
  try {
    const ctx = await getCachedContext();
    const formatted = formatContextForPrompt(ctx);
    return NextResponse.json({ context: ctx, formatted, estimatedTokens: ctx.estimatedTokens });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Force fresh context
export async function POST() {
  try {
    const ctx = await gatherBusinessContext();
    return NextResponse.json({ context: ctx, refreshed: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
