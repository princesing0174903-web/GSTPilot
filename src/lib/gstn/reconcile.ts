// ═══════════════════════════════════════════════════════════════════════════════
// Module 6 — ITC Reconciliation Engine™ (KILLER FEATURE)
// Books → Purchase Register → GSTR-2B → Invoice Matching → Mismatch Detection → Suggestions
//
// Oracle: "I've detected ₹18,700 ITC mismatch." / "I've identified 7 invoices requiring review."
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { isValidGstinFormat, hashStr } from './client';
import type { ReconcileResult, MismatchResult } from './client';
import { getStoredGstr2b } from './gstr2b';

// Simulate the "Books" (purchase register) — deterministic per GSTIN+period.
// In production, this would come from the user's accounting system / ERP.
function generatePurchaseRegister(gstin: string, period: string) {
  const seed = hashStr(gstin + period);
  const count = 10 + (seed % 10);
  const books: Array<{
    supplierGSTIN: string;
    invoiceNo: string;
    invoiceDate: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
  }> = [];
  const suppliers = [
    '27AAACR5055K1Z5', '27AAACT2727Q1ZW', '29AAACI4799L1ZB', '27AAACA9514P1Z4',
    '33AAACB4352K1Z6', '06AAACM4699Q1Z6', '27AAACH1809E1Z5', '24AADCA7832D1Z5',
  ];
  for (let i = 0; i < count; i++) {
    const s = hashStr(gstin + period + 'books' + i);
    const supplier = suppliers[s % suppliers.length];
    const taxableValue = (4 + (s % 90)) * 10000;
    const isInterState = gstin.slice(0, 2) !== supplier.slice(0, 2);
    const invDay = 1 + (s % 28);
    // Introduce deliberate mismatches for ~30% of invoices
    const mismatchType = s % 10;
    let bookedTaxable = taxableValue;
    let bookedIgst = isInterState ? Math.round(taxableValue * 0.18) : 0;
    let bookedCgst = isInterState ? 0 : Math.round(taxableValue * 0.09);
    let bookedSgst = isInterState ? 0 : Math.round(taxableValue * 0.09);
    let bookedInvoiceNo = `INV-${period.replace('-', '')}-${String(1000 + i).padStart(4, '0')}`;
    let bookedSupplier = supplier;
    let bookedDate = `${period}-${String(invDay).padStart(2, '0')}`;

    if (mismatchType === 0) {
      // value difference — booked 5% less
      bookedTaxable = Math.round(taxableValue * 0.95);
      bookedIgst = Math.round(bookedTaxable * (isInterState ? 0.18 : 0));
      bookedCgst = isInterState ? 0 : Math.round(bookedTaxable * 0.09);
      bookedSgst = isInterState ? 0 : Math.round(bookedTaxable * 0.09);
    } else if (mismatchType === 1) {
      // date difference — booked 3 days off
      bookedDate = `${period}-${String(Math.min(28, invDay + 3)).padStart(2, '0')}`;
    } else if (mismatchType === 2) {
      // invoice no mismatch
      bookedInvoiceNo = `INV-${period.replace('-', '')}-${String(1000 + i).padStart(4, '0')}X`;
    }
    // ~10% missing from 2B (no match at all) handled separately below

    books.push({
      supplierGSTIN: bookedSupplier,
      invoiceNo: bookedInvoiceNo,
      invoiceDate: bookedDate,
      taxableValue: bookedTaxable,
      igst: bookedIgst,
      cgst: bookedCgst,
      sgst: bookedSgst,
    });
  }
  return books;
}

export async function reconcileGstr2b(gstin: string, period: string): Promise<ReconcileResult> {
  if (!isValidGstinFormat(gstin)) {
    throw new Error(`Invalid GSTIN format: "${gstin}".`);
  }

  // Ensure 2B is downloaded
  let gstr2b = await getStoredGstr2b(gstin, period);
  if (!gstr2b) {
    const { downloadGstr2b } = await import('./gstr2b');
    await downloadGstr2b(gstin, period);
    gstr2b = await getStoredGstr2b(gstin, period);
  }
  if (!gstr2b) throw new Error('Failed to load GSTR-2B data.');

  const books = generatePurchaseRegister(gstin, period);
  const twoBInvoices = gstr2b.invoices;

  // Clear old mismatches for this GSTIN+period
  await db.iTCMismatch.deleteMany({ where: { gstin } });

  const mismatches: MismatchResult[] = [];
  let matched = 0;
  let mismatched = 0;
  let unmatched = 0;
  let missingITC = 0;
  let mismatchValue = 0;

  // Match 2B invoices against books
  for (const inv of twoBInvoices) {
    const bookMatch = books.find(
      (b) => b.supplierGSTIN === inv.supplierGSTIN && b.invoiceNo === inv.invoiceNo,
    );
    if (!bookMatch) {
      // Invoice in 2B but not in books — potential ITC claim but not booked
      unmatched++;
      missingITC += inv.itcAvailable;
      const sev: MismatchResult['severity'] = inv.itcAvailable > 100000 ? 'high' : inv.itcAvailable > 25000 ? 'medium' : 'low';
      const m: MismatchResult = {
        id: `mm_${inv.id}`,
        supplierGSTIN: inv.supplierGSTIN,
        invoiceNo: inv.invoiceNo,
        reason: 'missing_invoice',
        amount: inv.itcAvailable,
        severity: sev,
        status: 'open',
        suggestion: 'Invoice present in GSTR-2B but missing from your purchase register. Verify if goods/services were received and book it to claim ITC.',
      };
      mismatches.push(m);
      await db.iTCMismatch.create({
        data: {
          gstin,
          invoiceId: inv.id,
          supplierGSTIN: inv.supplierGSTIN,
          invoiceNo: inv.invoiceNo,
          reason: 'missing_invoice',
          amount: inv.itcAvailable,
          severity: sev,
          status: 'open',
          suggestion: m.suggestion,
        },
      });
      await db.gSTR2BInvoice.update({ where: { id: inv.id }, data: { matched: false, matchStatus: 'unmatched' } });
      continue;
    }

    // Check for value / date mismatches
    const valueDiff = Math.abs(bookMatch.taxableValue - inv.taxableValue);
    const dateDiff = bookMatch.invoiceDate !== inv.invoiceDate;
    const gstinMismatch = bookMatch.supplierGSTIN !== inv.supplierGSTIN;

    if (valueDiff > 1 && valueDiff > bookMatch.taxableValue * 0.01) {
      mismatched++;
      mismatchValue += valueDiff;
      const sev: MismatchResult['severity'] = valueDiff > 50000 ? 'critical' : valueDiff > 10000 ? 'high' : 'medium';
      const m: MismatchResult = {
        id: `mm_${inv.id}`,
        supplierGSTIN: inv.supplierGSTIN,
        invoiceNo: inv.invoiceNo,
        reason: 'value_difference',
        amount: valueDiff,
        severity: sev,
        status: 'open',
        suggestion: `Booked ₹${bookMatch.taxableValue.toLocaleString('en-IN')} vs 2B ₹${inv.taxableValue.toLocaleString('en-IN')}. Correct your books or request supplier amendment.`,
      };
      mismatches.push(m);
      await db.iTCMismatch.create({
        data: {
          gstin, invoiceId: inv.id, supplierGSTIN: inv.supplierGSTIN, invoiceNo: inv.invoiceNo,
          reason: 'value_difference', amount: valueDiff, severity: sev, status: 'open', suggestion: m.suggestion,
        },
      });
      await db.gSTR2BInvoice.update({ where: { id: inv.id }, data: { matched: false, matchStatus: 'mismatched', mismatchReason: 'value_difference' } });
    } else if (dateDiff) {
      mismatched++;
      const m: MismatchResult = {
        id: `mm_${inv.id}`,
        supplierGSTIN: inv.supplierGSTIN,
        invoiceNo: inv.invoiceNo,
        reason: 'date_difference',
        amount: inv.itcAvailable,
        severity: 'low',
        status: 'open',
        suggestion: `Booked ${bookMatch.invoiceDate} vs 2B ${inv.invoiceDate}. Correct the date in your books.`,
      };
      mismatches.push(m);
      await db.iTCMismatch.create({
        data: {
          gstin, invoiceId: inv.id, supplierGSTIN: inv.supplierGSTIN, invoiceNo: inv.invoiceNo,
          reason: 'date_difference', amount: inv.itcAvailable, severity: 'low', status: 'open', suggestion: m.suggestion,
        },
      });
      await db.gSTR2BInvoice.update({ where: { id: inv.id }, data: { matched: false, matchStatus: 'mismatched', mismatchReason: 'date_difference' } });
    } else if (gstinMismatch) {
      mismatched++;
      mismatchValue += inv.itcAvailable;
      const m: MismatchResult = {
        id: `mm_${inv.id}`,
        supplierGSTIN: inv.supplierGSTIN,
        invoiceNo: inv.invoiceNo,
        reason: 'gstin_mismatch',
        amount: inv.itcAvailable,
        severity: 'high',
        status: 'open',
        suggestion: 'Supplier GSTIN differs between books and 2B. Verify the correct supplier GSTIN.',
      };
      mismatches.push(m);
      await db.iTCMismatch.create({
        data: {
          gstin, invoiceId: inv.id, supplierGSTIN: inv.supplierGSTIN, invoiceNo: inv.invoiceNo,
          reason: 'gstin_mismatch', amount: inv.itcAvailable, severity: 'high', status: 'open', suggestion: m.suggestion,
        },
      });
      await db.gSTR2BInvoice.update({ where: { id: inv.id }, data: { matched: false, matchStatus: 'mismatched', mismatchReason: 'gstin_mismatch' } });
    } else if (!inv.itcEligible) {
      mismatched++;
      missingITC += inv.itcAvailable;
      const m: MismatchResult = {
        id: `mm_${inv.id}`,
        supplierGSTIN: inv.supplierGSTIN,
        invoiceNo: inv.invoiceNo,
        reason: 'itc_blocked',
        amount: inv.itcAvailable,
        severity: 'high',
        status: 'open',
        suggestion: 'ITC blocked under Section 17(5) — ineligible goods/services. Reverse the credit in your books (Table 4(B)(1) of GSTR-3B).',
      };
      mismatches.push(m);
      await db.iTCMismatch.create({
        data: {
          gstin, invoiceId: inv.id, supplierGSTIN: inv.supplierGSTIN, invoiceNo: inv.invoiceNo,
          reason: 'itc_blocked', amount: inv.itcAvailable, severity: 'high', status: 'open', suggestion: m.suggestion,
        },
      });
      await db.gSTR2BInvoice.update({ where: { id: inv.id }, data: { matched: false, matchStatus: 'mismatched', mismatchReason: 'itc_blocked' } });
    } else {
      matched++;
      await db.gSTR2BInvoice.update({ where: { id: inv.id }, data: { matched: true, matchStatus: 'matched' } });
    }
  }

  // Check for books invoices not in 2B (potential missing ITC)
  for (const b of books) {
    const in2b = twoBInvoices.find((t) => t.supplierGSTIN === b.supplierGSTIN && t.invoiceNo === b.invoiceNo);
    if (!in2b) {
      unmatched++;
      missingITC += b.igst + b.cgst + b.sgst;
      const m: MismatchResult = {
        id: `mm_books_${b.invoiceNo}`,
        supplierGSTIN: b.supplierGSTIN,
        invoiceNo: b.invoiceNo,
        reason: 'missing_invoice',
        amount: b.igst + b.cgst + b.sgst,
        severity: 'high',
        status: 'open',
        suggestion: 'Invoice booked in your purchase register but NOT reflected in GSTR-2B. Supplier may not have filed GSTR-1. Follow up immediately to secure ITC.',
      };
      mismatches.push(m);
      await db.iTCMismatch.create({
        data: {
          gstin, supplierGSTIN: b.supplierGSTIN, invoiceNo: b.invoiceNo,
          reason: 'missing_invoice', amount: b.igst + b.cgst + b.sgst, severity: 'high', status: 'open', suggestion: m.suggestion,
        },
      });
    }
  }

  const totalInvoices = twoBInvoices.length + books.length;
  const matchedPct = totalInvoices > 0 ? Math.round((matched / totalInvoices) * 100) : 0;
  const riskLevel: ReconcileResult['riskLevel'] =
    missingITC > 200000 || mismatchValue > 100000 ? 'critical' :
    missingITC > 50000 || mismatchValue > 25000 ? 'high' :
    missingITC > 10000 || mismatchValue > 5000 ? 'medium' : 'low';

  return {
    gstin,
    period,
    totalInvoices,
    matched,
    unmatched,
    mismatched,
    matchedPct,
    missingITC,
    mismatchValue,
    riskLevel,
    mismatches: mismatches.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    }),
  };
}

export async function getStoredMismatches(gstin: string) {
  return db.iTCMismatch.findMany({
    where: { gstin },
    orderBy: [{ severity: 'desc' }, { amount: 'desc' }],
  });
}

export async function resolveMismatch(id: string, action: 'resolved' | 'ignored') {
  return db.iTCMismatch.update({ where: { id }, data: { status: action } });
}
