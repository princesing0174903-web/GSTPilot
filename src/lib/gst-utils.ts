import { InvoiceType, GSTR1Section, INVOICE_TYPE_TO_SECTION } from '@/types/gst';

export function validateGSTIN(gstin: string): boolean {
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.toUpperCase());
}

export function formatGSTIN(gstin: string): string {
  return gstin.toUpperCase().replace(/\s/g, '');
}

export function getGSTR1Section(invoiceType: InvoiceType): GSTR1Section {
  return INVOICE_TYPE_TO_SECTION[invoiceType];
}

export function classifyInvoice(invoice: {
  buyerGstin?: string;
  totalAmount: number;
  invoiceType: string;
  igst: number;
}): InvoiceType {
  if (invoice.invoiceType === 'Credit Note') return 'Credit Note';
  if (invoice.invoiceType === 'Debit Note') return 'Debit Note';
  if (invoice.igst > 0 && !invoice.buyerGstin) return 'Export';
  if (invoice.buyerGstin) return 'B2B';
  if (invoice.totalAmount >= 250000) return 'B2C Large';
  return 'B2C Small';
}

/**
 * @deprecated Phase 3 audit (P3-GST-ENGINES) found ZERO callers of this
 * function across src/. The CANONICAL GST calculation engine is
 * `calculateInvoiceTotals` in `src/lib/invoices/invoices-utils.ts`. This
 * function is retained only for API-surface backward compatibility and will
 * be removed in a future release. Do NOT call this in new code — it does not
 * handle CESS, discount, rounding, or multi-line items.
 */
export function calculateTax(taxableValue: number, cgstRate: number, sgstRate: number, isInterState: boolean): {
  cgst: number;
  sgst: number;
  igst: number;
} {
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: taxableValue * (cgstRate + sgstRate) / 100 };
  }
  return {
    cgst: taxableValue * cgstRate / 100,
    sgst: taxableValue * sgstRate / 100,
    igst: 0,
  };
}

/**
 * Calculate the GST DATA-QUALITY score (0-100) for a single client.
 *
 * This measures GST-filing data quality — NOT business financial health.
 * Inputs are GST-specific quality issues: missing GSTINs, invalid GSTINs,
 * duplicate invoices, filing delays, validation errors.
 *
 * RENAMED from `calculateHealthScore` (see AUDIT-DUP-1 + task HEALTH-ENGINE)
 * to disambiguate from the CANONICAL business Health Score in
 * `src/lib/business/snapshot.ts` → `computeHealthScore()`. The two functions
 * have completely different semantics: this one is per-client GST data
 * quality, the canonical one is per-org financial health.
 *
 * A deprecated `calculateHealthScore` alias is re-exported below for any
 * legacy consumers that haven't been migrated yet — new code MUST use the
 * new name.
 */
export function calculateGSTDataQualityScore(params: {
  totalInvoices: number;
  missingGstin: number;
  invalidGstin: number;
  duplicateInvoices: number;
  filingDelays: number;
  validationErrors: number;
}): number {
  const { totalInvoices, missingGstin, invalidGstin, duplicateInvoices, filingDelays, validationErrors } = params;
  if (totalInvoices === 0) return 100;
  const deductions =
    (missingGstin * 5) +
    (invalidGstin * 10) +
    (duplicateInvoices * 8) +
    (filingDelays * 3) +
    (validationErrors * 2);
  return Math.max(0, Math.min(100, 100 - deductions));
}

/**
 * @deprecated Use {@link calculateGSTDataQualityScore} instead. The CANONICAL
 * business Health Score lives in `src/lib/business/snapshot.ts`. This alias
 * is kept only for legacy consumers; it computes GST data quality (NOT
 * business financial health).
 */
export const calculateHealthScore = calculateGSTDataQualityScore;

/**
 * Calculate the GST RECONCILIATION risk score (0-100) for a single invoice.
 *
 * This measures the risk that a single invoice's books-vs-GSTR-2B match is
 * incorrect — NOT the overall business risk.
 *
 * RENAMED from `calculateRiskScore` (see AUDIT-DUP-1 + task HEALTH-ENGINE)
 * to disambiguate from the CANONICAL business Risk Score in
 * `src/lib/business/snapshot.ts` → `computeRiskScore()`. The two functions
 * have completely different semantics: this one is per-invoice GST
 * reconciliation risk, the canonical one is per-org business risk.
 *
 * A deprecated `calculateRiskScore` alias is re-exported below for any
 * legacy consumers that haven't been migrated yet — new code MUST use the
 * new name.
 */
export function calculateReconciliationRiskScore(params: {
  matchStatus: string;
  taxDifference: number;
  dateDifference: number;
  gstinValid: boolean;
  isDuplicate: boolean;
}): number {
  let score = 0;
  if (params.matchStatus === 'mismatch') score += 40;
  if (params.matchStatus === 'missing_in_books') score += 60;
  if (params.matchStatus === 'missing_in_gstr') score += 50;
  if (params.taxDifference > 0) score += Math.min(30, Math.floor(params.taxDifference / 100));
  if (params.dateDifference > 30) score += 15;
  if (!params.gstinValid) score += 25;
  if (params.isDuplicate) score += 20;
  return Math.min(100, score);
}

/**
 * @deprecated Use {@link calculateReconciliationRiskScore} instead. The
 * CANONICAL business Risk Score lives in `src/lib/business/snapshot.ts`.
 * This alias is kept only for legacy consumers; it computes per-invoice
 * GST reconciliation risk (NOT business financial risk).
 */
export const calculateRiskScore = calculateReconciliationRiskScore;

export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a currency amount with full 2-decimal precision — use for invoice
 * line items, totals, and PDF/export where paisa precision is required.
 */
export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Format an ISO date string (YYYY-MM-DD or full ISO) as DD MMM YYYY.
 * Returns '—' if the input is empty/invalid.
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Format an ISO date string as DD MMM YYYY HH:MM (for timestamps).
 */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '—';
  }
}

export function generateMismatchExplanation(mismatches: string[]): string {
  if (mismatches.length === 0) return 'No mismatches detected.';
  const explanations: string[] = [];
  for (const m of mismatches) {
    switch (m) {
      case 'tax_mismatch':
        explanations.push('Tax amount in books does not match the amount in GSTR-2B data.');
        break;
      case 'gst_mismatch':
        explanations.push('GSTIN of the counterparty does not match between books and GST portal data.');
        break;
      case 'date_mismatch':
        explanations.push('Invoice date differs between books and GST records by more than 30 days.');
        break;
      case 'amount_mismatch':
        explanations.push('Total invoice amount shows a discrepancy between books and GST portal.');
        break;
      case 'missing_in_books':
        explanations.push('This invoice appears in GSTR-2B but is not recorded in the purchase register.');
        break;
      case 'missing_in_gstr':
        explanations.push('This invoice exists in books but does not appear in GSTR-2B data.');
        break;
      case 'duplicate':
        explanations.push('A duplicate invoice with the same number and GSTIN has been detected.');
        break;
      case 'invalid_gstin':
        explanations.push('The GSTIN format is invalid and does not pass checksum validation.');
        break;
      default:
        explanations.push(`Issue: ${m}`);
    }
  }
  return explanations.join(' ');
}

/**
 * Parse a period string into { year, month }.
 * Accepts both canonical "YYYY-MM" (e.g. "2024-11") and legacy "MM-YYYY"
 * (e.g. "11-2024"). Returns { year: 0, month: 0 } for invalid input so
 * downstream code never crashes on `undefined`.
 */
function parsePeriod(period: string): { year: number; month: number } {
  if (!period || typeof period !== 'string') return { year: 0, month: 0 };
  const parts = period.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return { year: 0, month: 0 };
  }
  // If the first part is > 31, it's a year → YYYY-MM.
  if (parts[0] > 31) return { year: parts[0], month: parts[1] };
  // Otherwise MM-YYYY (legacy).
  return { year: parts[1], month: parts[0] };
}

export function getFilingDueDate(returnType: string, period: string): string {
  const { year, month } = parsePeriod(period);
  if (!year || !month) return '';
  // GSTR-1: 11th of next month; GSTR-3B: 20th of next month.
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const day = returnType === 'GSTR-1' ? 11 : 20;
  const dueDate = new Date(nextYear, nextMonth - 1, day);
  return dueDate.toISOString().split('T')[0];
}

export function getFinancialYear(period: string): string {
  const { year, month } = parsePeriod(period);
  if (!year || !month) return '';
  if (month >= 4) return `${year}-${(year + 1).toString().slice(2)}`;
  return `${year - 1}-${year.toString().slice(2)}`;
}

export function periodToLabel(period: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const { year, month } = parsePeriod(period);
  if (!year || !month) return period || '';
  return `${months[month - 1]} ${year}`;
}

export function isOverdue(period: string): boolean {
  const dueDate = getFilingDueDate('GSTR-1', period);
  if (!dueDate) return false;
  return new Date() > new Date(dueDate);
}
