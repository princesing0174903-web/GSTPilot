// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst-reconciliation/[id]/explain
// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI explains a single mismatch and recommends the best action.
//
// Body: { matchId }
// Returns: {
//   explanation,           // CFO-grade narrative
//   recommendation,        // short action text
//   action: { label, type },
//   suggestion: AISuggestion,         // primary suggestion (label, reason, detail, priority, icon, estimatedResolutionDays)
//   alternatives: AISuggestion[],     // context-aware alternative actions
//   fixes: FixSuggestion[],           // auto-fix suggestions with preview + severity
//   scoreBreakdown: ScoreBreakdown,   // per-field 0-1 confidence
// }
//
// Uses rule-based AI (deterministic, instant, free).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { suggestAction, suggestAllActions, generateFixes } from '@/lib/gst-reconciliation';

export const dynamic = 'force-dynamic';

interface MismatchField {
  field: string;
  booksValue?: string | number;
  gstr2bValue?: string | number;
  delta?: number;
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
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required', code: 'MISSING_PARAMS' }, { status: 400 });
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

    const mismatches: MismatchField[] = safeParse(match.mismatchReasons, []);
    const scoreBreakdown = safeParse(match.scoreBreakdown, {});

    const explanation = buildExplanation(match, mismatches);
    const recommendation = buildRecommendation(match, mismatches);
    const action = buildAction(match);

    // ── Generate full VEYRO AI suggestion set (primary + alternatives) ──
    const suggestionContext = {
      status: match.status as never,
      confidence: match.confidence,
      itcAtRisk: match.itcAtRisk,
      booksInvoiceNo: match.booksInvoiceNo,
      gstr2bInvoiceNo: match.gstr2bInvoiceNo,
      booksSupplierGSTIN: match.booksSupplierGSTIN,
      gstr2bSupplierGSTIN: match.gstr2bSupplierGSTIN,
      booksTaxableValue: match.booksTaxableValue,
      gstr2bTaxableValue: match.gstr2bTaxableValue,
    };
    const suggestion = suggestAction(suggestionContext);
    const alternatives = suggestAllActions(suggestionContext).filter((s) => s.key !== suggestion.key);

    // ── Generate auto-fix suggestions ──
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
    const fixes = generateFixes(fixContext);

    // Persist the AI explanation + suggestion key so we don't regenerate on every view
    await db.gSTReconciliationMatch.update({
      where: { id: matchId },
      data: {
        aiExplanation: explanation,
        aiRecommendation: recommendation,
        aiSuggestion: suggestion.key,
        fixSuggestions: fixes.length > 0 ? JSON.stringify(fixes) : null,
      },
    });

    return NextResponse.json({
      explanation,
      recommendation,
      action,
      suggestion,
      alternatives,
      fixes,
      scoreBreakdown,
    });
  } catch (error) {
    return friendlyApiError(error, 'Oracle could not analyze this mismatch.');
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

function fmtINR(n: number | undefined | null): string {
  if (n == null) return '—';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function buildExplanation(
  match: {
    status: string;
    booksInvoiceNo: string | null;
    gstr2bInvoiceNo: string | null;
    booksSupplierGSTIN: string | null;
    gstr2bSupplierGSTIN: string | null;
    booksTaxableValue: number;
    gstr2bTaxableValue: number;
    booksCGST: number;
    gstr2bCGST: number;
    booksSGST: number;
    gstr2bSGST: number;
    booksIGST: number;
    gstr2bIGST: number;
    itcAtRisk: number;
    confidence: number;
  },
  mismatches: MismatchField[],
): string {
  const invNo = match.booksInvoiceNo || match.gstr2bInvoiceNo || 'Unknown';
  const supplier = match.booksSupplierGSTIN || match.gstr2bSupplierGSTIN || 'Unknown';
  const confPct = Math.round(match.confidence * 100);

  switch (match.status) {
    case 'perfect_match':
      return `Invoice ${invNo} from ${supplier} reconciled perfectly between your Books and GSTR-2B. All 8 comparison fields (GSTIN, invoice number, date, taxable value, CGST, SGST, IGST, CESS) match exactly. Confidence: ${confPct}%. ITC is fully eligible and safe to claim.`;

    case 'value_mismatch': {
      const taxableDelta = match.booksTaxableValue - match.gstr2bTaxableValue;
      const direction = taxableDelta > 0 ? 'higher in your Books' : 'lower in your Books';
      return `Invoice ${invNo} from ${supplier} has a taxable value mismatch (confidence ${confPct}%). Your Books show ${fmtINR(match.booksTaxableValue)} but GSTR-2B shows ${fmtINR(match.gstr2bTaxableValue)} — a difference of ${fmtINR(taxableDelta)} ${direction}. This is the most common reconciliation issue and usually stems from a discount or rounding adjustment not reflected in the supplier's GSTR-1 filing. ITC of ${fmtINR(match.itcAtRisk)} is at risk until reconciled.`;
    }

    case 'tax_mismatch': {
      const taxFields = mismatches.filter((m) => ['cgst', 'sgst', 'igst', 'cess'].includes(m.field));
      const details = taxFields
        .map((m) => `${m.field.toUpperCase()} ${fmtINR(m.booksValue as number)} vs ${fmtINR(m.gstr2bValue as number)}`)
        .join(', ');
      return `Invoice ${invNo} from ${supplier} has a tax component mismatch (confidence ${confPct}%). ${details}. This typically occurs when the supplier applied a different GST rate (e.g. 18% vs 12%) or split CGST/SGST incorrectly vs IGST. The taxable values match, so the invoice is correctly identified — only the tax treatment differs. ITC of ${fmtINR(match.itcAtRisk)} may be partially blocked.`;
    }

    case 'date_mismatch':
      return `Invoice ${invNo} from ${supplier} has a date mismatch (confidence ${confPct}%). Your Books record ${mismatches.find((m) => m.field === 'invoiceDate')?.booksValue || 'no date'} but GSTR-2B shows ${mismatches.find((m) => m.field === 'invoiceDate')?.gstr2bValue || 'no date'}. This matters for ITC timing — the invoice must appear in GSTR-2B for the period in which you're claiming ITC. If the dates differ by more than a financial year, ITC may be time-barred under Section 16(4).`;

    case 'gstin_mismatch':
      return `Invoice ${invNo} appears in both Books and GSTR-2B, but the supplier GSTIN differs (confidence ${confPct}%). Your Books show ${match.booksSupplierGSTIN} while GSTR-2B shows ${match.gstr2bSupplierGSTIN}. This is a serious discrepancy — it may indicate the supplier has multiple GSTINs (common for large businesses with branches) and the invoice was filed under a different branch GSTIN, or worse, a fraudulent GSTIN. Verify with the supplier which GSTIN is correct for this invoice.`;

    case 'missing_in_books':
      return `Invoice ${match.gstr2bInvoiceNo} from ${match.gstr2bSupplierGSTIN} appears in GSTR-2B (filed by the supplier) but is NOT in your purchase register. This means a supplier invoice was not recorded in your Books. Potential ITC of ${fmtINR(match.itcAtRisk)} is available but unclaimed. Common causes: invoice received but not yet entered, expense recorded without the GST breakdown, or the invoice went to a different branch/location.`;

    case 'missing_in_gstr2b':
      return `Invoice ${match.booksInvoiceNo} from ${match.booksSupplierGSTIN} is in your purchase register but NOT in GSTR-2B. The supplier has not uploaded this invoice to the GST portal yet, or uploaded it with a different number/date. ITC of ${fmtINR(match.itcAtRisk)} is at risk — you cannot claim ITC for invoices not in GSTR-2B. Contact the supplier immediately to confirm they file GSTR-1 for this period.`;

    case 'duplicate':
      return `Invoice ${match.booksInvoiceNo || match.gstr2bInvoiceNo} from ${match.booksSupplierGSTIN || match.gstr2bSupplierGSTIN} appears multiple times. This is a duplicate entry that inflates your purchase register and could lead to double-claiming ITC. Identify the correct entry and delete or reverse the duplicate. If the duplicate is on the GSTR-2B side, the supplier may have filed the same invoice twice — flag this to them.`;

    default:
      return `Invoice ${invNo} requires manual review. The reconciliation engine could not classify it automatically.`;
  }
}

function buildRecommendation(
  match: { status: string; booksInvoiceNo: string | null; gstr2bInvoiceNo: string | null; itcAtRisk: number },
  _mismatches: MismatchField[],
): string {
  switch (match.status) {
    case 'perfect_match':
      return 'No action needed. ITC is safe to claim.';
    case 'value_mismatch':
      return `Verify the discount/adjustment with the supplier. If your Books value is correct, request the supplier to amend their GSTR-1. If GSTR-2B is correct, update your Books. Until resolved, claim ITC only on the lower of the two values (${fmtINR(match.itcAtRisk)} at risk).`;
    case 'tax_mismatch':
      return 'Confirm the correct GST rate with the supplier. If the supplier applied the wrong rate, they must amend GSTR-1. Claim ITC at the rate shown in GSTR-2B to avoid a notice.';
    case 'date_mismatch':
      return 'Confirm the correct invoice date with the supplier. If the GSTR-2B date is in a different period, you may need to reverse ITC and re-claim it in the correct period. If within the same FY, a minor date difference is usually acceptable.';
    case 'gstin_mismatch':
      return 'Verify with the supplier which of their GSTINs is the correct one for this invoice. Update your Books to match the GSTIN shown in GSTR-2B, or ask the supplier to amend their filing.';
    case 'missing_in_books':
      return 'Locate the original invoice and record it in your purchase register with the correct GST breakdown. If the invoice cannot be located, request a copy from the supplier immediately. Once recorded, ITC can be claimed.';
    case 'missing_in_gstr2b':
      return 'Contact the supplier and request them to upload this invoice in their next GSTR-1 filing. Follow up before the 11th of the next month (GSTR-1 due date). Until it appears in GSTR-2B, do NOT claim ITC — it will be reversed during auto-reconciliation.';
    case 'duplicate':
      return 'Identify the correct entry and reverse the duplicate. If the duplicate is in your Books, delete the duplicate purchase bill. If on the GSTR-2B side, ask the supplier to amend. Never claim ITC twice on the same invoice.';
    default:
      return 'Escalate to your CA for manual review.';
  }
}

function buildAction(match: { status: string }): { label: string; type: string } {
  switch (match.status) {
    case 'perfect_match':
      return { label: 'Mark as Reviewed', type: 'review' };
    case 'value_mismatch':
    case 'tax_mismatch':
    case 'date_mismatch':
    case 'gstin_mismatch':
      return { label: 'Contact Supplier', type: 'contact' };
    case 'missing_in_books':
      return { label: 'Record in Books', type: 'record' };
    case 'missing_in_gstr2b':
      return { label: 'Remind Supplier', type: 'remind' };
    case 'duplicate':
      return { label: 'Remove Duplicate', type: 'remove' };
    default:
      return { label: 'Review Manually', type: 'review' };
  }
}
