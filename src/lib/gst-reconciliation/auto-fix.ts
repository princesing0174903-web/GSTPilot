// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Auto-Fix Suggestions for Reconciliation Mismatches
// ═══════════════════════════════════════════════════════════════════════════════
//
// For every mismatch, Oracle generates one or more "Fix Automatically"
// suggestions that the user can preview and apply with one click.
//
// Fix types:
//   • correct_date       — change books invoiceDate to GSTR-2B date
//   • correct_gstin      — change books supplierGSTIN to GSTR-2B GSTIN
//   • merge_duplicate    — merge two duplicate invoices into one
//   • update_taxable     — change books taxableValue to GSTR-2B value
//   • update_tax         — change CGST/SGST/IGST/CESS to GSTR-2B values
//   • create_bill        — create a new purchase bill for missing-in-books
//   • delete_duplicate   — remove the duplicate entry
//
// Each fix includes:
//   • type, label, field
//   • from (current value) → to (new value)
//   • preview (human-readable summary)
//   • severity (safe | moderate | risky)
//   • canAutoApply (true if safe to apply without human review)
//
// Pure functions, no side effects.
// ═══════════════════════════════════════════════════════════════════════════════

import type { MatchStatus } from './match-engine';

export type FixType =
  | 'correct_date'
  | 'correct_gstin'
  | 'merge_duplicate'
  | 'update_taxable'
  | 'update_tax'
  | 'create_bill'
  | 'delete_duplicate';

export type FixSeverity = 'safe' | 'moderate' | 'risky';

export interface FixSuggestion {
  type: FixType;
  label: string;
  field: string;
  from: string;
  to: string;
  preview: string;
  severity: FixSeverity;
  canAutoApply: boolean;
  /** Optional ₹ impact of applying this fix. */
  itcImpact?: number;
}

interface MatchContext {
  status: MatchStatus;
  confidence: number;
  booksInvoiceId: string | null;
  booksInvoiceNo: string | null;
  booksInvoiceDate: string | null;
  gstr2bInvoiceNo: string | null;
  gstr2bInvoiceDate: string | null;
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
  booksCESS: number;
  gstr2bCESS: number;
  itcAtRisk: number;
}

function fmtINR(n: number | null | undefined): string {
  if (n == null) return '—';
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Generate all applicable auto-fix suggestions for a single mismatch.
 * Returns an empty array for perfect matches (no fix needed).
 */
export function generateFixes(ctx: MatchContext): FixSuggestion[] {
  const fixes: FixSuggestion[] = [];

  switch (ctx.status) {
    case 'perfect_match':
      return []; // nothing to fix

    case 'date_mismatch':
      if (ctx.gstr2bInvoiceDate && ctx.booksInvoiceDate && ctx.gstr2bInvoiceDate !== ctx.booksInvoiceDate) {
        fixes.push({
          type: 'correct_date',
          label: 'Correct Invoice Date',
          field: 'invoiceDate',
          from: ctx.booksInvoiceDate,
          to: ctx.gstr2bInvoiceDate,
          preview: `Update books invoice date from ${ctx.booksInvoiceDate} → ${ctx.gstr2bInvoiceDate} to match GSTR-2B.`,
          severity: 'safe',
          canAutoApply: true,
          itcImpact: ctx.itcAtRisk,
        });
      }
      break;

    case 'gstin_mismatch':
      if (ctx.gstr2bSupplierGSTIN && ctx.booksSupplierGSTIN && ctx.gstr2bSupplierGSTIN !== ctx.booksSupplierGSTIN) {
        fixes.push({
          type: 'correct_gstin',
          label: 'Update Supplier GSTIN',
          field: 'supplierGSTIN',
          from: ctx.booksSupplierGSTIN,
          to: ctx.gstr2bSupplierGSTIN,
          preview: `Update books supplier GSTIN from ${ctx.booksSupplierGSTIN} → ${ctx.gstr2bSupplierGSTIN} (as filed by supplier in GSTR-1).`,
          severity: 'moderate',
          canAutoApply: false, // requires verification
          itcImpact: ctx.itcAtRisk,
        });
      }
      break;

    case 'value_mismatch':
      if (Math.abs(ctx.booksTaxableValue - ctx.gstr2bTaxableValue) > 1) {
        fixes.push({
          type: 'update_taxable',
          label: 'Update Taxable Value',
          field: 'taxableValue',
          from: fmtINR(ctx.booksTaxableValue),
          to: fmtINR(ctx.gstr2bTaxableValue),
          preview: `Update books taxable value from ${fmtINR(ctx.booksTaxableValue)} → ${fmtINR(ctx.gstr2bTaxableValue)} to match GSTR-2B.`,
          severity: 'moderate',
          canAutoApply: false, // requires verification (discount adjustment?)
          itcImpact: ctx.itcAtRisk,
        });
      }
      break;

    case 'tax_mismatch': {
      const taxFixes: FixSuggestion[] = [];
      if (Math.abs(ctx.booksCGST - ctx.gstr2bCGST) > 1) {
        taxFixes.push({
          type: 'update_tax',
          label: 'Update CGST',
          field: 'cgst',
          from: fmtINR(ctx.booksCGST),
          to: fmtINR(ctx.gstr2bCGST),
          preview: `Update CGST from ${fmtINR(ctx.booksCGST)} → ${fmtINR(ctx.gstr2bCGST)}.`,
          severity: 'moderate',
          canAutoApply: false,
          itcImpact: Math.abs(ctx.booksCGST - ctx.gstr2bCGST),
        });
      }
      if (Math.abs(ctx.booksSGST - ctx.gstr2bSGST) > 1) {
        taxFixes.push({
          type: 'update_tax',
          label: 'Update SGST',
          field: 'sgst',
          from: fmtINR(ctx.booksSGST),
          to: fmtINR(ctx.gstr2bSGST),
          preview: `Update SGST from ${fmtINR(ctx.booksSGST)} → ${fmtINR(ctx.gstr2bSGST)}.`,
          severity: 'moderate',
          canAutoApply: false,
          itcImpact: Math.abs(ctx.booksSGST - ctx.gstr2bSGST),
        });
      }
      if (Math.abs(ctx.booksIGST - ctx.gstr2bIGST) > 1) {
        taxFixes.push({
          type: 'update_tax',
          label: 'Update IGST',
          field: 'igst',
          from: fmtINR(ctx.booksIGST),
          to: fmtINR(ctx.gstr2bIGST),
          preview: `Update IGST from ${fmtINR(ctx.booksIGST)} → ${fmtINR(ctx.gstr2bIGST)}.`,
          severity: 'moderate',
          canAutoApply: false,
          itcImpact: Math.abs(ctx.booksIGST - ctx.gstr2bIGST),
        });
      }
      if (Math.abs(ctx.booksCESS - ctx.gstr2bCESS) > 1) {
        taxFixes.push({
          type: 'update_tax',
          label: 'Update CESS',
          field: 'cess',
          from: fmtINR(ctx.booksCESS),
          to: fmtINR(ctx.gstr2bCESS),
          preview: `Update CESS from ${fmtINR(ctx.booksCESS)} → ${fmtINR(ctx.gstr2bCESS)}.`,
          severity: 'moderate',
          canAutoApply: false,
          itcImpact: Math.abs(ctx.booksCESS - ctx.gstr2bCESS),
        });
      }
      // Add a combined "update all taxes" fix if multiple differ
      if (taxFixes.length > 1) {
        fixes.push({
          type: 'update_tax',
          label: `Update All Tax Components (${taxFixes.length})`,
          field: 'taxes',
          from: `CGST ${fmtINR(ctx.booksCGST)}, SGST ${fmtINR(ctx.booksSGST)}, IGST ${fmtINR(ctx.booksIGST)}, CESS ${fmtINR(ctx.booksCESS)}`,
          to: `CGST ${fmtINR(ctx.gstr2bCGST)}, SGST ${fmtINR(ctx.gstr2bSGST)}, IGST ${fmtINR(ctx.gstr2bIGST)}, CESS ${fmtINR(ctx.gstr2bCESS)}`,
          preview: `Update all tax components to match GSTR-2B. This will reconcile the invoice perfectly if the supplier's GST treatment is correct.`,
          severity: 'moderate',
          canAutoApply: false,
          itcImpact: ctx.itcAtRisk,
        });
      } else {
        fixes.push(...taxFixes);
      }
      break;
    }

    case 'duplicate':
      fixes.push({
        type: 'merge_duplicate',
        label: 'Merge Duplicate Invoice',
        field: 'invoiceNo',
        from: ctx.booksInvoiceNo || ctx.gstr2bInvoiceNo || '—',
        to: '(single entry)',
        preview: `Merge the duplicate invoice entries into a single record. The system will keep the entry with the higher confidence score and mark the other as reversed.`,
        severity: 'risky',
        canAutoApply: false,
        itcImpact: 0,
      });
      fixes.push({
        type: 'delete_duplicate',
        label: 'Delete Duplicate Entry',
        field: 'invoiceNo',
        from: ctx.booksInvoiceNo || ctx.gstr2bInvoiceNo || '—',
        to: '(deleted)',
        preview: `Delete the duplicate purchase bill from your Books. This is irreversible — use only after verifying which entry is the duplicate.`,
        severity: 'risky',
        canAutoApply: false,
        itcImpact: 0,
      });
      break;

    case 'missing_in_books':
      // Auto-create a draft purchase bill from the GSTR-2B record
      fixes.push({
        type: 'create_bill',
        label: 'Create Purchase Bill',
        field: 'invoiceNo',
        from: '(not in books)',
        to: ctx.gstr2bInvoiceNo || '—',
        preview: `Create a new purchase bill in Books using the GSTR-2B values: taxable ${fmtINR(ctx.gstr2bTaxableValue)}, CGST ${fmtINR(ctx.gstr2bCGST)}, SGST ${fmtINR(ctx.gstr2bSGST)}, IGST ${fmtINR(ctx.gstr2bIGST)}. Supplier: ${ctx.gstr2bSupplierGSTIN}. Mark as draft pending invoice receipt.`,
        severity: 'moderate',
        canAutoApply: false,
        itcImpact: ctx.itcAtRisk,
      });
      break;

    case 'missing_in_gstr2b':
      // No direct fix — supplier must file. But we can mark for follow-up.
      fixes.push({
        type: 'create_bill',
        label: 'Mark for Follow-up',
        field: 'followUp',
        from: '(awaiting supplier)',
        to: 'follow-up flagged',
        preview: `Flag this invoice for follow-up. The supplier (${ctx.booksSupplierGSTIN}) has not uploaded it to GSTR-2B yet. We'll remind you in 7 days to follow up if it's still missing.`,
        severity: 'safe',
        canAutoApply: true,
        itcImpact: ctx.itcAtRisk,
      });
      break;
  }

  return fixes;
}

/**
 * Apply a single fix to a books invoice (in-memory, no DB writes here).
 * The API route is responsible for persisting changes.
 */
export function applyFixToBooks(
  book: {
    invoiceDate?: string;
    supplierGSTIN: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
  },
  fix: FixSuggestion,
  gstr2b: {
    invoiceDate?: string;
    supplierGSTIN: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
  },
): { updated: typeof book; applied: FixSuggestion } {
  const updated = { ...book };

  switch (fix.type) {
    case 'correct_date':
      updated.invoiceDate = gstr2b.invoiceDate;
      break;
    case 'correct_gstin':
      updated.supplierGSTIN = gstr2b.supplierGSTIN;
      break;
    case 'update_taxable':
      updated.taxableValue = gstr2b.taxableValue;
      break;
    case 'update_tax':
      if (fix.field === 'cgst' || fix.field === 'taxes') updated.cgst = gstr2b.cgst;
      if (fix.field === 'sgst' || fix.field === 'taxes') updated.sgst = gstr2b.sgst;
      if (fix.field === 'igst' || fix.field === 'taxes') updated.igst = gstr2b.igst;
      if (fix.field === 'cess' || fix.field === 'taxes') updated.cess = gstr2b.cess;
      break;
    // merge_duplicate, delete_duplicate, create_bill are handled at the DB level
  }

  return { updated, applied: fix };
}
