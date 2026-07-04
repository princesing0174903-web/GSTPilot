// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot GST Return Engine™ — Return Preparation
//
// Pure functions that prepare GSTR-1, GSTR-3B, and GSTR-9 draft data from
// GSTTransactions. These are DRAFT ONLY — they are NOT filed to GSTN.
//
// NO Firebase imports, NO client-only code. Safe for client + server.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  GSTTransaction,
  GSTR1Draft,
  GSTR3BDraft,
  GSTR9Draft,
} from './types';
import { deriveFinancialYear, calculateITC, calculateLiability } from './calculations';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── GSTR-1 Preparation ──────────────────────────────────────────────────────

/**
 * Prepare a GSTR-1 draft (outward supplies) for a given period.
 *
 * Sections:
 *   • b2b  — Business-to-Business invoices (customer has GSTIN)
 *   • b2cl — B2C Large (inter-state, > ₹2.5L)
 *   • b2cs — B2C Small (aggregated by GST rate)
 *   • creditDebitNotes — Credit/debit note adjustments
 *   • nilRated — Nil-rated / exempt / non-GST supplies
 *
 * NOT filed to GSTN — draft data only.
 */
export function prepareGSTR1(
  transactions: GSTTransaction[],
  period: string,
): GSTR1Draft {
  // Filter transactions for this period (sales + credit/debit notes)
  const periodTxns = transactions.filter(
    (t) =>
      t.filingPeriod === period &&
      (t.transactionType === 'sales' ||
        t.transactionType === 'credit_note' ||
        t.transactionType === 'debit_note'),
  );

  const b2b: GSTR1Draft['b2b'] = [];
  const b2cl: GSTR1Draft['b2cl'] = [];
  const b2csAgg: Record<string, { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number; count: number }> = {};
  const creditDebitNotes: GSTR1Draft['creditDebitNotes'] = [];
  let nilExempt = 0;
  let nilRated = 0;
  let nonGST = 0;

  for (const txn of periodTxns) {
    if (txn.transactionType === 'credit_note' || txn.transactionType === 'debit_note') {
      creditDebitNotes.push({
        type: txn.transactionType,
        customerGstin: txn.customerGstin ?? '',
        noteNumber: txn.invoiceNumber,
        noteDate: txn.invoiceDate,
        taxableValue: r2(txn.taxableValue),
        igst: r2(txn.igst),
        cgst: r2(txn.cgst),
        sgst: r2(txn.sgst),
        cess: r2(txn.cess),
        gstRate: txn.gstRate,
      });
      continue;
    }

    // Sales
    switch (txn.invoiceType) {
      case 'b2b':
        b2b.push({
          customerGstin: txn.customerGstin ?? '',
          customerName: txn.customerName,
          invoiceNumber: txn.invoiceNumber,
          invoiceDate: txn.invoiceDate,
          taxableValue: r2(txn.taxableValue),
          igst: r2(txn.igst),
          cgst: r2(txn.cgst),
          sgst: r2(txn.sgst),
          cess: r2(txn.cess),
          gstRate: txn.gstRate,
          reverseCharge: txn.reverseCharge,
        });
        break;
      case 'b2c_large':
        b2cl.push({
          invoiceNumber: txn.invoiceNumber,
          invoiceDate: txn.invoiceDate,
          taxableValue: r2(txn.taxableValue),
          igst: r2(txn.igst),
          cess: r2(txn.cess),
          gstRate: txn.gstRate,
        });
        break;
      case 'b2c_small': {
        const rateKey = String(txn.gstRate);
        if (!b2csAgg[rateKey]) {
          b2csAgg[rateKey] = { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, count: 0 };
        }
        b2csAgg[rateKey].taxableValue += txn.taxableValue;
        b2csAgg[rateKey].igst += txn.igst;
        b2csAgg[rateKey].cgst += txn.cgst;
        b2csAgg[rateKey].sgst += txn.sgst;
        b2csAgg[rateKey].cess += txn.cess;
        b2csAgg[rateKey].count += 1;
        break;
      }
      case 'nil':
        nilRated += txn.taxableValue;
        break;
      case 'exports':
        // Exports appear in a separate section but we include them in b2b-like
        b2b.push({
          customerGstin: 'URP', // Unregistered Person for exports
          customerName: txn.customerName || 'Export',
          invoiceNumber: txn.invoiceNumber,
          invoiceDate: txn.invoiceDate,
          taxableValue: r2(txn.taxableValue),
          igst: r2(txn.igst),
          cgst: 0,
          sgst: 0,
          cess: r2(txn.cess),
          gstRate: txn.gstRate,
          reverseCharge: false,
        });
        break;
    }
  }

  // Build b2cs array from aggregation
  const b2cs: GSTR1Draft['b2cs'] = Object.entries(b2csAgg).map(([rate, agg]) => ({
    taxableValue: r2(agg.taxableValue),
    igst: r2(agg.igst),
    cgst: r2(agg.cgst),
    sgst: r2(agg.sgst),
    cess: r2(agg.cess),
    gstRate: Number(rate),
  }));

  // Compute totals
  let totalTaxable = 0;
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalCess = 0;
  let invoiceCount = 0;

  for (const t of periodTxns) {
    totalTaxable += t.taxableValue;
    totalIgst += t.igst;
    totalCgst += t.cgst;
    totalSgst += t.sgst;
    totalCess += t.cess;
    if (t.transactionType === 'sales') invoiceCount += 1;
  }

  return {
    period,
    financialYear: deriveFinancialYear(period + '-01'),
    b2b,
    b2cl,
    b2cs,
    creditDebitNotes,
    nilRated: { exempt: r2(nilExempt), nilRated: r2(nilRated), nonGST: 0 },
    totals: {
      taxableValue: r2(totalTaxable),
      igst: r2(totalIgst),
      cgst: r2(totalCgst),
      sgst: r2(totalSgst),
      cess: r2(totalCess),
      totalTax: r2(totalIgst + totalCgst + totalSgst + totalCess),
      invoiceCount,
    },
  };
}

// ─── GSTR-3B Preparation ─────────────────────────────────────────────────────

/**
 * Prepare a GSTR-3B draft (monthly summary return) for a given period.
 *
 * Sections:
 *   • 3.1 — Outward supplies (tax liability)
 *   • 3.2 — Inward supplies (ITC)
 *   • 4   — Net tax liability (output – input)
 *   • 5   — Tax paid (all zeros — draft, not yet paid)
 *
 * NOT filed to GSTN — draft data only.
 */
export function prepareGSTR3B(
  transactions: GSTTransaction[],
  period: string,
): GSTR3BDraft {
  const periodTxns = transactions.filter((t) => t.filingPeriod === period);

  // 3.1 — Outward supplies
  let outTaxable = 0;
  let outIgst = 0;
  let outCgst = 0;
  let outSgst = 0;
  let outCess = 0;

  for (const t of periodTxns) {
    if (t.transactionType === 'sales' || t.transactionType === 'debit_note') {
      outTaxable += t.taxableValue;
      outIgst += t.igst;
      outCgst += t.cgst;
      outSgst += t.sgst;
      outCess += t.cess;
    } else if (t.transactionType === 'credit_note') {
      // Credit notes reduce output tax
      outTaxable -= t.taxableValue;
      outIgst -= t.igst;
      outCgst -= t.cgst;
      outSgst -= t.sgst;
      outCess -= t.cess;
    }
  }

  // 3.2 — ITC from purchases
  const itc = calculateITC(periodTxns);
  const ineligibleITC = itc.blockedITC + itc.reverseChargeITC;
  const totalITC = itc.eligibleITC + ineligibleITC;

  // 4 — Net liability (per tax type, min 0)
  const netIgst = Math.max(0, outIgst - itc.eligibleIGST);
  const netCgst = Math.max(0, outCgst - itc.eligibleCGST);
  const netSgst = Math.max(0, outSgst - itc.eligibleSGST);
  const netCess = Math.max(0, outCess - itc.eligibleCess);

  return {
    period,
    outwardSupplies: {
      taxableValue: r2(outTaxable),
      igst: r2(outIgst),
      cgst: r2(outCgst),
      sgst: r2(outSgst),
      cess: r2(outCess),
    },
    itc: {
      eligibleCGST: r2(itc.eligibleCGST),
      eligibleSGST: r2(itc.eligibleSGST),
      eligibleIGST: r2(itc.eligibleIGST),
      eligibleCess: r2(itc.eligibleCess),
      ineligibleITC: r2(ineligibleITC),
      totalITC: r2(totalITC),
    },
    netLiability: {
      igst: r2(netIgst),
      cgst: r2(netCgst),
      sgst: r2(netSgst),
      cess: r2(netCess),
    },
    // 5 — Tax paid (all zeros — this is a draft, not yet filed/paid)
    taxPaid: {
      byCash: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      byITC: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    },
  };
}

// ─── GSTR-9 Preparation ──────────────────────────────────────────────────────

/**
 * Prepare a GSTR-9 draft (annual consolidation) for a given financial year.
 *
 * Parts:
 *   • Part II — Outward supplies (annual)
 *   • Part III — Inward supplies (annual)
 *   • Part IV — ITC (annual)
 *   • Part V — Tax paid (annual)
 *
 * NOT filed to GSTN — draft data only.
 */
export function prepareGSTR9(
  transactions: GSTTransaction[],
  financialYear: string,
): GSTR9Draft {
  const fyTxns = transactions.filter((t) => t.financialYear === financialYear);

  // Part II — Outward supplies
  let outTaxable = 0;
  let outIgst = 0;
  let outCgst = 0;
  let outSgst = 0;
  let outCess = 0;

  // Part III — Inward supplies
  let inTaxable = 0;
  let inIgst = 0;
  let inCgst = 0;
  let inSgst = 0;
  let inCess = 0;

  for (const t of fyTxns) {
    if (t.transactionType === 'sales' || t.transactionType === 'debit_note') {
      outTaxable += t.taxableValue;
      outIgst += t.igst;
      outCgst += t.cgst;
      outSgst += t.sgst;
      outCess += t.cess;
    } else if (t.transactionType === 'credit_note') {
      outTaxable -= t.taxableValue;
      outIgst -= t.igst;
      outCgst -= t.cgst;
      outSgst -= t.sgst;
      outCess -= t.cess;
    } else if (t.transactionType === 'purchase') {
      inTaxable += t.taxableValue;
      inIgst += t.igst;
      inCgst += t.cgst;
      inSgst += t.sgst;
      inCess += t.cess;
    }
  }

  // Part IV — ITC
  const itc = calculateITC(fyTxns);
  const totalITC = itc.eligibleITC + itc.blockedITC;
  const netITC = itc.eligibleITC;

  // Part V — Tax paid
  const liability = calculateLiability(fyTxns);
  const totalLiability = liability.netLiability;
  const paidByITC = Math.min(totalLiability, itc.eligibleITC);
  const paidByCash = Math.max(0, totalLiability - paidByITC);

  return {
    financialYear,
    outwardSupplies: {
      taxableValue: r2(outTaxable),
      igst: r2(outIgst),
      cgst: r2(outCgst),
      sgst: r2(outSgst),
      cess: r2(outCess),
    },
    inwardSupplies: {
      taxableValue: r2(inTaxable),
      igst: r2(inIgst),
      cgst: r2(inCgst),
      sgst: r2(inSgst),
      cess: r2(inCess),
      itcClaimed: r2(netITC),
    },
    itc: {
      totalITC: r2(totalITC),
      ineligibleITC: r2(itc.blockedITC),
      netITC: r2(netITC),
    },
    taxPaid: {
      totalLiability: r2(totalLiability),
      paidByCash: r2(paidByCash),
      paidByITC: r2(paidByITC),
    },
  };
}
