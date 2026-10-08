// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — GST & ITC Calculator
//
// GST Output Tax = CGST + SGST + IGST + Cess collected on sales invoices
// GST Input Tax (ITC) = GST paid on purchase bills + claimable GST on expenses
// Net GST Liability = Output Tax - Input Tax
//
// This is the ONLY place where GST liability is calculated.
// ═══════════════════════════════════════════════════════════════════════════════

import type { InvoiceRow, PurchaseBillRow, ExpenseRow } from './types';

export interface GSTResult {
  outputTax: number;     // GST collected on sales (your liability)
  inputTax: number;      // GST paid on purchases (your ITC)
  netLiability: number;  // outputTax - inputTax (what you owe)
  itcAvailable: number;  // same as inputTax
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/**
 * Calculates GST position from sales invoices and purchase bills.
 *
 * Output Tax: Sum of CGST+SGST+IGST+Cess from all non-draft, non-cancelled invoices.
 * Input Tax (ITC): Sum of GST from purchase bills + claimable GST from expenses.
 * Net Liability: Output Tax - Input Tax (negative = refund due).
 */
export function calculateGST(
  invoices: InvoiceRow[],
  purchaseBills: PurchaseBillRow[],
  expenses: ExpenseRow[],
): GSTResult {
  let outputCgst = 0;
  let outputSgst = 0;
  let outputIgst = 0;
  let outputCess = 0;

  // ── Output tax from sales invoices ──
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue;
    outputCgst += inv.cgst;
    outputSgst += inv.sgst;
    outputIgst += inv.igst;
    outputCess += inv.cess;
  }

  let inputTax = 0;

  // ── Input tax from purchase bills (ITC) ──
  for (const bill of purchaseBills) {
    if (bill.status === 'cancelled') continue;
    inputTax += bill.gstAmount;
  }

  // ── Claimable GST from expenses ──
  for (const exp of expenses) {
    if (exp.status === 'cancelled') continue;
    if (exp.gstClaimable) {
      inputTax += exp.gst;
    }
  }

  const outputTax = round2(outputCgst + outputSgst + outputIgst + outputCess);
  const netLiability = round2(outputTax - inputTax);

  return {
    outputTax,
    inputTax: round2(inputTax),
    netLiability,
    itcAvailable: round2(inputTax),
    cgst: round2(outputCgst),
    sgst: round2(outputSgst),
    igst: round2(outputIgst),
    cess: round2(outputCess),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
