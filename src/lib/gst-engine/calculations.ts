// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot GST Return Engine™ — Calculation Engine
//
// Pure functions for all GST math. NO Firebase imports, NO client-only code.
// Safe to import from both client and server.
//
// Every function is deterministic — given the same inputs, the same output.
// All monetary values are rounded to 2 decimal places.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  GSTTransaction,
  GSTSummary,
  ITCSummary,
  GSTInvoiceType,
  GSTTransactionType,
} from './types';
import type { Invoice } from '@/lib/invoice-engine/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Round to 2 decimal places. */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Derive the filing period (YYYY-MM) from an ISO date string.
 */
export function deriveFilingPeriod(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

/**
 * Derive the Indian financial year (Apr–Mar) from an ISO date string.
 * Returns format like "FY2024-25".
 */
export function deriveFinancialYear(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0=Jan, 3=Apr
  // FY starts April 1: Jan-Mar belong to the previous FY
  const fyStart = month < 3 ? year - 1 : year;
  const fyEnd = fyStart + 1;
  const endShort = String(fyEnd).slice(2);
  return `FY${fyStart}-${endShort}`;
}

/**
 * Determine if a supply is inter-state (IGST) or intra-state (CGST+SGST).
 * Inter-state when seller and customer are in different states.
 */
export function isInterState(
  sellerStateCode: string | null,
  customerStateCode: string | null,
): boolean {
  if (!sellerStateCode || !customerStateCode) return false;
  return sellerStateCode !== customerStateCode;
}

// ─── Core GST Calculation ────────────────────────────────────────────────────

/**
 * Calculate GST for a given taxable value and rate.
 *   • Inter-state  → IGST only
 *   • Intra-state  → CGST + SGST (split equally)
 *
 * Returns all components rounded to 2 decimal places.
 */
export function calculateGST(
  taxableValue: number,
  gstRate: number,
  interState: boolean,
  cessRate = 0,
): { cgst: number; sgst: number; igst: number; cess: number; totalTax: number } {
  if (interState) {
    const igst = r2((taxableValue * gstRate) / 100);
    const cess = r2((taxableValue * cessRate) / 100);
    return { cgst: 0, sgst: 0, igst, cess, totalTax: r2(igst + cess) };
  }
  const half = r2((taxableValue * gstRate) / 200);
  const cess = r2((taxableValue * cessRate) / 100);
  return { cgst: half, sgst: half, igst: 0, cess, totalTax: r2(half * 2 + cess) };
}

// ─── Invoice → GST Transaction ───────────────────────────────────────────────

/**
 * Determine the GSTR-1 invoice type from an invoice's fields.
 */
function classifyInvoice(
  customerGstin: string | null,
  grandTotal: number,
  interState: boolean,
  gstRate: number,
): GSTInvoiceType {
  if (gstRate === 0) return 'nil';
  if (!customerGstin) {
    // B2C — large if inter-state and > ₹2.5L, else small
    if (interState && grandTotal > 250000) return 'b2c_large';
    return 'b2c_small';
  }
  return 'b2b';
}

/**
 * Convert a sales Invoice into a GSTTransaction (without id/timestamps/status).
 * The caller adds organizationId, createdBy, timestamps, and status.
 */
export function calculateInvoiceGST(invoice: Invoice): Omit<
  GSTTransaction,
  'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'
> {
  const interState = isInterState(invoice.sellerStateCode, invoice.customerStateCode);
  const invoiceType = classifyInvoice(
    invoice.customerGstin,
    invoice.grandTotal,
    interState,
    invoice.items[0]?.gstRate ?? 0,
  );
  const totalTax = r2(invoice.cgst + invoice.sgst + invoice.igst + invoice.cess);

  return {
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    customerGstin: invoice.customerGstin,
    customerStateCode: invoice.customerStateCode,
    sellerGstin: invoice.sellerGstin,
    sellerStateCode: invoice.sellerStateCode,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    transactionType: 'sales',
    invoiceType,
    isInterState: interState,
    gstRate: invoice.items[0]?.gstRate ?? 0,
    taxableValue: r2(invoice.taxableValue),
    cgst: r2(invoice.cgst),
    sgst: r2(invoice.sgst),
    igst: r2(invoice.igst),
    cess: r2(invoice.cess),
    totalTax,
    grandTotal: r2(invoice.grandTotal),
    itcEligible: false,
    reverseCharge: false,
    composition: false,
    filingPeriod: deriveFilingPeriod(invoice.invoiceDate),
    financialYear: deriveFinancialYear(invoice.invoiceDate),
  };
}

/**
 * Convert a purchase Invoice into a GSTTransaction with ITC eligibility.
 */
export function calculatePurchaseGST(invoice: Invoice): Omit<
  GSTTransaction,
  'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'
> {
  const base = calculateInvoiceGST(invoice);
  return {
    ...base,
    transactionType: 'purchase',
    itcEligible: true, // purchases are ITC-eligible by default
  };
}

// ─── ITC Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate Input Tax Credit summary from a list of transactions.
 * Only purchase-type transactions contribute to ITC.
 */
export function calculateITC(transactions: GSTTransaction[]): ITCSummary {
  let eligibleCGST = 0;
  let eligibleSGST = 0;
  let eligibleIGST = 0;
  let eligibleCess = 0;
  let blockedITC = 0;
  let reverseChargeITC = 0;

  for (const txn of transactions) {
    if (txn.transactionType !== 'purchase') continue;

    if (txn.itcEligible) {
      eligibleCGST += txn.cgst;
      eligibleSGST += txn.sgst;
      eligibleIGST += txn.igst;
      eligibleCess += txn.cess;
    } else {
      blockedITC += txn.totalTax;
    }

    if (txn.reverseCharge) {
      reverseChargeITC += txn.totalTax;
    }
  }

  const eligibleITC = r2(eligibleCGST + eligibleSGST + eligibleIGST + eligibleCess);

  return {
    eligibleITC,
    blockedITC: r2(blockedITC),
    reverseChargeITC: r2(reverseChargeITC),
    pendingITC: 0, // can't determine without GSTR-2B matching
    usedITC: 0, // tracked separately via ledger
    remainingITC: eligibleITC, // eligibleITC - usedITC (usedITC = 0)
    eligibleCGST: r2(eligibleCGST),
    eligibleSGST: r2(eligibleSGST),
    eligibleIGST: r2(eligibleIGST),
    eligibleCess: r2(eligibleCess),
  };
}

// ─── Liability Calculation ───────────────────────────────────────────────────

/**
 * Calculate the net GST liability from transactions.
 *   outputTax  = sales + debit notes
 *   inputTax   = eligible ITC from purchases
 *   adjustments = credit notes (negative) + debit notes (positive)
 *   netLiability = max(0, outputTax - inputTax + adjustments)
 */
export function calculateLiability(transactions: GSTTransaction[]): {
  outputTax: number;
  inputTax: number;
  adjustments: number;
  netLiability: number;
} {
  let outputTax = 0;
  let inputTax = 0;
  let creditNoteTax = 0;
  let debitNoteTax = 0;

  for (const txn of transactions) {
    if (txn.transactionType === 'sales') {
      outputTax += txn.totalTax;
    } else if (txn.transactionType === 'purchase' && txn.itcEligible) {
      inputTax += txn.totalTax;
    } else if (txn.transactionType === 'credit_note') {
      creditNoteTax += txn.totalTax; // reduces liability
    } else if (txn.transactionType === 'debit_note') {
      debitNoteTax += txn.totalTax; // increases liability
    }
  }

  const adjustments = r2(debitNoteTax - creditNoteTax);
  const netLiability = r2(Math.max(0, outputTax - inputTax + adjustments));

  return {
    outputTax: r2(outputTax),
    inputTax: r2(inputTax),
    adjustments,
    netLiability,
  };
}

// ─── Reverse Charge Calculation ──────────────────────────────────────────────

/**
 * Calculate reverse-charge liability and ITC.
 */
export function calculateReverseCharge(transactions: GSTTransaction[]): {
  reverseChargeLiability: number;
  reverseChargeITC: number;
} {
  let liability = 0;
  let itc = 0;

  for (const txn of transactions) {
    if (!txn.reverseCharge) continue;
    if (txn.transactionType === 'sales' || txn.transactionType === 'debit_note') {
      liability += txn.totalTax;
    }
    if (txn.transactionType === 'purchase' && txn.itcEligible) {
      itc += txn.totalTax;
    }
  }

  return {
    reverseChargeLiability: r2(liability),
    reverseChargeITC: r2(itc),
  };
}

// ─── Composition Scheme Calculation ──────────────────────────────────────────

/**
 * Calculate composition scheme tax (flat rate on turnover).
 * Composition dealers pay a flat % of turnover instead of regular GST.
 */
export function calculateComposition(
  transactions: GSTTransaction[],
  compositionRate = 1,
): {
  compositionTax: number;
  totalTurnover: number;
  compositionRate: number;
} {
  let totalTurnover = 0;
  for (const txn of transactions) {
    if (txn.composition && (txn.transactionType === 'sales' || txn.transactionType === 'debit_note')) {
      totalTurnover += txn.taxableValue;
    }
  }
  return {
    totalTurnover: r2(totalTurnover),
    compositionRate,
    compositionTax: r2((totalTurnover * compositionRate) / 100),
  };
}

// ─── GST Summary (the big one) ───────────────────────────────────────────────

/**
 * Generate a comprehensive GST summary from a list of transactions.
 *
 * This is the CACHED aggregate — recompute only when transactions change.
 * The `period` parameter is stamped onto the result for context.
 */
export function generateGSTSummary(
  transactions: GSTTransaction[],
  period: string,
): GSTSummary {
  let taxableSales = 0;
  let cgstCollected = 0;
  let sgstCollected = 0;
  let igstCollected = 0;
  let cessCollected = 0;

  let taxablePurchases = 0;
  let cgstPaid = 0;
  let sgstPaid = 0;
  let igstPaid = 0;
  let cessPaid = 0;

  let creditNoteTax = 0;
  let debitNoteTax = 0;

  let salesCount = 0;
  let purchaseCount = 0;
  let creditNoteCount = 0;
  let debitNoteCount = 0;

  const byGstRate: Record<string, { taxableValue: number; tax: number; count: number }> = {};
  const byInvoiceType: Record<GSTInvoiceType, { taxableValue: number; tax: number; count: number }> = {
    b2b: { taxableValue: 0, tax: 0, count: 0 },
    b2c_large: { taxableValue: 0, tax: 0, count: 0 },
    b2c_small: { taxableValue: 0, tax: 0, count: 0 },
    exports: { taxableValue: 0, tax: 0, count: 0 },
    nil: { taxableValue: 0, tax: 0, count: 0 },
  };

  for (const txn of transactions) {
    // By GST rate
    const rateKey = String(txn.gstRate);
    if (!byGstRate[rateKey]) byGstRate[rateKey] = { taxableValue: 0, tax: 0, count: 0 };
    byGstRate[rateKey].taxableValue += txn.taxableValue;
    byGstRate[rateKey].tax += txn.totalTax;
    byGstRate[rateKey].count += 1;

    // By invoice type
    byInvoiceType[txn.invoiceType].taxableValue += txn.taxableValue;
    byInvoiceType[txn.invoiceType].tax += txn.totalTax;
    byInvoiceType[txn.invoiceType].count += 1;

    switch (txn.transactionType) {
      case 'sales':
        taxableSales += txn.taxableValue;
        cgstCollected += txn.cgst;
        sgstCollected += txn.sgst;
        igstCollected += txn.igst;
        cessCollected += txn.cess;
        salesCount += 1;
        break;
      case 'purchase':
        taxablePurchases += txn.taxableValue;
        cgstPaid += txn.cgst;
        sgstPaid += txn.sgst;
        igstPaid += txn.igst;
        cessPaid += txn.cess;
        purchaseCount += 1;
        break;
      case 'credit_note':
        creditNoteTax += txn.totalTax;
        creditNoteCount += 1;
        break;
      case 'debit_note':
        debitNoteTax += txn.totalTax;
        debitNoteCount += 1;
        break;
    }
  }

  const totalOutputTax = r2(cgstCollected + sgstCollected + igstCollected + cessCollected);
  const totalInputTax = r2(cgstPaid + sgstPaid + igstPaid + cessPaid);
  const liability = calculateLiability(transactions);
  const netLiability = liability.netLiability;

  // Outstanding GST = net liability not yet paid (we don't track payments yet,
  // so outstanding = net liability)
  const outstandingGST = netLiability;

  // Health score (0-100):
  //   • Start at 100
  //   • -10 if no transactions (inactivity)
  //   • -5 if output tax is 0 but has sales (possible nil-rated without filing)
  //   • -15 if liability > 0 and no ITC (cash flow risk)
  //   • +5 bonus if ITC > 0 (healthy input credit)
  //   • Clamp to 0-100
  let healthScore = 100;
  if (transactions.length === 0) healthScore -= 10;
  if (totalOutputTax === 0 && salesCount > 0) healthScore -= 5;
  if (netLiability > 0 && totalInputTax === 0) healthScore -= 15;
  if (totalInputTax > 0) healthScore += 5;
  healthScore = Math.max(0, Math.min(100, healthScore));

  // Round all byGstRate and byInvoiceType values
  for (const key of Object.keys(byGstRate)) {
    byGstRate[key].taxableValue = r2(byGstRate[key].taxableValue);
    byGstRate[key].tax = r2(byGstRate[key].tax);
  }
  for (const key of Object.keys(byInvoiceType) as GSTInvoiceType[]) {
    byInvoiceType[key].taxableValue = r2(byInvoiceType[key].taxableValue);
    byInvoiceType[key].tax = r2(byInvoiceType[key].tax);
  }

  return {
    period,
    taxableSales: r2(taxableSales),
    cgstCollected: r2(cgstCollected),
    sgstCollected: r2(sgstCollected),
    igstCollected: r2(igstCollected),
    cessCollected: r2(cessCollected),
    totalOutputTax,
    taxablePurchases: r2(taxablePurchases),
    cgstPaid: r2(cgstPaid),
    sgstPaid: r2(sgstPaid),
    igstPaid: r2(igstPaid),
    cessPaid: r2(cessPaid),
    totalInputTax,
    creditNoteTax: r2(creditNoteTax),
    debitNoteTax: r2(debitNoteTax),
    netLiability,
    outstandingGST,
    healthScore,
    totalTransactions: transactions.length,
    salesCount,
    purchaseCount,
    creditNoteCount,
    debitNoteCount,
    byGstRate,
    byInvoiceType,
  };
}
