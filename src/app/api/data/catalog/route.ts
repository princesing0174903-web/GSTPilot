// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/catalog
//   ?datasetKey=<key>           → single catalog entry
//   ?datasetKey=<key>&profile=true → full dataset profile
//   (no params)                 → entire Universal Data Catalog™
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getCatalog, getCatalogEntry, profileDataset } from '@/lib/data-intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const datasetKey = searchParams.get('datasetKey');
    const wantProfile = searchParams.get('profile') === 'true';

    if (datasetKey && wantProfile) {
      const profile = await profileDataset(datasetKey);
      return NextResponse.json({ ok: true, profile });
    }

    if (datasetKey) {
      const entry = await getCatalogEntry(datasetKey);
      return NextResponse.json({ ok: true, entry });
    }

    const catalog = await getCatalog();
    return NextResponse.json({ ok: true, catalog });
  } catch (err) {
    console.error('[data-intelligence/catalog] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load data catalog';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
