// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connect/bank
// Connect a bank account — stores connection for Oracle awareness
// Body: { userId, bankCode, accountNumber, accountType?, ifsc?, transactions? }
//
// If `transactions` (array of CSV-like row objects) is provided, they are parsed
// and stored as bank_tx records — enabling real cash position computation.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createBankMetadata,
  bankConnectionLabel,
  validateBankAccount,
  parseTransactionsFromStatement,
} from '@/lib/connectors/bank';
import { graphEvents, invalidateGraph } from '@/lib/graph/live-update';

export async function POST(request: NextRequest) {
  let body: {
    userId?: string;
    bankCode?: string;
    accountNumber?: string;
    accountType?: string;
    ifsc?: string;
    transactions?: Array<Record<string, string>>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  const bankCode = body.bankCode;
  const accountNumber = body.accountNumber;

  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  if (!bankCode) return NextResponse.json({ error: 'bankCode is required' }, { status: 400 });
  if (!accountNumber) return NextResponse.json({ error: 'accountNumber is required' }, { status: 400 });

  // Validate account number
  const { valid, masked } = validateBankAccount(accountNumber);
  if (!valid) {
    return NextResponse.json({
      error: 'Invalid account number — must be 9-18 digits',
    }, { status: 400 });
  }

  const metadata = createBankMetadata(bankCode, accountNumber, body.accountType);
  if (body.ifsc) metadata.ifsc = body.ifsc.toUpperCase();

  // Parse transactions if provided (from statement upload)
  const transactions = body.transactions ? parseTransactionsFromStatement(body.transactions) : [];
  if (transactions.length > 0) {
    const cashPos = transactions[transactions.length - 1];
    metadata.currentBalance = cashPos.balanceAfter;
    metadata.availableBalance = cashPos.balanceAfter;
  }

  try {
    // Check for existing bank connection with same account
    const existing = await db.dataConnection.findFirst({
      where: { userId, type: 'bank', identifier: masked },
    });

    let connectionId: string;

    if (existing) {
      await db.syncedRecord.deleteMany({
        where: { connectionId: existing.id, sourceType: 'bank_tx' },
      }).catch(() => {});
      await db.dataConnection.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          label: bankConnectionLabel(metadata),
          identifier: masked,
          metadata: JSON.stringify(metadata),
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      connectionId = existing.id;
    } else {
      const conn = await db.dataConnection.create({
        data: {
          userId,
          type: 'bank',
          status: 'connected',
          label: bankConnectionLabel(metadata),
          identifier: masked,
          metadata: JSON.stringify(metadata),
          lastSyncAt: new Date(),
          syncInterval: '15m',
        },
      });
      connectionId = conn.id;
    }

    // Store transactions as bank_tx records
    for (const tx of transactions) {
      await db.syncedRecord.create({
        data: {
          connectionId,
          userId,
          sourceType: 'bank_tx',
          externalId: tx.transactionId,
          title: tx.description,
          amount: tx.amount,
          date: tx.date,
          rawData: JSON.stringify({
            type: tx.type,
            balanceAfter: tx.balanceAfter,
            category: tx.category,
            description: tx.description,
          }),
          category: tx.type === 'credit' ? 'credit' : 'debit',
          processed: true,
        },
      }).catch(() => {});
      // ── Real Business Graph Engine™ — live event per bank transaction ──
      graphEvents.transactionRecorded(
        tx.transactionId || `banktx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tx.description,
        tx.amount,
        tx.type === 'credit' ? 'credit' : 'debit',
      );
    }

    // ── Real Business Graph Engine™ — bank connection builds graph; log + refresh ──
    graphEvents.connectorSynced('bank', bankConnectionLabel(metadata));
    if (transactions.length > 0) {
      graphEvents.bankSynced(metadata.bankName ?? 'Bank', transactions.length);
    }
    invalidateGraph();

    return NextResponse.json({
      success: true,
      connectionId,
      bank: metadata.bankName,
      accountMasked: masked,
      transactionsImported: transactions.length,
      currentBalance: metadata.currentBalance,
      message: transactions.length > 0
        ? `${metadata.bankName} connected — imported ${transactions.length} transactions. Current balance: ₹${(metadata.currentBalance ?? 0).toLocaleString('en-IN')}`
        : `${metadata.bankName} connected — Oracle now tracks your bank account`,
    });
  } catch (err) {
    console.error('[Bank] Connect error:', err);
    return NextResponse.json({ error: 'Failed to save bank connection' }, { status: 500 });
  }
}
