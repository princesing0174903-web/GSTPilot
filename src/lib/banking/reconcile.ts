// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Cloud™ — Module 6: Auto Reconciliation Engine
// Bank Transactions → Invoices → Receivables → Payments → Matching → Exceptions.
// Deterministic engine. No LLM.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ReconcileState,
  ReconcileMatch,
  ReconcileException,
  ReconcileSummary,
  MatchType,
} from './types';

// ─── Matching logic ────────────────────────────────────────────────────────────

function amountMatch(bankAmt: number, invoiceAmt: number, tolerance = 0.02): boolean {
  return Math.abs(Math.abs(bankAmt) - invoiceAmt) <= invoiceAmt * tolerance;
}

function partialMatch(bankAmt: number, invoiceAmt: number): boolean {
  const ratio = Math.abs(bankAmt) / Math.max(1, invoiceAmt);
  return ratio >= 0.5 && ratio <= 0.99;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getReconcileState(): Promise<ReconcileState> {
  // Pull all credit bank transactions (incoming payments) + outstanding invoices.
  const bankTxns = await db.bankTransaction.findMany({
    where: { type: 'credit' },
    include: { account: { select: { bankName: true } } },
    orderBy: { date: 'desc' },
    take: 300,
  });
  const invoices = await db.invoice.findMany({
    where: { status: { in: ['sent', 'overdue', 'partial', 'paid'] } },
    take: 300,
  });

  const matches: ReconcileMatch[] = [];
  const exceptions: ReconcileException[] = [];
  const byMatchType: Record<MatchType, number> = {
    exact: 0,
    partial: 0,
    duplicate: 0,
    unknown_credit: 0,
    unknown_debit: 0,
    missing_payment: 0,
  };

  const matchedInvoiceIds = new Set<string>();
  const matchedBankTxnIds = new Set<string>();

  // 1) Match bank credits → invoices by amount.
  for (const txn of bankTxns) {
    let bestMatch: { invoice: typeof invoices[number]; type: MatchType; confidence: number } | null = null;

    for (const inv of invoices) {
      if (matchedInvoiceIds.has(inv.id)) continue;
      if (amountMatch(txn.amount, inv.totalAmount)) {
        bestMatch = { invoice: inv, type: 'exact', confidence: 0.95 };
        break;
      }
      if (partialMatch(txn.amount, inv.totalAmount)) {
        if (!bestMatch || bestMatch.confidence < 0.7) {
          bestMatch = { invoice: inv, type: 'partial', confidence: 0.7 };
        }
      }
    }

    // 2) Detect duplicate payment — same amount within 7 days.
    if (!bestMatch) {
      const dup = bankTxns.find(
        (t) => t.id !== txn.id && Math.abs(t.amount - txn.amount) < 1 && Math.abs(new Date(t.date).getTime() - new Date(txn.date).getTime()) < 7 * 86_400_000,
      );
      if (dup) {
        bestMatch = null;
        byMatchType.duplicate++;
        exceptions.push({
          id: 'exc_' + txn.id.slice(-6),
          type: 'duplicate',
          bankTxnId: txn.id,
          description: `Duplicate credit of ₹${Math.round(Math.abs(txn.amount)).toLocaleString('en-IN')} detected (matches ${new Date(dup.date).toLocaleDateString('en-IN')}).`,
          amount: Math.abs(txn.amount),
          date: txn.date,
          suggestedAction: 'Verify with customer and refund or adjust against next invoice.',
          severity: 'medium',
        });
        matchedBankTxnIds.add(txn.id);
        continue;
      }
    }

    if (bestMatch) {
      byMatchType[bestMatch.type]++;
      matchedInvoiceIds.add(bestMatch.invoice.id);
      matchedBankTxnIds.add(txn.id);
      matches.push({
        id: 'm_' + txn.id.slice(-6),
        bankTxnId: txn.id,
        invoiceId: bestMatch.invoice.id,
        invoiceNumber: bestMatch.invoice.invoiceNumber,
        customerName: bestMatch.invoice.buyerName || null,
        bankAmount: txn.amount,
        invoiceAmount: bestMatch.invoice.totalAmount,
        matchType: bestMatch.type,
        confidence: bestMatch.confidence,
        date: txn.date,
        description: txn.description,
        reason: bestMatch.type === 'exact'
          ? 'Bank credit exactly matches invoice amount.'
          : 'Bank credit partially matches invoice amount — likely a part payment.',
      });
    } else {
      // Unknown credit — no matching invoice.
      byMatchType.unknown_credit++;
      exceptions.push({
        id: 'exc_' + txn.id.slice(-6),
        type: 'unknown_credit',
        bankTxnId: txn.id,
        description: `Unknown credit of ₹${Math.round(Math.abs(txn.amount)).toLocaleString('en-IN')} from "${txn.description}" — no matching invoice.`,
        amount: Math.abs(txn.amount),
        date: txn.date,
        suggestedAction: 'Identify the payer and create an invoice or record as advance.',
        severity: 'low',
      });
      matchedBankTxnIds.add(txn.id);
    }
  }

  // 3) Missing payments — invoices sent/overdue with no matching bank credit.
  for (const inv of invoices) {
    if (matchedInvoiceIds.has(inv.id)) continue;
    if (inv.status === 'paid') continue;
    byMatchType.missing_payment++;
    exceptions.push({
      id: 'exc_' + inv.id.slice(-6),
      type: 'missing_payment',
      bankTxnId: 'n/a',
      description: `Invoice ${inv.invoiceNumber} for ₹${Math.round(inv.totalAmount).toLocaleString('en-IN')} (${inv.buyerName || 'customer'}) has no matching bank payment.`,
      amount: inv.totalAmount,
      date: inv.invoiceDate || new Date().toISOString(),
      suggestedAction: inv.status === 'overdue' ? 'Escalate to collections recovery workflow.' : 'Send payment reminder to customer.',
      severity: inv.status === 'overdue' ? 'high' : 'medium',
    });
  }

  // 4) Unknown debits — bank debits with no clear category.
  const debitTxns = await db.bankTransaction.findMany({
    where: { type: 'debit', category: 'uncategorized' },
    take: 50,
  });
  for (const txn of debitTxns) {
    byMatchType.unknown_debit++;
    exceptions.push({
      id: 'exc_d_' + txn.id.slice(-6),
      type: 'unknown_debit',
      bankTxnId: txn.id,
      description: `Unknown debit of ₹${Math.round(Math.abs(txn.amount)).toLocaleString('en-IN')} — "${txn.description}".`,
      amount: Math.abs(txn.amount),
      date: txn.date,
      suggestedAction: 'Categorise this expense or verify with the account holder.',
      severity: 'low',
    });
  }

  const totalTransactions = bankTxns.length + debitTxns.length;
  const matchedCount = byMatchType.exact + byMatchType.partial;
  const unmatchedCount = totalTransactions - matchedCount;
  const matchedAmount = matches.reduce((s, m) => s + m.bankAmount, 0);
  const unmatchedAmount = exceptions
    .filter((e) => e.type !== 'missing_payment')
    .reduce((s, e) => s + e.amount, 0);
  const pendingCollections = byMatchType.missing_payment;
  const matchedPct = totalTransactions > 0 ? Math.round((matchedCount / totalTransactions) * 100) : 0;
  const riskLevel: 'low' | 'medium' | 'high' = matchedPct >= 80 ? 'low' : matchedPct >= 50 ? 'medium' : 'high';

  const summary: ReconcileSummary = {
    totalTransactions,
    matched: matchedCount,
    unmatched: unmatchedCount,
    matchedAmount,
    unmatchedAmount,
    matchedPct,
    pendingCollections,
    riskLevel,
    byMatchType,
  };

  return {
    summary,
    matches: matches.slice(0, 100),
    exceptions: exceptions.slice(0, 100),
    hasLiveData: totalTransactions > 0,
  };
}

export async function runReconciliation(): Promise<{ matched: number; exceptions: number }> {
  // Persist match flags back to bank transactions.
  const state = await getReconcileState();
  for (const m of state.matches) {
    await db.bankTransaction.update({
      where: { id: m.bankTxnId },
      data: {
        matched: true,
        matchedInvoiceId: m.invoiceId,
        matchType: m.matchType,
        matchConfidence: m.confidence,
      },
    });
  }
  return { matched: state.matches.length, exceptions: state.exceptions.length };
}
