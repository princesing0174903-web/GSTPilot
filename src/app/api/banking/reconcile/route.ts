// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Reconcile API
//
// POST /api/banking/reconcile
//   Body: { organizationId, transactions, invoices }
//   Returns: { ok: true, result: { transactions: BankTransaction[] } }
//
// Runs the reconciliation engine against a set of bank transactions + invoices.
// The client passes the transactions (read from Firestore) + invoices (read from
// the invoice engine); the server returns the reconciled transactions with
// updated `invoiceId`, `reconciled`, and `matchConfidence` fields.
//
// The client then persists the updates via updateTransaction().
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { reconcileTransactions } from '@/lib/banking/reconcile';
import type { BankTransaction } from '@/lib/banking-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactions, invoices } = body as {
      transactions?: BankTransaction[];
      invoices?: Array<{
        id: string;
        invoiceNumber: string;
        clientName: string;
        grandTotal: number;
        balanceDue: number;
        invoiceType: 'sales' | 'purchase';
      }>;
    };

    if (!Array.isArray(transactions)) {
      return NextResponse.json(
        { ok: false, error: 'transactions (array) is required.' },
        { status: 400 },
      );
    }
    if (!Array.isArray(invoices)) {
      return NextResponse.json(
        { ok: false, error: 'invoices (array) is required.' },
        { status: 400 },
      );
    }

    const reconciled = reconcileTransactions(transactions, invoices);
    return NextResponse.json({ ok: true, result: { transactions: reconciled } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/banking/reconcile] error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
