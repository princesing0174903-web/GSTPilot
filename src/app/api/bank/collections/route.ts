// GET /api/bank/collections
// Returns the collections recovery state — open cases, recovered, escalated, total outstanding.

import { NextResponse } from 'next/server';
import { buildCollectionsState } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const collections = await buildCollectionsState();
    return NextResponse.json({ ok: true, collections });
  } catch (err) {
    console.error('[bank/collections] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load collections', detail: String(err) },
      { status: 500 },
    );
  }
}
