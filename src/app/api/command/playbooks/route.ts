// GET /api/command/playbooks
// Returns all Enterprise Playbooks™ + summary.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getPlaybooks, getPlaybookSummary } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const [playbooks, summary] = await Promise.all([
      getPlaybooks(),
      getPlaybookSummary(),
    ]);
    return NextResponse.json({ ok: true, playbooks, summary });
  } catch (err) {
    console.error('[command/playbooks] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load playbooks';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
