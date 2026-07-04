// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/data/profile
//   Body: { datasetKey: string }
// Deep-profile a single dataset (catalog entry, field stats, sample records,
// open quality alerts) using REAL production data.
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { profileDataset } from '@/lib/data-intelligence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { datasetKey } = body as { datasetKey?: unknown };

    if (typeof datasetKey !== 'string' || datasetKey.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing datasetKey' },
        { status: 400 },
      );
    }

    const profile = await profileDataset(datasetKey.trim());

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error('[data-intelligence/profile][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to profile dataset';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
