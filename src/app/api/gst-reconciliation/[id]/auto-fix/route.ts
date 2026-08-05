// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst-reconciliation/[id]/auto-fix
// ═══════════════════════════════════════════════════════════════════════════════
// Apply an auto-fix to a reconciliation match.
//
// Body: {
//   matchId: string,
//   fixType: 'correct_date' | 'correct_gstin' | 'update_taxable' | 'update_tax' | 'merge_duplicate' | 'create_bill' | 'delete_duplicate',
//   field?: string,        // for update_tax (cgst | sgst | igst | cess | taxes)
//   dryRun?: boolean,      // if true, returns preview only (default: false)
// }
//
// Returns: {
//   ok: boolean,
//   applied: boolean,      // false if dryRun
//   fix: FixSuggestion,
//   before: { ...fields },
//   after: { ...fields },
//   itcImpact: number,
//   newStatus: MatchStatus,  // predicted status after applying the fix
// }
//
// For "safe" fixes (correct_date), applies the change directly to the books
// purchase bill AND marks the match resolved. For "moderate"/"risky" fixes,
// only marks the match resolved with a note (does not mutate books — human
// review required). The UI shows a preview dialog before applying.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { generateFixes, applyFixToBooks, type FixSuggestion, type FixType } from '@/lib/gst-reconciliation';

export const dynamic = 'force-dynamic';

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
    const { matchId, fixType, field, dryRun } = body as {
      matchId: string;
      fixType: FixType;
      field?: string;
      dryRun?: boolean;
    };

    if (!matchId || !fixType) {
      return NextResponse.json(
        { error: 'matchId and fixType are required', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const run = await db.gSTReconciliationRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    const match = await db.gSTReconciliationMatch.findUnique({ where: { id: matchId } });
    if (!match || match.runId !== runId) {
      return NextResponse.json({ error: 'Match not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // ── Generate all applicable fixes for this match, then pick the requested one ──
    const fixContext = {
      status: match.status as never,
      confidence: match.confidence,
      booksInvoiceId: match.booksInvoiceId,
      booksInvoiceNo: match.booksInvoiceNo,
      booksInvoiceDate: match.booksInvoiceDate,
      gstr2bInvoiceNo: match.gstr2bInvoiceNo,
      gstr2bInvoiceDate: match.gstr2bInvoiceDate,
      booksSupplierGSTIN: match.booksSupplierGSTIN,
      gstr2bSupplierGSTIN: match.gstr2bSupplierGSTIN,
      booksTaxableValue: match.booksTaxableValue,
      gstr2bTaxableValue: match.gstr2bTaxableValue,
      booksCGST: match.booksCGST,
      gstr2bCGST: match.gstr2bCGST,
      booksSGST: match.booksSGST,
      gstr2bSGST: match.gstr2bSGST,
      booksIGST: match.booksIGST,
      gstr2bIGST: match.gstr2bIGST,
      booksCESS: match.booksCESS,
      gstr2bCESS: match.gstr2bCESS,
      itcAtRisk: match.itcAtRisk,
    };
    const allFixes = generateFixes(fixContext);
    const requestedFix = allFixes.find(
      (f) => f.type === fixType && (!field || f.field === field || f.field === 'taxes'),
    );

    if (!requestedFix) {
      return NextResponse.json(
        {
          error: `Fix ${fixType}${field ? `(${field})` : ''} is not applicable to this match`,
          code: 'FIX_NOT_APPLICABLE',
          availableFixes: allFixes,
        },
        { status: 400 },
      );
    }

    // ── Capture "before" state ──
    const before = {
      invoiceDate: match.booksInvoiceDate,
      supplierGSTIN: match.booksSupplierGSTIN,
      taxableValue: match.booksTaxableValue,
      cgst: match.booksCGST,
      sgst: match.booksSGST,
      igst: match.booksIGST,
      cess: match.booksCESS,
    };

    // ── Predict "after" state (apply fix to a copy) ──
    const gstr2bValues = {
      invoiceDate: match.gstr2bInvoiceDate || undefined,
      supplierGSTIN: match.gstr2bSupplierGSTIN || '',
      taxableValue: match.gstr2bTaxableValue,
      cgst: match.gstr2bCGST,
      sgst: match.gstr2bSGST,
      igst: match.gstr2bIGST,
      cess: match.gstr2bCESS,
    };
    const { updated: afterState } = applyFixToBooks(
      {
        invoiceDate: match.booksInvoiceDate || undefined,
        supplierGSTIN: match.booksSupplierGSTIN || '',
        taxableValue: match.booksTaxableValue,
        cgst: match.booksCGST,
        sgst: match.booksSGST,
        igst: match.booksIGST,
        cess: match.booksCESS,
      },
      requestedFix,
      gstr2bValues,
    );

    // Predict the new status after applying the fix
    const newStatus = predictNewStatus(match.status, requestedFix);

    // ── Dry run = preview only, no DB writes ──
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        applied: false,
        fix: requestedFix,
        before,
        after: afterState,
        itcImpact: requestedFix.itcImpact ?? 0,
        newStatus,
      });
    }

    // ── Apply the fix ──
    // For safe fixes (correct_date), update the purchase bill in Books + mark resolved.
    // For moderate/risky fixes, only mark resolved with a note (human review required).
    let appliedToBooks = false;
    if (requestedFix.canAutoApply && match.booksInvoiceId) {
      try {
        const updateData: Record<string, unknown> = {};
        if (requestedFix.type === 'correct_date' && afterState.invoiceDate) {
          updateData.invoiceDate = afterState.invoiceDate;
        }
        if (Object.keys(updateData).length > 0) {
          await db.purchaseBill.update({
            where: { id: match.booksInvoiceId },
            data: updateData,
          });
          appliedToBooks = true;
        }
      } catch (err) {
        // Books update failed — log but continue to mark the match as fixed
        console.error('auto-fix: failed to update purchase bill:', err);
      }
    }

    // ── Update the match ──
    await db.gSTReconciliationMatch.update({
      where: { id: matchId },
      data: {
        fixApplied: true,
        fixAppliedAt: new Date(),
        fixAppliedBy: uid,
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: uid,
        resolutionNote: `Auto-fix applied: ${requestedFix.label}${appliedToBooks ? ' (books updated)' : ' (flagged for review)'}`,
        // Update the books-side denormalized values if we applied to books
        ...(appliedToBooks
          ? {
              booksInvoiceDate: afterState.invoiceDate ?? null,
              booksSupplierGSTIN: afterState.supplierGSTIN || null,
              booksTaxableValue: afterState.taxableValue,
              booksCGST: afterState.cgst,
              booksSGST: afterState.sgst,
              booksIGST: afterState.igst,
              booksCESS: afterState.cess,
            }
          : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      applied: true,
      fix: requestedFix,
      before,
      after: afterState,
      itcImpact: requestedFix.itcImpact ?? 0,
      newStatus,
      appliedToBooks,
    });
  } catch (error) {
    return friendlyApiError(error, 'Could not apply auto-fix.');
  }
}

function predictNewStatus(
  currentStatus: string,
  fix: FixSuggestion,
): string {
  if (fix.type === 'merge_duplicate' || fix.type === 'delete_duplicate') return 'perfect_match';
  if (fix.type === 'create_bill') return 'perfect_match';
  if (fix.type === 'correct_date') return 'perfect_match';
  if (fix.type === 'correct_gstin') return 'perfect_match';
  if (fix.type === 'update_taxable') return 'perfect_match';
  if (fix.type === 'update_tax') return 'perfect_match';
  return currentStatus;
}
