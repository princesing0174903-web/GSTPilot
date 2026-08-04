// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst-reconciliation/[id]/export
// ═══════════════════════════════════════════════════════════════════════════════
// Export a reconciliation run as CSV (default) or JSON.
// Query: ?format=csv|json
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    const run = await db.gSTReconciliationRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    const matches = await db.gSTReconciliationMatch.findMany({
      where: { runId },
      orderBy: [{ status: 'asc' }, { itcAtRisk: 'desc' }],
    });

    const rows = matches.map((m) => ({
      status: m.status,
      confidence: m.confidence,
      books_invoice_no: m.booksInvoiceNo || '',
      books_invoice_date: m.booksInvoiceDate || '',
      books_supplier_gstin: m.booksSupplierGSTIN || '',
      books_taxable_value: m.booksTaxableValue,
      books_cgst: m.booksCGST,
      books_sgst: m.booksSGST,
      books_igst: m.booksIGST,
      books_cess: m.booksCESS,
      books_total: m.booksTotal,
      gstr2b_invoice_no: m.gstr2bInvoiceNo || '',
      gstr2b_invoice_date: m.gstr2bInvoiceDate || '',
      gstr2b_supplier_gstin: m.gstr2bSupplierGSTIN || '',
      gstr2b_taxable_value: m.gstr2bTaxableValue,
      gstr2b_cgst: m.gstr2bCGST,
      gstr2b_sgst: m.gstr2bSGST,
      gstr2b_igst: m.gstr2bIGST,
      gstr2b_cess: m.gstr2bCESS,
      gstr2b_total: m.gstr2bTotal,
      itc_at_risk: m.itcAtRisk,
      resolved: m.resolved ? 'yes' : 'no',
      ai_explanation: m.aiExplanation || '',
      ai_recommendation: m.aiRecommendation || '',
    }));

    if (format === 'json') {
      return NextResponse.json({
        run: {
          id: run.id,
          gstin: run.gstin,
          period: run.period,
          matchPercent: run.matchPercent,
          potentialITCLoss: run.potentialITCLoss,
        },
        matches: rows,
      });
    }

    // CSV
    const headers = Object.keys(rows[0] || { status: '' });
    const csvLines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(',')),
    ];
    const csv = csvLines.join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gst-reconciliation-${run.gstin}-${run.period}.csv"`,
      },
    });
  } catch (error) {
    return friendlyApiError(error, 'Could not export reconciliation report.');
  }
}
