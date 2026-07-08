// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Smart Reconciliation Engine (Phase Delta · 4)
// AI-assisted matching of invoices ↔ bank transactions ↔ payments ↔ credit notes.
// Confidence-scored auto-approval. Detects duplicates, missing invoices, tax &
// amount mismatches, late payments.
// ═══════════════════════════════════════════════════════════════════════════════

export type MatchType =
  | 'exact' | 'partial' | 'fuzzy' | 'unmatched' | 'duplicate' | 'mismatch';

export interface ReconciliationMatch {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  counterparty: string;
  expectedAmount: number;
  matchedTransactionId?: string;
  matchedAmount?: number;
  matchedDate?: string;
  matchType: MatchType;
  confidence: number; // 0-1
  evidence: string[];
  status: 'auto_approved' | 'needs_review' | 'rejected';
  flags: string[];
}

export interface ReconciliationReport {
  generatedAt: Date;
  matches: ReconciliationMatch[];
  stats: {
    total: number;
    autoApproved: number;
    needsReview: number;
    rejected: number;
    unmatched: number;
    duplicates: number;
    taxMismatches: number;
    amountMismatches: number;
    latePayments: number;
    missingInvoices: number;
  };
  totalMatchedValue: number;
  totalUnmatchedValue: number;
}

interface ReconInput {
  invoices: Array<Record<string, unknown>>;
  bankTransactions: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  creditNotes?: Array<Record<string, unknown>>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  // Token overlap (Jaccard-ish)
  const t1 = new Set(s1.split(/\s+/));
  const t2 = new Set(s2.split(/\s+/));
  const inter = [...t1].filter((x) => t2.has(x)).length;
  const union = new Set([...t1, ...t2]).size;
  return union > 0 ? inter / union : 0;
}

function withinDays(d1: string | undefined, d2: string | undefined, days: number): boolean {
  if (!d1 || !d2) return false;
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  if (isNaN(t1) || isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= days * 24 * 60 * 60 * 1000;
}

function withinPct(a: number, b: number, pct: number): boolean {
  if (a === 0 && b === 0) return true;
  if (a === 0 || b === 0) return false;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= pct;
}

function lateByDays(invoiceDate: string | undefined, dueDate: string | undefined, payDate: string | undefined): number {
  if (!payDate) return 0;
  const ref = dueDate ?? invoiceDate;
  if (!ref) return 0;
  const t1 = new Date(ref).getTime();
  const t2 = new Date(payDate).getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / (24 * 60 * 60 * 1000)));
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export function runSmartReconciliation(input: ReconInput): ReconciliationReport {
  const { invoices, bankTransactions, payments = [], creditNotes = [] } = input;
  const matches: ReconciliationMatch[] = [];
  const usedTxnIds = new Set<string>();

  // Track which transactions match which invoices (for duplicate detection)
  const invoiceTxnMap: Record<string, string[]> = {};

  for (const inv of invoices) {
    const invoiceId = String(inv.invoiceId ?? '');
    const invoiceNumber = String(inv.invoiceNumber ?? '');
    const expectedAmount = Number(inv.totalAmount ?? 0);
    const buyerName = String(inv.buyerName ?? '');
    const counterparty = buyerName || String(inv.clientId ?? 'Unknown');
    const invoiceDate = inv.invoiceDate ? String(inv.invoiceDate) : undefined;
    const dueDate = inv.dueDate ? String(inv.dueDate) : undefined;

    const evidence: string[] = [];
    const flags: string[] = [];
    let bestTxn: Record<string, unknown> | null = null;
    let bestConfidence = 0;
    let matchType: MatchType = 'unmatched';

    // Search bank transactions (credits = incoming payments for sales invoices)
    for (const tx of bankTransactions) {
      const amt = Number(tx.amount ?? 0);
      if (amt <= 0) continue; // skip debits
      if (usedTxnIds.has(String(tx.bankTxnId ?? ''))) continue;

      const txDesc = String(tx.description ?? '');
      const txDate = tx.date ? String(tx.date) : undefined;
      let conf = 0;
      const ev: string[] = [];

      // Exact amount match
      if (amt === expectedAmount) {
        conf += 0.5;
        ev.push('Amount matches exactly');
      } else if (withinPct(amt, expectedAmount, 0.02)) {
        conf += 0.35;
        ev.push(`Amount within 2% (₹${amt} vs ₹${expectedAmount})`);
        flags.push('amount_mismatch');
      } else if (withinPct(amt, expectedAmount, 0.05)) {
        conf += 0.2;
        ev.push(`Amount within 5% (₹${amt} vs ₹${expectedAmount})`);
        flags.push('amount_mismatch');
      } else {
        continue; // amount too far off
      }

      // Reference / invoice number match
      if (invoiceNumber && txDesc.toLowerCase().includes(invoiceNumber.toLowerCase())) {
        conf += 0.3;
        ev.push('Transaction description contains invoice number');
      }

      // Party name fuzzy match
      const partySim = similarity(counterparty, txDesc);
      if (partySim > 0.7) {
        conf += 0.2;
        ev.push(`Party name fuzzy match ${(partySim * 100).toFixed(0)}%`);
      }

      // Date proximity
      if (withinDays(invoiceDate, txDate, 7)) {
        conf += 0.1;
        ev.push('Date within 7 days of invoice');
      } else if (withinDays(invoiceDate, txDate, 30)) {
        conf += 0.05;
        ev.push('Date within 30 days');
      }

      conf = Math.min(conf, 0.99);
      if (conf > bestConfidence) {
        bestConfidence = conf;
        bestTxn = tx;
        evidence.length = 0;
        evidence.push(...ev);
        if (conf >= 0.9) matchType = 'exact';
        else if (conf >= 0.75) matchType = 'partial';
        else if (conf >= 0.6) matchType = 'fuzzy';
        else matchType = 'mismatch';
      }
    }

    // Also check payments collection
    if (!bestTxn) {
      for (const pay of payments) {
        const pAmt = Number(pay.amount ?? 0);
        if (pAmt !== expectedAmount) continue;
        const pDate = pay.paymentDate ? String(pay.paymentDate) : undefined;
        if (String(pay.invoiceId ?? '') === invoiceId || withinPct(pAmt, expectedAmount, 0.01)) {
          bestTxn = pay;
          bestConfidence = 0.85;
          matchType = 'partial';
          evidence.push('Linked payment record found');
          evidence.push(`Payment amount ₹${pAmt} matches`);
          if (pDate) evidence.push(`Payment dated ${pDate}`);
          break;
        }
      }
    }

    // Credit notes (offset)
    for (const cn of creditNotes) {
      if (String(cn.invoiceId ?? '') === invoiceId) {
        flags.push('credit_note_applied');
        evidence.push(`Credit note ${cn.creditNoteId ?? ''} applied`);
      }
    }

    // Late payment detection
    if (bestTxn) {
      const txnId = String(bestTxn.bankTxnId ?? bestTxn.paymentId ?? '');
      const payDate = bestTxn.date ? String(bestTxn.date) : (bestTxn.paymentDate ? String(bestTxn.paymentDate) : undefined);
      const lateDays = lateByDays(invoiceDate, dueDate, payDate);
      if (lateDays > 7) {
        flags.push('late_payment');
        evidence.push(`Payment ${lateDays} days past due`);
      }
      (invoiceTxnMap[invoiceId] ||= []).push(txnId);
    }

    // Tax mismatch (compare invoice tax sum vs what would be expected)
    const cgst = Number(inv.cgst ?? 0);
    const sgst = Number(inv.sgst ?? 0);
    const igst = Number(inv.igst ?? 0);
    const totalTax = cgst + sgst + igst;
    const taxableValue = Number(inv.taxableValue ?? 0);
    if (taxableValue > 0 && totalTax > 0) {
      const expectedTaxRate = (totalTax / taxableValue) * 100;
      const nearestSlab = [0, 5, 12, 18, 28].reduce((p, c) => Math.abs(c - expectedTaxRate) < Math.abs(p - expectedTaxRate) ? c : p, 0);
      if (Math.abs(expectedTaxRate - nearestSlab) > 1) {
        flags.push('tax_mismatch');
        evidence.push(`Tax rate ${expectedTaxRate.toFixed(1)}% doesn't match nearest slab ${nearestSlab}%`);
      }
    }

    // Determine status
    let status: 'auto_approved' | 'needs_review' | 'rejected';
    if (!bestTxn) {
      status = 'rejected';
      matchType = 'unmatched';
      flags.push('unmatched');
      if (evidence.length === 0) evidence.push('No matching bank transaction or payment found');
    } else if (bestConfidence >= 0.92 && !flags.includes('tax_mismatch') && !flags.includes('amount_mismatch')) {
      status = 'auto_approved';
    } else if (bestConfidence >= 0.6) {
      status = 'needs_review';
    } else {
      status = 'rejected';
    }

    matches.push({
      id: `match_${invoiceId}_${Date.now()}`,
      invoiceId,
      invoiceNumber,
      counterparty,
      expectedAmount,
      matchedTransactionId: bestTxn ? String(bestTxn.bankTxnId ?? bestTxn.paymentId ?? '') : undefined,
      matchedAmount: bestTxn ? Number(bestTxn.amount ?? 0) : undefined,
      matchedDate: bestTxn ? (bestTxn.date ? String(bestTxn.date) : (bestTxn.paymentDate ? String(bestTxn.paymentDate) : undefined)) : undefined,
      matchType,
      confidence: bestConfidence,
      evidence,
      status,
      flags,
    });

    if (bestTxn) usedTxnIds.add(String(bestTxn.bankTxnId ?? bestTxn.paymentId ?? ''));
  }

  // Duplicate detection: transactions matching multiple invoices
  for (const [invId, txnIds] of Object.entries(invoiceTxnMap)) {
    if (txnIds.length > 1) {
      const m = matches.find((x) => x.invoiceId === invId);
      if (m) {
        m.flags.push('duplicate');
        m.status = 'needs_review';
        m.evidence.push(`${txnIds.length} transactions matched this invoice — possible duplicate payment`);
      }
    }
  }

  // Missing invoice detection: bank credits not matched to any invoice
  for (const tx of bankTransactions) {
    const amt = Number(tx.amount ?? 0);
    if (amt <= 0) continue;
    const txnId = String(tx.bankTxnId ?? '');
    if (usedTxnIds.has(txnId)) continue;
    // Treat as missing invoice
    matches.push({
      id: `missing_${txnId}_${Date.now()}`,
      invoiceId: '',
      invoiceNumber: '',
      counterparty: String(tx.description ?? 'Unknown'),
      expectedAmount: 0,
      matchedTransactionId: txnId,
      matchedAmount: amt,
      matchedDate: tx.date ? String(tx.date) : undefined,
      matchType: 'unmatched',
      confidence: 0,
      evidence: ['Bank credit with no matching invoice — possible unrecorded sale'],
      status: 'needs_review',
      flags: ['missing_invoice'],
    });
  }

  // Stats
  const stats = {
    total: matches.length,
    autoApproved: matches.filter((m) => m.status === 'auto_approved').length,
    needsReview: matches.filter((m) => m.status === 'needs_review').length,
    rejected: matches.filter((m) => m.status === 'rejected').length,
    unmatched: matches.filter((m) => m.flags.includes('unmatched')).length,
    duplicates: matches.filter((m) => m.flags.includes('duplicate')).length,
    taxMismatches: matches.filter((m) => m.flags.includes('tax_mismatch')).length,
    amountMismatches: matches.filter((m) => m.flags.includes('amount_mismatch')).length,
    latePayments: matches.filter((m) => m.flags.includes('late_payment')).length,
    missingInvoices: matches.filter((m) => m.flags.includes('missing_invoice')).length,
  };

  return {
    generatedAt: new Date(),
    matches,
    stats,
    totalMatchedValue: matches.filter((m) => m.status === 'auto_approved').reduce((a, m) => a + m.expectedAmount, 0),
    totalUnmatchedValue: matches.filter((m) => m.status === 'rejected' || m.flags.includes('missing_invoice')).reduce((a, m) => a + (m.matchedAmount ?? m.expectedAmount), 0),
  };
}
