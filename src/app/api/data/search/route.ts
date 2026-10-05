// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/search
//   ?q=<query>            (required) search query
//   ?mode=keyword|semantic|hybrid  (default hybrid)
//   ?limit=<int>          (default 50, clamped 1..200)
// Returns matched hits plus the live Enterprise Search™ index summary.
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { searchEnterprise, getSearchIndexSummary } from '@/lib/data-intelligence';

const VALID_MODES = new Set(['keyword', 'semantic', 'hybrid']);
type SearchMode = 'keyword' | 'semantic' | 'hybrid';

function parseMode(raw: string | null): SearchMode {
  if (raw && VALID_MODES.has(raw)) return raw as SearchMode;
  return 'hybrid';
}

function parseLimit(raw: string | null): number {
  if (!raw) return 50;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q');
    if (!q) {
      return NextResponse.json(
        { ok: false, error: 'Missing q param' },
        { status: 400 },
      );
    }

    const mode = parseMode(searchParams.get('mode'));
    const limit = parseLimit(searchParams.get('limit'));

    const [result, indexSummary] = await Promise.all([
      searchEnterprise(q, mode, limit),
      getSearchIndexSummary(),
    ]);

    return NextResponse.json({ ok: true, result, indexSummary });
  } catch (err) {
    console.error('[data-intelligence/search] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to run enterprise search';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/data/search
//   Body: { query: string, mode?: 'keyword'|'semantic'|'hybrid', limit?: number }
// Runs Enterprise Search™ over the live index and returns matched hits.
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_POST_MODES = new Set(['keyword', 'semantic', 'hybrid']);
type PostSearchMode = 'keyword' | 'semantic' | 'hybrid';

function resolveMode(value: unknown): PostSearchMode {
  if (typeof value === 'string' && VALID_POST_MODES.has(value)) {
    return value as PostSearchMode;
  }
  return 'hybrid';
}

function resolveLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { query, mode, limit } = body as {
      query?: unknown;
      mode?: unknown;
      limit?: unknown;
    };

    if (typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing query' },
        { status: 400 },
      );
    }

    const resolvedMode = resolveMode(mode);
    const resolvedLimit = resolveLimit(limit);

    const result = await searchEnterprise(query, resolvedMode, resolvedLimit);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error('[data-intelligence/search][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to run enterprise search';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
