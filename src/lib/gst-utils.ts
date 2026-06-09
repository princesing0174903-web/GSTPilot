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

export function calculateHealthScore(params: {
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

export function calculateRiskScore(params: {
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
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
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

export function getFilingDueDate(returnType: string, period: string): string {
  const [year, month] = period.split('-').map(Number);
  const dueDate = new Date(year, month, 11);
  return dueDate.toISOString().split('T')[0];
}

export function getFinancialYear(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (month >= 4) return `${year}-${(year + 1).toString().slice(2)}`;
  return `${year - 1}-${year.toString().slice(2)}`;
}

export function periodToLabel(period: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = period.split('-').map(Number);
  return `${months[month - 1]} ${year}`;
}

export function isOverdue(period: string): boolean {
  const dueDate = getFilingDueDate('GSTR-1', period);
  return new Date() > new Date(dueDate);
}
