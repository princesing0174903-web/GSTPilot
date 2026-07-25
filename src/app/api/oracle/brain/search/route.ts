// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Semantic Search API
// GET  /api/oracle/brain/search?firmId=...&q=...&topK=...&mode=semantic|hybrid
// POST /api/oracle/brain/search  { firmId, query, topK, mode, types }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { semanticSearch, hybridSearch, findSimilarMemories } from '@/lib/oracle/brain/semantic-search';
import type { BrainMemoryType } from '@/lib/oracle/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const firmId = url.searchParams.get('firmId') || 'preview-org';
    const query = url.searchParams.get('q') || '';
    const topK = parseInt(url.searchParams.get('topK') || '5', 10);
    const mode = url.searchParams.get('mode') || 'hybrid';
    const typeParam = url.searchParams.get('types');
    const types = typeParam ? (typeParam.split(',') as BrainMemoryType[]) : undefined;
    const similarTo = url.searchParams.get('similarTo');

    if (similarTo) {
      return NextResponse.json({
        ok: true,
        data: await findSimilarMemories(similarTo, topK),
      });
    }

    if (!query) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const params = { firmId, query, topK, types };
    const data =
      mode === 'semantic'
        ? await semanticSearch(params)
        : await hybridSearch(params);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const firmId = (body.firmId as string) || 'preview-org';
    const query = (body.query as string) || '';
    const topK = (body.topK as number) || 5;
    const mode = (body.mode as string) || 'hybrid';
    const types = body.types as BrainMemoryType[] | undefined;

    if (!query) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const params = { firmId, query, topK, types };
    const data =
      mode === 'semantic'
        ? await semanticSearch(params)
        : await hybridSearch(params);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
