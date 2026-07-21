import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type {
  TransactionFilter,
  TransactionCategory,
  TransactionType,
  TransactionStatus,
} from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATEGORIES: TransactionCategory[] = [
  'sales',
  'payment_received',
  'vendor_payment',
  'salary',
  'rent',
  'utilities',
  'tax',
  'fees',
  'refund',
  'transfer',
  'interest',
  'misc',
];

const TYPES: TransactionType[] = ['credit', 'debit'];
const STATUSES: TransactionStatus[] = [
  'reconciled',
  'unreconciled',
  'pending',
  'ignored',
];

function isCategory(v: string | null): v is TransactionCategory {
  return !!v && CATEGORIES.includes(v as TransactionCategory);
}
function isType(v: string | null): v is TransactionType {
  return !!v && TYPES.includes(v as TransactionType);
}
function isStatus(v: string | null): v is TransactionStatus {
  return !!v && STATUSES.includes(v as TransactionStatus);
}

// GET /api/banking-intel/transactions — list transactions with filters
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const orgId = sp.get('orgId') || 'preview-org';

    const filter: TransactionFilter = {};
    const accountId = sp.get('accountId');
    if (accountId) filter.accountId = accountId;
    const dateFrom = sp.get('dateFrom');
    if (dateFrom) filter.dateFrom = dateFrom;
    const dateTo = sp.get('dateTo');
    if (dateTo) filter.dateTo = dateTo;
    const categoryRaw = sp.get('category');
    if (isCategory(categoryRaw)) filter.category = categoryRaw;
    const typeRaw = sp.get('type');
    if (isType(typeRaw)) filter.type = typeRaw;
    const statusRaw = sp.get('status');
    if (isStatus(statusRaw)) filter.status = statusRaw;
    const search = sp.get('search');
    if (search) filter.search = search;

    const minAmount = sp.get('minAmount');
    if (minAmount !== null) {
      const n = Number(minAmount);
      if (!Number.isNaN(n)) filter.minAmount = n;
    }
    const maxAmount = sp.get('maxAmount');
    if (maxAmount !== null) {
      const n = Number(maxAmount);
      if (!Number.isNaN(n)) filter.maxAmount = n;
    }
    const limit = sp.get('limit');
    if (limit !== null) {
      const n = Number(limit);
      if (!Number.isNaN(n) && n > 0) filter.limit = n;
    }
    const offset = sp.get('offset');
    if (offset !== null) {
      const n = Number(offset);
      if (!Number.isNaN(n) && n >= 0) filter.offset = n;
    }

    const service = await getBankingService();
    const result = await service.listTransactions(orgId, filter);
    return NextResponse.json({
      ok: true,
      rows: result.rows,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/banking-intel/transactions — create a transaction manually
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const {
      accountId,
      date,
      description,
      amount,
      type,
      category,
      counterparty,
      referenceNo,
      upiRef,
      balanceAfter,
      notes,
    } = body ?? {};

    if (
      !accountId ||
      !date ||
      !description ||
      amount === undefined ||
      amount === null ||
      !type
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'accountId, date, description, amount and type are required',
        },
        { status: 400 },
      );
    }
    if (!isType(type)) {
      return NextResponse.json(
        { ok: false, error: 'type must be "credit" or "debit"' },
        { status: 400 },
      );
    }
    if (category && !isCategory(category)) {
      return NextResponse.json(
        { ok: false, error: `Invalid category: ${category}` },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const transaction = await service.createTransaction(orgId, {
      accountId,
      date,
      description,
      amount: Number(amount),
      type,
      category: category || undefined,
      counterparty: counterparty || undefined,
      referenceNo: referenceNo || undefined,
      upiRef: upiRef || undefined,
      balanceAfter:
        balanceAfter === undefined || balanceAfter === null
          ? undefined
          : Number(balanceAfter),
      notes: notes || undefined,
    });
    return NextResponse.json({ ok: true, transaction }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
