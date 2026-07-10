// GET /api/bank/transactions
// Returns all bank transactions (with optional filters via query params).
// Supports: ?accountId=, ?category=, ?type=, ?matched=, ?limit=

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSeedData } from '@/lib/banking/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureSeedData();
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');
    const category = url.searchParams.get('category');
    const type = url.searchParams.get('type');
    const matched = url.searchParams.get('matched');
    const limit = Math.min(500, parseInt(url.searchParams.get('limit') ?? '100', 10));

    const where: Record<string, unknown> = {};
    if (accountId) where.accountId = accountId;
    if (category) where.category = category;
    if (type) where.type = type;
    if (matched === 'true') where.matched = true;
    if (matched === 'false') where.matched = false;

    const rows = await db.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    });

    const accounts = await db.bankAccount.findMany();
    const accMap = new Map(accounts.map(a => [a.id, a]));

    const transactions = rows.map(r => ({
      id: r.id,
      accountId: r.accountId,
      bankName: accMap.get(r.accountId)?.bankName ?? '—',
      accountMasked: accMap.get(r.accountId)?.accountMasked ?? '—',
      date: r.date.toISOString(),
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: r.category,
      referenceNo: r.referenceNo,
      counterparty: r.counterparty,
      matched: r.matched,
      matchedInvoice: r.matchedInvoice,
      matchedParty: r.matchedParty,
      matchConfidence: r.matchConfidence,
    }));

    return NextResponse.json({ ok: true, count: transactions.length, transactions });
  } catch (err) {
    console.error('[bank/transactions] GET failed:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load transactions', detail: String(err) },
      { status: 500 },
    );
  }
}
