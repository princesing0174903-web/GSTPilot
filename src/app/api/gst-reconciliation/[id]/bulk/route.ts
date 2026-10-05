// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst-reconciliation/[id]/bulk
// ═══════════════════════════════════════════════════════════════════════════════
// Bulk operations on selected matches.
//
// Body: {
//   matchIds: string[],
//   action: 'resolve' | 'reopen' | 'review' | 'email_supplier' | 'export_csv' | 'export_json',
//   note?: string,            // for resolve
// }
//
// Returns: {
//   ok: boolean,
//   action: string,
//   affected: number,         // number of matches updated
//   exportData?: { ... },     // for export_csv / export_json
//   emailDrafts?: Array<{...}>,  // for email_supplier (draft emails, not sent)
// }
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

function fmtINR(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { id: runId } = await params;
    const body = await request.json();
    const { matchIds, action, note } = body as {
      matchIds: string[];
      action: 'resolve' | 'reopen' | 'review' | 'email_supplier' | 'export_csv' | 'export_json';
      note?: string;
    };

    if (!Array.isArray(matchIds) || matchIds.length === 0 || !action) {
      return NextResponse.json(
        { error: 'matchIds (non-empty array) and action are required', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    if (matchIds.length > 1000) {
      return NextResponse.json(
        { error: 'Cannot process more than 1000 matches at once', code: 'TOO_MANY' },
        { status: 400 },
      );
    }

    const run = await db.gSTReconciliationRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    // Fetch all selected matches
    const matches = await db.gSTReconciliationMatch.findMany({
      where: { id: { in: matchIds }, runId },
    });

    if (matches.length === 0) {
      return NextResponse.json(
        { error: 'No matching records found', code: 'NO_MATCHES' },
        { status: 404 },
      );
    }

    switch (action) {
      case 'resolve': {
        await db.gSTReconciliationMatch.updateMany({
          where: { id: { in: matchIds }, runId },
          data: {
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: uid,
            resolutionNote: note || 'Bulk resolved',
          },
        });
        const { invalidateBusinessSnapshotCache } = await import('@/lib/business/snapshot');
        invalidateBusinessSnapshotCache(run.organizationId);
        return NextResponse.json({ ok: true, action, affected: matches.length });
      }

      case 'reopen': {
        await db.gSTReconciliationMatch.updateMany({
          where: { id: { in: matchIds }, runId },
          data: {
            resolved: false,
            resolvedAt: null,
            resolvedBy: null,
            resolutionNote: null,
          },
        });
        const { invalidateBusinessSnapshotCache } = await import('@/lib/business/snapshot');
        invalidateBusinessSnapshotCache(run.organizationId);
        return NextResponse.json({ ok: true, action, affected: matches.length });
      }

      case 'review': {
        await db.gSTReconciliationMatch.updateMany({
          where: { id: { in: matchIds }, runId },
          data: {
            reviewedAt: new Date(),
            reviewedBy: uid,
          },
        });
        return NextResponse.json({ ok: true, action, affected: matches.length });
      }

      case 'email_supplier': {
        // Generate email drafts (not actually sent — user reviews and sends manually)
        const drafts = matches.map((m) => {
          const supplier = m.booksSupplierGSTIN || m.gstr2bSupplierGSTIN || 'Unknown';
          const invNo = m.booksInvoiceNo || m.gstr2bInvoiceNo || 'Unknown';
          const itc = m.itcAtRisk;
          const subject =
            m.status === 'missing_in_gstr2b'
              ? `Invoice ${invNo} not yet uploaded to GSTR-2B`
              : m.status === 'value_mismatch'
                ? `GSTR-2B mismatch for invoice ${invNo}`
                : `GST reconciliation discrepancy — invoice ${invNo}`;
          const body = `Dear Supplier,

During our GSTR-2B reconciliation for the period ${run.period}, we noticed the following discrepancy for invoice ${invNo}:

  • Supplier GSTIN: ${supplier}
  • Status: ${m.status.replace(/_/g, ' ')}
  • ITC at risk: ${fmtINR(itc)}

Please review your GSTR-1 filing for this invoice and amend if necessary. We are unable to claim input tax credit until this is resolved.

Regards,
GSTPilot Reconciliation Team`;
          return { matchId: m.id, supplier, invoiceNo: invNo, subject, body };
        });
        return NextResponse.json({ ok: true, action, affected: matches.length, emailDrafts: drafts });
      }

      case 'export_csv':
      case 'export_json': {
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
          gstr2b_invoice_no: m.gstr2bInvoiceNo || '',
          gstr2b_invoice_date: m.gstr2bInvoiceDate || '',
          gstr2b_supplier_gstin: m.gstr2bSupplierGSTIN || '',
          gstr2b_taxable_value: m.gstr2bTaxableValue,
          gstr2b_cgst: m.gstr2bCGST,
          gstr2b_sgst: m.gstr2bSGST,
          gstr2b_igst: m.gstr2bIGST,
          gstr2b_cess: m.gstr2bCESS,
          itc_at_risk: m.itcAtRisk,
          resolved: m.resolved ? 'yes' : 'no',
          ai_explanation: m.aiExplanation || '',
          ai_recommendation: m.aiRecommendation || '',
        }));

        if (action === 'export_json') {
          return NextResponse.json({
            ok: true,
            action,
            affected: matches.length,
            exportData: {
              format: 'json',
              run: {
                id: run.id,
                gstin: run.gstin,
                period: run.period,
                matchPercent: run.matchPercent,
                potentialITCLoss: run.potentialITCLoss,
              },
              matches: rows,
            },
          });
        }

        // CSV
        const headers = Object.keys(rows[0] || { status: '' });
        const csvLines = [
          headers.join(','),
          ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(',')),
        ];
        const csv = csvLines.join('\n');
        return NextResponse.json({
          ok: true,
          action,
          affected: matches.length,
          exportData: {
            format: 'csv',
            csv,
            filename: `gst-reconciliation-${run.gstin}-${run.period}-selected.csv`,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}`, code: 'UNKNOWN_ACTION' },
          { status: 400 },
        );
    }
  } catch (error) {
    return friendlyApiError(error, 'Could not process bulk action.');
  }
}
