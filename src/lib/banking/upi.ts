// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Cloud™ — Module 3: UPI Cloud
// UPI IDs, QR Collections, Payment Requests, Payment Tracking.
// Deterministic engine. No LLM.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { UPITransactionDTO, UPIListResult, UPIPaymentRequest } from './types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

// Deterministic VPA generator from bank account.
function deriveVpa(bankName: string, suffix = 'biz'): string {
  const slug = bankName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6) || 'gstpilot';
  return `${slug}@${suffix}`;
}

// ─── DTO builder ───────────────────────────────────────────────────────────────

function toDTO(row: {
  id: string;
  upiId: string;
  reference: string | null;
  amount: number;
  payerName: string | null;
  payerVpa: string | null;
  date: string;
  status: string;
  direction: string;
  matched: boolean;
  matchedBankTxnId: string | null;
  note: string | null;
}): UPITransactionDTO {
  return {
    id: row.id,
    upiId: row.upiId,
    reference: row.reference,
    amount: row.amount,
    payerName: row.payerName,
    payerVpa: row.payerVpa,
    date: row.date,
    status: (row.status as 'success' | 'pending' | 'failed') || 'success',
    direction: (row.direction as 'incoming' | 'outgoing') || (row.amount >= 0 ? 'incoming' : 'outgoing'),
    matched: row.matched,
    matchedBankTxnId: row.matchedBankTxnId,
    note: row.note,
    daysAgo: daysAgo(row.date),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getUPITransactions(opts?: { limit?: number; direction?: string; status?: string }): Promise<UPIListResult> {
  const where: Record<string, unknown> = {};
  if (opts?.direction && opts.direction !== 'all') where.direction = opts.direction;
  if (opts?.status && opts.status !== 'all') where.status = opts.status;

  const rows = await db.uPITransaction.findMany({
    where,
    orderBy: { date: 'desc' },
    take: opts?.limit ?? 200,
  });

  const transactions = rows.map(toDTO);
  const incoming = transactions.filter((t) => t.direction === 'incoming');
  const outgoing = transactions.filter((t) => t.direction === 'outgoing');
  const pending = transactions.filter((t) => t.status === 'pending');
  const matched = transactions.filter((t) => t.matched);

  return {
    transactions,
    total: transactions.length,
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    incomingAmount: incoming.reduce((s, t) => s + Math.abs(t.amount), 0),
    outgoingAmount: outgoing.reduce((s, t) => s + Math.abs(t.amount), 0),
    pendingCount: pending.length,
    matchedCount: matched.length,
    hasLiveData: transactions.length > 0,
  };
}

export async function syncUPI(): Promise<{ synced: number; matched: number }> {
  // Deterministic UPI sync — pulls recent UPI transactions and auto-matches to
  // bank transactions by amount + date proximity.
  const recent = await db.uPITransaction.findMany({
    where: { status: 'success', matched: false },
    orderBy: { date: 'desc' },
    take: 50,
  });

  let matched = 0;
  for (const upi of recent) {
    // Look for a bank transaction with the same amount within +/- 1 day.
    const amt = Math.abs(upi.amount);
    const date = new Date(upi.date);
    const from = new Date(date.getTime() - 86_400_000).toISOString();
    const to = new Date(date.getTime() + 86_400_000).toISOString();
    const candidate = await db.bankTransaction.findFirst({
      where: {
        amount: upi.direction === 'incoming' ? amt : -amt,
        date: { gte: from, lte: to },
        matched: false,
      },
    });
    if (candidate) {
      await db.bankTransaction.update({
        where: { id: candidate.id },
        data: { matched: true, matchedInvoiceId: null, matchType: 'exact', matchConfidence: 0.95, upiRef: upi.reference || upi.upiId },
      });
      await db.uPITransaction.update({
        where: { id: upi.id },
        data: { matched: true, matchedBankTxnId: candidate.id },
      });
      matched++;
    }
  }

  return { synced: recent.length, matched };
}

export async function createPaymentRequest(input: {
  upiId: string;
  payerName: string;
  amount: number;
  note?: string;
}): Promise<UPIPaymentRequest> {
  const reference = 'UPIPR' + Date.now().toString().slice(-8);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 86_400_000);
  const req: UPIPaymentRequest = {
    id: 'upr_' + Math.random().toString(36).slice(2, 10),
    upiId: input.upiId,
    payerName: input.payerName,
    amount: input.amount,
    note: input.note || 'Payment Request from GSTPilot',
    reference,
    status: 'requested',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  // Also persist as a pending UPI transaction so it can be tracked.
  await db.uPITransaction.create({
    data: {
      upiId: input.upiId,
      reference,
      amount: input.amount,
      payerName: input.payerName,
      payerVpa: null,
      date: now.toISOString(),
      status: 'pending',
      direction: 'incoming',
      matched: false,
      note: req.note,
    },
  });
  return req;
}

export async function getLinkedVpas(): Promise<{ vpa: string; bankName: string }[]> {
  const accounts = await db.bankAccount.findMany({ where: { status: 'active' } });
  if (accounts.length === 0) {
    return [{ vpa: 'gstpilot@biz', bankName: 'Default VPA' }];
  }
  return accounts.map((a) => ({ vpa: deriveVpa(a.bankName), bankName: a.bankName }));
}
