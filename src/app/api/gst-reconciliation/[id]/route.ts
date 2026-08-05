// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst-reconciliation/[id]
// ═══════════════════════════════════════════════════════════════════════════════
// Fetch a single reconciliation run + its matches (with filters).
// Query: ?status=perfect_match&resolved=false&search=INV&limit=50&offset=0
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { id: runId } = await params;
    const { searchParams } = new URL(request.url);

    // Load the run first to get organizationId for membership check
    const run = await db.gSTReconciliationRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    // ── Parse filters ──
    const status = searchParams.get('status');
    const resolved = searchParams.get('resolved'); // 'true' | 'false' | null (all)
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
    const offset = Number(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { runId };
    if (status && status !== 'all') where.status = status;
    if (resolved === 'true') where.resolved = true;
    if (resolved === 'false') where.resolved = false;
    if (search) {
      where.OR = [
        { booksInvoiceNo: { contains: search } },
        { gstr2bInvoiceNo: { contains: search } },
        { booksSupplierGSTIN: { contains: search } },
        { gstr2bSupplierGSTIN: { contains: search } },
      ];
    }

    const [matches, total] = await Promise.all([
      db.gSTReconciliationMatch.findMany({
        where,
        orderBy: [{ status: 'asc' }, { itcAtRisk: 'desc' }],
        take: limit,
        skip: offset,
      }),
      db.gSTReconciliationMatch.count({ where }),
    ]);

    return NextResponse.json({
      run: {
        id: run.id,
        gstin: run.gstin,
        period: run.period,
        gspProvider: run.gspProvider,
        status: run.status,
        totalBooks: run.totalBooks,
        total2B: run.total2B,
        matched: run.matched,
        unmatched: run.unmatched,
        missingInBooks: run.missingInBooks,
        missingIn2B: run.missingIn2B,
        duplicates: run.duplicates,
        matchPercent: run.matchPercent,
        potentialITCLoss: run.potentialITCLoss,
        totalTaxableValue: run.totalTaxableValue,
        totalMatchedTax: run.totalMatchedTax,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        durationMs: run.durationMs,
      },
      matches: matches.map((m) => ({
        ...m,
        mismatchReasons: safeParse(m.mismatchReasons, []),
      })),
      pagination: { total, limit, offset },
    });
  } catch (error) {
    return friendlyApiError(error, 'Could not load reconciliation details.');
  }
}

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
