import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
import type { TransactionCategory } from '@/lib/banking-service';

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

// GET /api/banking-intel/rules — list categorization rules
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId') || 'preview-org';
    const service = await getBankingService();
    const rules = await service.listRules(orgId);
    return NextResponse.json({ ok: true, rules });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/rules GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/banking-intel/rules — create a categorization rule
// Body: { orgId?, pattern, isRegex, category, counterparty?, priority, active }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { pattern, isRegex, category, counterparty, priority, active } = body ?? {};

    if (!pattern || typeof pattern !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'pattern (string) is required' },
        { status: 400 },
      );
    }
    if (typeof isRegex !== 'boolean') {
      return NextResponse.json(
        { ok: false, error: 'isRegex (boolean) is required' },
        { status: 400 },
      );
    }
    if (!category || !CATEGORIES.includes(category as TransactionCategory)) {
      return NextResponse.json(
        { ok: false, error: `Invalid category: ${category}` },
        { status: 400 },
      );
    }
    if (typeof priority !== 'number' || !Number.isFinite(priority)) {
      return NextResponse.json(
        { ok: false, error: 'priority (number) is required' },
        { status: 400 },
      );
    }
    if (typeof active !== 'boolean') {
      return NextResponse.json(
        { ok: false, error: 'active (boolean) is required' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const rule = await service.createRule(orgId, {
      pattern,
      isRegex,
      category: category as TransactionCategory,
      counterparty: counterparty || undefined,
      priority,
      active,
    });
    return NextResponse.json({ ok: true, rule }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/rules POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
