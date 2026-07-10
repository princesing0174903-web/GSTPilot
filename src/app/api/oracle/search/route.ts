// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Universal Search API
//
// GET /api/oracle/search?q=<query> → searches clients, invoices, returns,
//                                     reports, documents, tasks, notices.
//
// Response:
//   { ok: true, results: SearchResult[], query: string }
//
// Queries shorter than 2 characters return an empty result set instantly
// (no DB hit).
// ═══════════════════════════════════════════════════════════════════════════════

import { searchAll } from '@/lib/oracle/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return Response.json({ ok: true, results: [] });
  }

  try {
    const results = await searchAll(q);
    return Response.json({ ok: true, results, query: q });
  } catch (error) {
    // Never surface a 500 — return an empty result set instead.
    console.error('GET /api/oracle/search error:', error);
    return Response.json({ ok: true, results: [], query: q });
  }
}
