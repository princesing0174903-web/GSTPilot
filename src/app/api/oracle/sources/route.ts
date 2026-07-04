// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Sources API
// GET /api/oracle/sources?q=<query>&k=<topK>  → relevant GST law/circular sources
// GET /api/oracle/sources  → list all seeded sources (for browsing)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { retrieveSources, ensureSourcesSeeded } from '@/lib/oracle/sources';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const k = Number(req.nextUrl.searchParams.get('k') ?? '6');

    if (q.trim()) {
      const sources = await retrieveSources(q, Math.min(12, Math.max(1, k)));
      return NextResponse.json({ ok: true, sources });
    }

    // No query → return the full seeded knowledge base for browsing.
    await ensureSourcesSeeded();
    const all = await db.oracleSource.findMany({
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    return NextResponse.json({
      ok: true,
      sources: all.map((s) => ({
        id: s.id,
        category: s.category,
        title: s.title,
        citation: s.citation,
        referenceNumber: s.referenceNumber ?? undefined,
        summary: s.summary ?? undefined,
        url: s.url ?? undefined,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, sources: [] }, { status: 200 });
  }
}

export const runtime = 'nodejs';
