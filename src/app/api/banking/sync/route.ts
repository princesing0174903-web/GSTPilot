// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — Sync API
//
// POST /api/banking/sync
//   Body: { organizationId, connectionId, encryptedConnection, scope?,
//           from?, to?, invoices? }
//   Returns: { ok: true, result: { snapshot?, transactions? } }
//
// scope:
//   • 'full'         (default) — balances + transactions
//   • 'balances'                — account balances only
//   • 'transactions'            — transactions only (optionally incremental via from/to)
//
// The `invoices` param is optional — if provided, the reconciliation engine
// matches transactions against invoices before returning them.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import {
  syncBalances,
  syncTransactions,
  fullBankSync,
} from '@/lib/banking-provider/server/orchestrator';
import { BankingError, friendlyBankingError } from '@/lib/banking-provider/errors';
import type { BankAccountSnapshot, BankTransaction } from '@/lib/banking-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const body = await req.json();
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || body.organizationId || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const {
      organizationId,
      connectionId,
      encryptedConnection,
      scope = 'full',
      from,
      to,
      invoices,
    } = body as {
      organizationId?: string;
      connectionId?: string;
      encryptedConnection?: string;
      scope?: 'full' | 'balances' | 'transactions';
      from?: string;
      to?: string;
      invoices?: Array<{
        id: string;
        invoiceNumber: string;
        clientName: string;
        grandTotal: number;
        balanceDue: number;
        invoiceType: 'sales' | 'purchase';
      }>;
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (!connectionId) {
      return NextResponse.json({ ok: false, error: 'connectionId is required' }, { status: 400 });
    }
    if (!encryptedConnection) {
      return NextResponse.json(
        { ok: false, error: 'encryptedConnection is required.' },
        { status: 400 },
      );
    }

    let snapshot: BankAccountSnapshot | null = null;
    let transactions: BankTransaction[] | null = null;

    if (scope === 'balances') {
      snapshot = await syncBalances(organizationId, connectionId, encryptedConnection);
    } else if (scope === 'transactions') {
      transactions = await syncTransactions(organizationId, connectionId, encryptedConnection, {
        from,
        to,
        invoices,
      });
    } else {
      // full
      const result = await fullBankSync(organizationId, connectionId, encryptedConnection, {
        from,
        to,
        invoices,
      });
      snapshot = result.snapshot;
      transactions = result.transactions;
    }

    return NextResponse.json({
      ok: true,
      result: { snapshot, transactions },
    });
  } catch (err) {
    const statusCode = err instanceof BankingError ? err.statusCode : 500;
    const code = err instanceof BankingError ? err.code : 'UNKNOWN';
    console.error('[api/banking/sync] error:', code, friendlyBankingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBankingError(err), code },
      { status: statusCode },
    );
  }
}
