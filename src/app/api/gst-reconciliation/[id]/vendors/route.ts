// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst-reconciliation/[id]/vendors
// ═══════════════════════════════════════════════════════════════════════════════
// Fetch the vendor (supplier) compliance scores for a run.
// Returns an array of {gstin, name, score, grade, reasons[], ...stats} sorted
// worst-first.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { computeVendorScores } from '@/lib/gst-reconciliation';

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

    const run = await db.gSTReconciliationRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    if (run.vendorScores) {
      try {
        const vendors = JSON.parse(run.vendorScores);
        return NextResponse.json({ vendors, cached: true });
      } catch {
        // fall through to regenerate
      }
    }

    const matches = await db.gSTReconciliationMatch.findMany({
      where: { runId },
      select: {
        status: true,
        booksSupplierGSTIN: true,
        gstr2bSupplierGSTIN: true,
        itcAtRisk: true,
      },
    });

    const vendors = computeVendorScores(
      matches.map((m) => ({
        status: m.status as never,
        booksSupplierGSTIN: m.booksSupplierGSTIN,
        gstr2bSupplierGSTIN: m.gstr2bSupplierGSTIN,
        itcAtRisk: m.itcAtRisk,
      })),
    );

    await db.gSTReconciliationRun.update({
      where: { id: runId },
      data: { vendorScores: JSON.stringify(vendors) },
    });

    return NextResponse.json({ vendors, cached: false });
  } catch (error) {
    return friendlyApiError(error, 'Could not load vendor scores.');
  }
}
