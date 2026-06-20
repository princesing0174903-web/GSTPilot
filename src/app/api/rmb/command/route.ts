import { NextRequest, NextResponse } from 'next/server';
import { generateCFOInsights } from '@/lib/cfo/engine';
import { parseCommand, QUICK_COMMANDS } from '@/lib/rmb/engine';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/rmb/command
// Body: { text: string }
// Returns: parsed CommandIntent + generated task plan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? '').toString().trim();

    if (!text) {
      return NextResponse.json(
        { error: 'Missing "text" in request body.' },
        { status: 400 },
      );
    }

    let user: { name?: string } | null = null;
    try {
      const session = await getServerSession();
      const name = session?.user?.name ?? undefined;
      user = name ? { name } : null;
    } catch {
      // ignore
    }

    const cfo = await generateCFOInsights(user);
    const intent = parseCommand(text, cfo);

    return NextResponse.json(
      {
        ...intent,
        quickCommands: QUICK_COMMANDS,
      },
      {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    );
  } catch (err) {
    console.error('[rmb/command] POST error', err);
    return NextResponse.json(
      { error: 'Failed to parse command', detail: String(err) },
      { status: 500 },
    );
  }
}
