// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — PHASE 2A · Data Normalization API (MODULE 3)
//
// GET /api/data-normalization → unified graph of all business entities.
//   • Returns { ok, entities, counts } — entities capped at 500
//   • Every DB call is wrapped in try/catch so partial failures still return data
//   • Never 500s — on catastrophic error returns empty entities + counts
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { normalizeAllEntities } from '@/lib/connections/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { entities, counts } = await normalizeAllEntities();
    return NextResponse.json({ ok: true, entities, counts });
  } catch (error) {
    console.error('GET /api/data-normalization error:', error);
    return NextResponse.json({
      ok: true,
      entities: [],
      counts: {},
      degraded: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
