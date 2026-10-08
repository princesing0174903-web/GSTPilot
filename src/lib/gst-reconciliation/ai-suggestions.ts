// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — VEYRO AI Suggestions for Reconciliation Mismatches
// ═══════════════════════════════════════════════════════════════════════════════
//
// For each mismatch, Oracle recommends ONE primary action with reasoning.
// The 5 action types match the user's spec:
//
//   • contact_supplier  — supplier needs to act (amend GSTR-1, upload invoice, etc.)
//   • wait_for_gstr1    — supplier hasn't filed yet, wait until next 2B cycle
//   • raise_dispute     — formal dispute on the GST portal
//   • claim_later       — ITC blocked now, claim in a future period
//   • ignore_mismatch   — acceptable tolerance, no action needed
//
// Each suggestion includes:
//   • key        — machine-readable action key
//   • label      — human-readable label
//   • reason     — why Oracle recommends this
//   • detail     — CFO-grade explanation with ₹ amounts
//   • priority   — high | medium | low
//   • estimatedResolutionDays — for SLA tracking
//
// Pure functions, no side effects.
// ═══════════════════════════════════════════════════════════════════════════════

import type { MatchStatus } from './match-engine';

export type AISuggestionKey =
  | 'contact_supplier'
  | 'wait_for_gstr1'
  | 'raise_dispute'
  | 'claim_later'
  | 'ignore_mismatch';

export interface AISuggestion {
  key: AISuggestionKey;
  label: string;
  reason: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  estimatedResolutionDays: number;
  icon: string; // lucide icon name hint for the UI
}

interface MatchContext {
  status: MatchStatus;
  confidence: number;
  itcAtRisk: number;
  booksInvoiceNo: string | null;
  gstr2bInvoiceNo: string | null;
  booksSupplierGSTIN: string | null;
  gstr2bSupplierGSTIN: string | null;
  booksTaxableValue: number;
  gstr2bTaxableValue: number;
}

function fmtINR(n: number | null | undefined): string {
  if (n == null) return '—';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Generate the VEYRO AI suggestion for a single mismatch.
 * Returns one primary action + reasoning.
 */
export function suggestAction(ctx: MatchContext): AISuggestion {
  const inv = ctx.booksInvoiceNo || ctx.gstr2bInvoiceNo || 'Unknown';
  const supplier = ctx.booksSupplierGSTIN || ctx.gstr2bSupplierGSTIN || 'Unknown';

  switch (ctx.status) {
    case 'perfect_match':
      return {
        key: 'ignore_mismatch',
        label: 'Mark as Reviewed',
        reason: 'All fields match between Books and GSTR-2B.',
        detail: `Invoice ${inv} from ${supplier} reconciled perfectly. No action needed — ITC of ${fmtINR(ctx.itcAtRisk === 0 ? ctx.gstr2bTaxableValue * 0.18 : 0)} is safe to claim.`,
        priority: 'low',
        estimatedResolutionDays: 0,
        icon: 'CheckCircle2',
      };

    case 'value_mismatch': {
      const delta = Math.abs(ctx.booksTaxableValue - ctx.gstr2bTaxableValue);
      if (delta <= 100) {
        return {
          key: 'ignore_mismatch',
          label: 'Accept Tolerance',
          reason: `Value difference of ${fmtINR(delta)} is within the acceptable ₹100 tolerance band.`,
          detail: `Invoice ${inv} has a minor taxable-value difference (${fmtINR(delta)}). GSTN typically allows this rounding tolerance. Mark as accepted and proceed with ITC claim at the lower value.`,
          priority: 'low',
          estimatedResolutionDays: 0,
          icon: 'CheckCircle2',
        };
      }
      return {
        key: 'contact_supplier',
        label: 'Contact Supplier',
        reason: `Taxable value differs by ${fmtINR(delta)} — supplier likely missed a discount/adjustment in GSTR-1.`,
        detail: `Your Books show ${fmtINR(ctx.booksTaxableValue)} but GSTR-2B shows ${fmtINR(ctx.gstr2bTaxableValue)}. Email the supplier with the invoice copy and request a GSTR-1 amendment. Until resolved, claim ITC on the lower value (${fmtINR(Math.min(ctx.booksTaxableValue, ctx.gstr2bTaxableValue))}) to avoid reversal. ITC at risk: ${fmtINR(ctx.itcAtRisk)}.`,
        priority: 'high',
        estimatedResolutionDays: 7,
        icon: 'Mail',
      };
    }

    case 'tax_mismatch':
      return {
        key: 'contact_supplier',
        label: 'Contact Supplier',
        reason: 'Tax components (CGST/SGST/IGST/CESS) differ — supplier applied a different GST rate or split.',
        detail: `Invoice ${inv} has matching taxable values but different tax treatment. This usually means the supplier used a different GST rate (e.g. 18% vs 12%) or split CGST+SGST instead of IGST. Email the supplier to confirm the correct rate and request a GSTR-1 amendment if necessary. Claim ITC at the rate shown in GSTR-2B until corrected. ITC at risk: ${fmtINR(ctx.itcAtRisk)}.`,
        priority: 'high',
        estimatedResolutionDays: 7,
        icon: 'Mail',
      };

    case 'date_mismatch':
      // If the dates are close (same FY), it's minor. If across FY, it's serious (Section 16(4)).
      return {
        key: 'contact_supplier',
        label: 'Contact Supplier',
        reason: 'Invoice dates differ — could affect ITC timing under Section 16(4) if across financial years.',
        detail: `Invoice ${inv} shows different dates in Books vs GSTR-2B. If the dates are within the same financial year, a minor difference is usually acceptable. If they cross financial years, ITC may be time-barred under Section 16(4) — confirm the correct date with the supplier immediately and request an amendment. ITC at risk: ${fmtINR(ctx.itcAtRisk)}.`,
        priority: 'medium',
        estimatedResolutionDays: 5,
        icon: 'CalendarClock',
      };

    case 'gstin_mismatch':
      return {
        key: 'raise_dispute',
        label: 'Raise Dispute',
        reason: 'Supplier GSTIN differs between Books and GSTR-2B — potential fraud or wrong-branch filing.',
        detail: `Invoice ${inv} appears in both Books and GSTR-2B but with different supplier GSTINs (${ctx.booksSupplierGSTIN} vs ${ctx.gstr2bSupplierGSTIN}). This is serious — it may indicate the supplier has multiple GSTINs (different branches) and filed under the wrong one, or worse, a fraudulent GSTIN. Verify the supplier's correct GSTIN immediately. If fraudulent, raise a formal dispute on the GST portal. ITC at risk: ${fmtINR(ctx.itcAtRisk)}.`,
        priority: 'high',
        estimatedResolutionDays: 14,
        icon: 'AlertTriangle',
      };

    case 'missing_in_books':
      return {
        key: 'contact_supplier',
        label: 'Locate Invoice',
        reason: 'Invoice exists in GSTR-2B but not in your purchase register — supplier filed, you didn’t record.',
        detail: `Invoice ${ctx.gstr2bInvoiceNo} from ${ctx.gstr2bSupplierGSTIN} appears in GSTR-2B but not in your Books. Locate the original invoice (check emails, hard copies, expense system). If found, record it in the purchase register with the correct GST breakdown. If not found, request a copy from the supplier. ITC of ${fmtINR(ctx.itcAtRisk)} is unclaimed — recoverable once recorded.`,
        priority: 'high',
        estimatedResolutionDays: 3,
        icon: 'Search',
      };

    case 'missing_in_gstr2b':
      // Distinguish "supplier hasn't filed yet" vs "supplier won't file"
      return {
        key: 'wait_for_gstr1',
        label: 'Wait for GSTR-1',
        reason: 'Supplier has not uploaded this invoice to GSTR-2B yet — wait for next filing cycle.',
        detail: `Invoice ${ctx.booksInvoiceNo} from ${ctx.booksSupplierGSTIN} is in your Books but not in GSTR-2B. The supplier has not filed their GSTR-1 for this period yet. Wait until the next GSTR-2B generation (11th of next month). If the supplier misses the deadline, contact them to file ASAP. Do NOT claim ITC until it appears in GSTR-2B — it will be reversed during auto-reconciliation. ITC blocked: ${fmtINR(ctx.itcAtRisk)}.`,
        priority: 'medium',
        estimatedResolutionDays: 30,
        icon: 'Clock',
      };

    case 'duplicate':
      return {
        key: 'ignore_mismatch',
        label: 'Remove Duplicate',
        reason: 'Same invoice appears twice — likely a data-entry or upload duplication.',
        detail: `Invoice ${inv} from ${supplier} appears multiple times. Identify the correct entry and reverse the duplicate. If the duplicate is in your Books, delete the duplicate purchase bill. If on the GSTR-2B side, ask the supplier to amend. Never claim ITC twice on the same invoice — GSTN will flag this during audit.`,
        priority: 'medium',
        estimatedResolutionDays: 2,
        icon: 'Copy',
      };

    default:
      return {
        key: 'contact_supplier',
        label: 'Manual Review',
        reason: 'Unclassified mismatch — needs CA review.',
        detail: `Invoice ${inv} could not be auto-classified. Escalate to your CA for manual review. ITC at risk: ${fmtINR(ctx.itcAtRisk)}.`,
        priority: 'medium',
        estimatedResolutionDays: 5,
        icon: 'UserCheck',
      };
  }
}

/**
 * Get all applicable suggestions for a mismatch (primary + alternatives).
 * Used to populate the "Oracle suggests" action menu in the UI.
 */
export function suggestAllActions(ctx: MatchContext): AISuggestion[] {
  const primary = suggestAction(ctx);

  // Add context-aware alternatives
  const alternatives: AISuggestion[] = [];

  if (ctx.itcAtRisk > 50000) {
    alternatives.push({
      key: 'claim_later',
      label: 'Defer ITC Claim',
      reason: `Large ITC at risk (${fmtINR(ctx.itcAtRisk)}) — consider deferring the claim to a safer period.`,
      detail: `Given the high ITC exposure, defer claiming this invoice's ITC until the mismatch is resolved. You can claim ITC up to the November following the financial year close under Section 16(4).`,
      priority: 'medium',
      estimatedResolutionDays: 60,
      icon: 'Clock',
    });
  }

  if (ctx.status === 'missing_in_gstr2b') {
    alternatives.push({
      key: 'contact_supplier',
      label: 'Email Supplier Now',
      reason: 'Don’t wait — email the supplier immediately so they can include this in their next GSTR-1.',
      detail: `Send a formal email to ${ctx.booksSupplierGSTIN} requesting them to file GSTR-1 with this invoice. The GSTR-1 due date is the 11th of next month.`,
      priority: 'high',
      estimatedResolutionDays: 10,
      icon: 'Mail',
    });
  }

  if (ctx.status === 'gstin_mismatch' || ctx.status === 'duplicate') {
    alternatives.push({
      key: 'raise_dispute',
      label: 'Raise GST Portal Dispute',
      reason: 'Serious discrepancy — raise a formal dispute on the GST portal.',
      detail: `For GSTIN mismatches and duplicates, file a formal dispute on the GST portal. Provide both Books and GSTR-2B screenshots as evidence.`,
      priority: 'high',
      estimatedResolutionDays: 21,
      icon: 'AlertTriangle',
    });
  }

  // Always offer "Ignore" as a last resort
  if (primary.key !== 'ignore_mismatch') {
    alternatives.push({
      key: 'ignore_mismatch',
      label: 'Accept & Ignore',
      reason: 'Mark as accepted — useful for minor differences within tolerance.',
      detail: `Accept the mismatch as-is. Recommended only for differences within ₹100 or for invoices where the ITC at risk is negligible.`,
      priority: 'low',
      estimatedResolutionDays: 0,
      icon: 'CheckCircle2',
    });
  }

  return [primary, ...alternatives];
}
