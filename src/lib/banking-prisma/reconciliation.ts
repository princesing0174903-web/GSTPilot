// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Prisma-backed Bank Reconciliation Engine (TASK 12)
//
// The persistence-aware reconciliation engine. SERVER-ONLY.
//
// Architecture:
//   ┌─────────────────────────────────────────────────────────────┐
//   │  API Routes (/api/banking/reconciliation/*)                  │
//   ├─────────────────────────────────────────────────────────────┤
//   │  This Engine (src/lib/banking-prisma/reconciliation.ts)      │
//   │  • Reads unmatched BankTransactions + open Invoices from DB  │
//   │  • Reuses the pure fuzzy-matching engine from                │
//   │    src/lib/banking/reconcile.ts (normalizeName,              │
//   │    nameSimilarity, amountSimilarity, matchByReference,       │
//   │    reconcileTransaction)                                     │
//   │  • Maps each match to one of 7 ReconciliationMatchType:      │
//   │      exact | partial | duplicate | overpayment |             │
//   │      underpayment | missing | suspicious                     │
//   │  • Writes BankReconciliation rows + updates BankTransaction  │
//   │  • Supports approve / reject / manualMatch workflows         │
//   ├─────────────────────────────────────────────────────────────┤
//   │  Prisma (SQLite)  ←  BankTransaction, BankReconciliation,    │
//   │                       Invoice (via Client.firmId)            │
//   └─────────────────────────────────────────────────────────────┘
//
// Match-type priority (applied per transaction, in this order):
//   1. suspicious   — denylist pattern OR amount > 3x average txn size
//   2. duplicate    — another txn with same amount+counterparty+type within ±3d
//   3. overpayment  — credit matches invoice but amount > balanceDue (diff > 1%)
//   4. underpayment — credit matches invoice but amount < balanceDue (diff > 1%)
//   5. exact        — confidence >= 0.95 AND amount matches exactly
//   6. partial      — confidence >= 0.6 (fuzzy name/amount match)
//   7. missing      — debit with no matching purchase invoice
//   (else)          — credit unmatched: left as matched=false, no recon record
//
// Multi-tenant: every query filters on `organizationId`. Every BankReconciliation
// row carries `organizationId` for tenant isolation.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  reconcileTransaction,
  matchByReference,
  normalizeName,
  nameSimilarity,
  amountSimilarity,
  type ReconcileInvoiceRef,
} from '@/lib/banking/reconcile';
import type {
  BankTransaction as ProviderBankTransaction,
  ReconciliationStatus,
  BankTransactionType,
  TransactionCategory,
} from '@/lib/banking-provider/types';
import type {
  BankReconciliationRecord,
  ReconciliationMatchType,
  ReconciliationSummary,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXACT_CONFIDENCE = 0.95;
const PARTIAL_CONFIDENCE = 0.6;
const OVER_UNDER_THRESHOLD = 0.01; // 1% of invoice amount
const DUPLICATE_WINDOW_DAYS = 3;
const SUSPICIOUS_AMOUNT_MULTIPLIER = 3;
const SUSPICIOUS_MIN_SAMPLE = 3; // need ≥3 txns for a meaningful average
const DENYLIST_PATTERNS = ['lottery', 'crypto', 'gambling', 'casino', 'betting'];

// ─── DTO mapper ───────────────────────────────────────────────────────────────

type ReconciliationRow = {
  id: string;
  organizationId: string;
  transactionId: string;
  invoiceId: string | null;
  paymentId: string | null;
  matchType: string;
  confidence: number;
  expectedAmount: number | null;
  actualAmount: number | null;
  difference: number;
  status: string;
  matchedBy: string;
  matchedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toReconciliationDTO(row: ReconciliationRow): BankReconciliationRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    transactionId: row.transactionId,
    invoiceId: row.invoiceId,
    paymentId: row.paymentId,
    matchType: row.matchType as ReconciliationMatchType,
    confidence: row.confidence,
    expectedAmount: row.expectedAmount,
    actualAmount: row.actualAmount,
    difference: row.difference,
    status: row.status as 'pending' | 'approved' | 'rejected',
    matchedBy: row.matchedBy,
    matchedAt: row.matchedAt ? row.matchedAt.toISOString() : null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Adapter: Prisma BankTransaction → provider BankTransaction ────────────────
//
// The pure reconcile engine in src/lib/banking/reconcile.ts consumes the
// `BankTransaction` shape from banking-provider/types.ts (the Firestore-era
// schema). We bridge the Prisma row to that shape so we can reuse the exact
// same fuzzy-matching code path.

type PrismaTxnRow = {
  id: string;
  organizationId: string;
  accountId: string;
  date: Date;
  description: string;
  narration: string | null;
  amount: number;
  type: string;
  balance: number | null;
  category: string | null;
  counterparty: string | null;
  referenceNo: string | null;
  reference: string | null;
  upiRef: string | null;
  status: string;
  source: string;
  matched: boolean;
  matchedInvoiceId: string | null;
  matchType: string | null;
  matchConfidence: number | null;
  reconciledAt: Date | null;
  reconciledBy: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toProviderTxn(row: PrismaTxnRow): ProviderBankTransaction {
  return {
    id: row.id,
    organizationId: row.organizationId,
    connectionId: '', // not used by the reconcile engine
    accountId: row.accountId,
    date: row.date.toISOString(),
    description: row.description,
    amount: Math.abs(row.amount),
    type: (row.type as BankTransactionType) || 'debit',
    balance: row.balance,
    category: (row.category as TransactionCategory) || 'other',
    counterparty: row.counterparty,
    referenceNumber: row.referenceNo || row.reference,
    invoiceId: row.matchedInvoiceId,
    reconciled: 'unmatched' as ReconciliationStatus,
    matchConfidence: row.matchConfidence ?? 0,
    syncedAt: row.createdAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Audit log (non-fatal, same pattern as service.ts) ────────────────────────

async function writeAuditLog(input: {
  organizationId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata?: unknown;
}): Promise<void> {
  try {
    // Only set userId if it looks like a real user id (not 'auto'/'system').
    // The AuditLog.userId has a FK to User.id, so passing a non-existent id
    // would throw a foreign-key constraint violation.
    const isRealUser = input.actor && input.actor !== 'auto' && input.actor !== 'system' && input.actor.length > 10;
    await db.auditLog.create({
      data: {
        userId: isRealUser ? input.actor : null,
        action: input.action,
        entity: input.targetType,
        entityId: input.targetId || null,
        details: JSON.stringify({ ...((input.metadata as Record<string, unknown>) ?? {}), actor: input.actor }),
      },
    });
  } catch {
    // Non-fatal — audit log failure should never break the main operation.
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * Returns true if the counterparty / description mentions any high-risk
 * pattern (lottery, crypto, gambling, …). The counterparty is normalized
 * (lowercase, suffix-stripped) so variants like "Crypto Exchange Pvt Ltd"
 * still trip the rule.
 */
function isSuspiciousCounterparty(
  counterparty: string | null,
  description: string | null,
): boolean {
  const cp = normalizeName(counterparty ?? '');
  const desc = (description ?? '').toLowerCase();
  const haystack = `${cp} ${desc}`;
  return DENYLIST_PATTERNS.some((p) => haystack.includes(p));
}

function emptySummary(): ReconciliationSummary {
  return {
    total: 0,
    matched: 0,
    partiallyMatched: 0,
    unmatched: 0,
    duplicate: 0,
    overpayment: 0,
    underpayment: 0,
    missing: 0,
    suspicious: 0,
    reconciliationRate: 0,
    totalMatchedAmount: 0,
    totalUnmatchedAmount: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. runReconciliation — main entry point
// ═══════════════════════════════════════════════════════════════════════════════

export async function runReconciliation(
  organizationId: string,
): Promise<{ summary: ReconciliationSummary; matched: BankReconciliationRecord[] }> {
  // 1. Fetch all unmatched bank transactions for this org (with account join).
  const unmatchedTxns = await db.bankTransaction.findMany({
    where: { organizationId, matched: false },
    include: { account: { select: { bankName: true, accountMasked: true } } },
    orderBy: { date: 'asc' },
  });

  // 2. Fetch all open sales invoices (status not in paid/cancelled/archived,
  //    balance > 0). Invoice has no organizationId — scope via Client.firmId.
  const invoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      status: { notIn: ['paid', 'cancelled', 'archived'] },
      balanceAmount: { gt: 0 },
    },
    include: { client: true },
  });

  const invoiceRefs: ReconcileInvoiceRef[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.client?.tradeName || inv.buyerName || 'Unknown',
    grandTotal: inv.totalAmount,
    balanceDue: inv.balanceAmount,
    invoiceType: 'sales' as const,
    issueDate: inv.invoiceDate,
    referenceNumber: null,
  }));

  // 3. Fetch ALL bank txns for this org (for duplicate detection + avg size).
  const allTxns = await db.bankTransaction.findMany({
    where: { organizationId },
    select: {
      id: true,
      amount: true,
      type: true,
      counterparty: true,
      date: true,
      matched: true,
    },
    orderBy: { date: 'asc' },
  });

  // Compute average txn size (absolute amount). Skipped if sample is too small.
  const totalAmount = allTxns.reduce((s, t) => s + Math.abs(t.amount), 0);
  const avgAmount = allTxns.length > 0 ? totalAmount / allTxns.length : 0;
  const hasEnoughSample = allTxns.length >= SUSPICIOUS_MIN_SAMPLE;

  // 4. Run matching logic for each unmatched txn.
  const matchedRecords: BankReconciliationRecord[] = [];
  const now = new Date();

  for (const txn of unmatchedTxns) {
    const providerTxn = toProviderTxn(txn);
    const txnAmount = Math.abs(txn.amount);

    // 4a. Duplicate check: another txn (matched OR unmatched) with the same
    //     amount + counterparty + type within ±3 days.
    const isDuplicate = allTxns.some((other) => {
      if (other.id === txn.id) return false;
      if (Math.abs(other.amount) !== txnAmount) return false;
      if ((other.counterparty ?? '') !== (txn.counterparty ?? '')) return false;
      if (other.type !== txn.type) return false;
      return daysBetween(other.date, txn.date) <= DUPLICATE_WINDOW_DAYS;
    });

    // 4b. Suspicious check: denylist pattern OR amount > 3x average.
    const isDenylisted = isSuspiciousCounterparty(txn.counterparty, txn.description);
    const isLargeAmount =
      hasEnoughSample &&
      avgAmount > 0 &&
      txnAmount > SUSPICIOUS_AMOUNT_MULTIPLIER * avgAmount;
    const isSuspicious = isDenylisted || isLargeAmount;

    // 4c. Run the existing reconcileTransaction engine. It internally uses
    //     matchByReference + amountSimilarity + nameSimilarity to score every
    //     candidate invoice and returns the best match + confidence.
    const result = reconcileTransaction(providerTxn, invoiceRefs);

    // Also run matchByReference explicitly so we can boost confidence when the
    // bank's reference field literally contains the invoice number.
    const refInvoice = matchByReference(providerTxn, invoiceRefs);

    // 4d. Apply the 7-type classification with priority:
    //     suspicious → duplicate → over/under → exact → partial → missing.
    let matchType: ReconciliationMatchType | null = null;
    let matchedInvoiceId: string | null = null;
    let expectedAmount: number | null = null;
    let confidence = 0;
    let notes: string | null = null;

    const hasStrongMatch =
      result.matchedInvoice !== null && result.confidence >= PARTIAL_CONFIDENCE;

    if (isSuspicious) {
      // 1. Suspicious — always wins (user must review even if it looks like a clean match).
      matchType = 'suspicious';
      confidence = 0.5;
      notes = isDenylisted
        ? 'Counterparty matches high-risk pattern (lottery/crypto/gambling/casino/betting).'
        : `Amount ₹${txnAmount} exceeds 3× average txn size (avg=₹${round2(avgAmount)}).`;
      // Preserve the suggested invoice match for reviewer convenience.
      if (hasStrongMatch && result.matchedInvoice) {
        matchedInvoiceId = result.matchedInvoice.id;
        const bal =
          result.matchedInvoice.balanceDue > 0
            ? result.matchedInvoice.balanceDue
            : result.matchedInvoice.grandTotal;
        expectedAmount = bal;
        confidence = Math.max(confidence, result.confidence);
      }
    } else if (isDuplicate) {
      // 2. Duplicate — flag for review (don't auto-apply an invoice match).
      matchType = 'duplicate';
      confidence = 0.85;
      notes =
        'Another transaction with the same amount + counterparty + type exists within ±3 days.';
    } else if (hasStrongMatch && result.matchedInvoice) {
      // 3-6. We have a real invoice match — classify by amount difference + confidence.
      const inv = result.matchedInvoice;
      matchedInvoiceId = inv.id;
      const invoiceBalance = inv.balanceDue > 0 ? inv.balanceDue : inv.grandTotal;
      expectedAmount = invoiceBalance;
      confidence = result.confidence;

      // If the reference field literally mentions the invoice number, boost.
      if (refInvoice && refInvoice.id === inv.id) {
        confidence = Math.max(confidence, 0.95);
      }

      const diff = txnAmount - invoiceBalance;
      const diffPct =
        invoiceBalance > 0 ? Math.abs(diff) / invoiceBalance : 0;

      if (txn.type === 'credit' && diffPct > OVER_UNDER_THRESHOLD) {
        // 3/4. Over/underpayment (credit only).
        matchType = diff > 0 ? 'overpayment' : 'underpayment';
        notes =
          diff > 0
            ? `Credit ₹${txnAmount} exceeds invoice balance ₹${invoiceBalance} by ₹${round2(diff)}.`
            : `Credit ₹${txnAmount} is short of invoice balance ₹${invoiceBalance} by ₹${round2(Math.abs(diff))}.`;
      } else if (
        result.confidence >= EXACT_CONFIDENCE &&
        Math.abs(diff) < 0.01
      ) {
        // 5. Exact match — confidence ≥ 0.95 AND amount matches to the paisa.
        matchType = 'exact';
      } else {
        // 6. Partial match — fuzzy name/amount match.
        matchType = 'partial';
      }
    } else if (txn.type === 'debit') {
      // 7. Missing — debit with no matching purchase invoice.
      //    (GST payments, vendor payments with no bill, etc.)
      matchType = 'missing';
      confidence = 0;
      notes = 'Debit transaction with no matching purchase invoice.';
    } else {
      // Credit unmatched — leave as matched=false, no BankReconciliation record.
      continue;
    }

    const actualAmount = txnAmount;
    const difference =
      expectedAmount !== null ? round2(actualAmount - expectedAmount) : 0;

    // 4e. Create BankReconciliation record + update BankTransaction atomically.
    //     Using $transaction so we never leave an orphan reconciliation row
    //     if the BankTransaction update fails (or vice versa).
    const [recon] = await db.$transaction([
      db.bankReconciliation.create({
        data: {
          organizationId,
          transactionId: txn.id,
          invoiceId: matchedInvoiceId,
          paymentId: null,
          matchType,
          confidence,
          expectedAmount,
          actualAmount,
          difference,
          status: 'pending',
          matchedBy: 'auto',
          matchedAt: now,
          accountId: txn.accountId,
          notes,
        },
      }),
      db.bankTransaction.update({
        where: { id: txn.id },
        data: {
          matched: true,
          matchType,
          matchConfidence: confidence,
          matchedInvoiceId,
          reconciledAt: now,
          reconciledBy: 'auto',
        },
      }),
    ]);

    matchedRecords.push(toReconciliationDTO(recon));
  }

  // 5. Compute fresh summary from the updated DB state.
  const summary = await getReconciliationSummary(organizationId);

  // 6. Audit log (non-fatal).
  await writeAuditLog({
    organizationId,
    actor: 'auto',
    action: 'bank_reconciliation.run',
    targetType: 'BankReconciliation',
    targetId: null,
    metadata: {
      unmatchedProcessed: unmatchedTxns.length,
      reconciliationsCreated: matchedRecords.length,
      invoicesConsidered: invoiceRefs.length,
      summary,
    },
  });

  return { summary, matched: matchedRecords };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. getReconciliationSummary — read current state from DB (no engine run)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getReconciliationSummary(
  organizationId: string,
): Promise<ReconciliationSummary> {
  const txns = await db.bankTransaction.findMany({
    where: { organizationId },
    select: { matched: true, matchType: true, amount: true },
  });

  const summary = emptySummary();
  summary.total = txns.length;

  for (const t of txns) {
    const amt = Math.abs(t.amount);
    if (!t.matched) {
      summary.unmatched += 1;
      summary.totalUnmatchedAmount += amt;
      continue;
    }
    summary.totalMatchedAmount += amt;
    switch (t.matchType) {
      case 'exact':
        summary.matched += 1;
        break;
      case 'partial':
        summary.partiallyMatched += 1;
        break;
      case 'duplicate':
        summary.duplicate += 1;
        break;
      case 'overpayment':
        summary.overpayment += 1;
        break;
      case 'underpayment':
        summary.underpayment += 1;
        break;
      case 'missing':
        summary.missing += 1;
        break;
      case 'suspicious':
        summary.suspicious += 1;
        break;
      default:
        // matched=true but matchType is null/unknown — count as matched.
        summary.matched += 1;
        break;
    }
  }

  summary.totalMatchedAmount = round2(summary.totalMatchedAmount);
  summary.totalUnmatchedAmount = round2(summary.totalUnmatchedAmount);
  summary.reconciliationRate =
    summary.total > 0
      ? Math.round(((summary.total - summary.unmatched) / summary.total) * 1000) / 10
      : 0;

  return summary;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. listReconciliations — paginated list with optional filters
// ═══════════════════════════════════════════════════════════════════════════════

export async function listReconciliations(
  organizationId: string,
  filters?: { matchType?: string; status?: string; limit?: number },
): Promise<BankReconciliationRecord[]> {
  const where: Record<string, unknown> = { organizationId };
  if (filters?.matchType) where.matchType = filters.matchType;
  if (filters?.status) where.status = filters.status;

  const limit = Math.min(filters?.limit ?? 200, 500);

  const rows = await db.bankReconciliation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return rows.map(toReconciliationDTO);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. approveReconciliation — mark as approved, set txn status='reconciled'
// ═══════════════════════════════════════════════════════════════════════════════

export async function approveReconciliation(
  reconciliationId: string,
  organizationId: string,
  approver: string,
): Promise<BankReconciliationRecord | null> {
  const existing = await db.bankReconciliation.findFirst({
    where: { id: reconciliationId, organizationId },
  });
  if (!existing) return null;

  const now = new Date();
  const updated = await db.bankReconciliation.update({
    where: { id: reconciliationId },
    data: {
      status: 'approved',
      approvedBy: approver,
      approvedAt: now,
    },
  });

  // Mark the linked transaction as 'reconciled' (final state).
  await db.bankTransaction.update({
    where: { id: existing.transactionId },
    data: { status: 'reconciled' },
  });

  await writeAuditLog({
    organizationId,
    actor: approver,
    action: 'bank_reconciliation.approve',
    targetType: 'BankReconciliation',
    targetId: reconciliationId,
    metadata: {
      transactionId: existing.transactionId,
      invoiceId: existing.invoiceId,
      matchType: existing.matchType,
    },
  });

  return toReconciliationDTO(updated);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. rejectReconciliation — mark as rejected, un-mark the linked transaction
// ═══════════════════════════════════════════════════════════════════════════════

export async function rejectReconciliation(
  reconciliationId: string,
  organizationId: string,
  approver: string,
  reason: string,
): Promise<BankReconciliationRecord | null> {
  const existing = await db.bankReconciliation.findFirst({
    where: { id: reconciliationId, organizationId },
  });
  if (!existing) return null;

  const updated = await db.bankReconciliation.update({
    where: { id: reconciliationId },
    data: {
      status: 'rejected',
      notes: reason,
      approvedBy: approver,
      approvedAt: new Date(),
    },
  });

  // Un-mark the linked transaction — it goes back into the unmatched pool.
  await db.bankTransaction.update({
    where: { id: existing.transactionId },
    data: {
      matched: false,
      matchType: null,
      matchConfidence: 0,
      matchedInvoiceId: null,
      reconciledAt: null,
      reconciledBy: null,
    },
  });

  await writeAuditLog({
    organizationId,
    actor: approver,
    action: 'bank_reconciliation.reject',
    targetType: 'BankReconciliation',
    targetId: reconciliationId,
    metadata: {
      transactionId: existing.transactionId,
      reason,
    },
  });

  return toReconciliationDTO(updated);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. manualMatch — user-forced txn ↔ invoice link (auto-approved)
// ═══════════════════════════════════════════════════════════════════════════════

export async function manualMatch(
  transactionId: string,
  invoiceId: string,
  organizationId: string,
  actor: string,
): Promise<BankReconciliationRecord | null> {
  // Validate the txn exists and belongs to the org.
  const txn = await db.bankTransaction.findFirst({
    where: { id: transactionId, organizationId },
  });
  if (!txn) return null;

  // Validate the invoice exists and belongs to the org (via client.firmId).
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, client: { firmId: organizationId } },
    include: { client: true },
  });
  if (!invoice) return null;

  const now = new Date();
  const actualAmount = Math.abs(txn.amount);
  const expectedAmount =
    invoice.balanceAmount > 0 ? invoice.balanceAmount : invoice.totalAmount;
  const difference = round2(actualAmount - expectedAmount);

  // Compute verification scores using the fuzzy helpers — these don't gate the
  // match (the user is the source of truth) but they're recorded in notes so
  // reviewers can spot mismatches between the manual link and the data.
  const clientName = invoice.client?.tradeName || invoice.buyerName || '';
  const nameScore = txn.counterparty ? nameSimilarity(txn.counterparty, clientName) : 0;
  const amountScore = amountSimilarity(actualAmount, expectedAmount);

  const invoiceRef: ReconcileInvoiceRef = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName,
    grandTotal: invoice.totalAmount,
    balanceDue: invoice.balanceAmount,
    invoiceType: 'sales',
    issueDate: invoice.invoiceDate,
    referenceNumber: null,
  };
  const refMatch = matchByReference(toProviderTxn(txn), [invoiceRef]);

  const verificationNote =
    `Manual match by ${actor}. ` +
    `Verification — name:${Math.round(nameScore * 100)}%, ` +
    `amount:${Math.round(amountScore * 100)}%, ` +
    `ref:${refMatch ? 'yes' : 'no'}.`;

  // Create BankReconciliation + update BankTransaction atomically.
  const [recon] = await db.$transaction([
    db.bankReconciliation.create({
      data: {
        organizationId,
        transactionId: txn.id,
        invoiceId: invoice.id,
        paymentId: null,
        matchType: 'exact',
        confidence: 1,
        expectedAmount,
        actualAmount,
        difference,
        status: 'approved',
        matchedBy: 'manual',
        matchedAt: now,
        approvedBy: actor,
        approvedAt: now,
        accountId: txn.accountId,
        notes: verificationNote,
      },
    }),
    db.bankTransaction.update({
      where: { id: txn.id },
      data: {
        matched: true,
        matchType: 'exact',
        matchConfidence: 1,
        matchedInvoiceId: invoice.id,
        reconciledAt: now,
        reconciledBy: actor,
        status: 'reconciled',
      },
    }),
  ]);

  await writeAuditLog({
    organizationId,
    actor,
    action: 'bank_reconciliation.manual_match',
    targetType: 'BankReconciliation',
    targetId: recon.id,
    metadata: {
      transactionId: txn.id,
      invoiceId: invoice.id,
      amount: actualAmount,
      expected: expectedAmount,
      nameScore,
      amountScore,
      refMatch,
    },
  });

  return toReconciliationDTO(recon);
}
