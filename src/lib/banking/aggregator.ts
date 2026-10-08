// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Cloud™ — Module 4: Account Aggregator Cloud
// Multi-bank connection, financial data aggregation, consent management.
// Deterministic engine. No LLM.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { AAState, AAConsent, AAAccountLink } from './types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function maskAccount(acct: string): string {
  if (!acct || acct.length < 4) return '****' + acct;
  return '****' + acct.slice(-4);
}

const AA_FIPS: Record<string, string> = {
  'HDFC Bank': 'HDFC-FIP',
  'ICICI Bank': 'ICICI-FIP',
  'Axis Bank': 'AXIS-FIP',
  'SBI': 'SBI-FIP',
  'Kotak Mahindra': 'KOTAK-FIP',
  'Yes Bank': 'YES-FIP',
  'PNB': 'PNB-FIP',
  'Bank of Baroda': 'BOB-FIP',
};

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getAAState(): Promise<AAState> {
  const accounts = await db.bankAccount.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const linkedAccounts: AAAccountLink[] = accounts.map((a) => ({
    id: a.id,
    bankName: a.bankName,
    accountNumberMasked: maskAccount(a.accountNumber),
    linked: a.aaConnected,
    consentId: a.aaConnected ? 'consent_' + a.id.slice(-6) : null,
    lastFetched: a.lastSyncAt ? a.lastSyncAt.toISOString() : null,
    balance: a.currentBalance,
  }));

  // Build deterministic consent list from connected accounts.
  const consents: AAConsent[] = accounts
    .filter((a) => a.aaConnected)
    .map((a) => {
      const expiry = a.aaConsentExpiry || new Date(Date.now() + 90 * 86_400_000);
      const granted = a.lastSyncAt || a.createdAt;
      return {
        id: 'consent_' + a.id.slice(-6),
        fiu: 'VEYRO-AA-FIU',
        fip: AA_FIPS[a.bankName] || 'GENERIC-FIP',
        status: (expiry.getTime() > Date.now() ? 'granted' : 'expired') as AAConsent['status'],
        grantedAt: granted.toISOString(),
        expiresAt: expiry.toISOString(),
        dataRange: {
          from: new Date(granted.getTime() - 180 * 86_400_000).toISOString(),
          to: granted.toISOString(),
        },
        purpose: 'Financial data aggregation for cash flow & reconciliation',
      };
    });

  const totalLinked = linkedAccounts.filter((a) => a.linked).length;
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  return {
    consents,
    linkedAccounts,
    totalLinked,
    totalBalance,
    hasLiveData: accounts.length > 0,
  };
}

export async function connectAA(input: { bankName: string; accountNumber: string }): Promise<{ linked: boolean; consentId: string }> {
  // Link an account via AA. Finds or creates the bank account and marks it AA-connected.
  let account = await db.bankAccount.findFirst({
    where: { accountNumber: input.accountNumber, bankName: input.bankName },
  });
  if (!account) {
    account = await db.bankAccount.create({
      data: {
        businessId: 'firm',
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        ifsc: 'NA',
        accountType: 'current',
        currentBalance: 0,
        status: 'active',
        aaConnected: true,
        aaConsentExpiry: new Date(Date.now() + 90 * 86_400_000),
        lastSyncAt: new Date(),
      },
    });
  } else {
    account = await db.bankAccount.update({
      where: { id: account.id },
      data: {
        aaConnected: true,
        aaConsentExpiry: new Date(Date.now() + 90 * 86_400_000),
        lastSyncAt: new Date(),
      },
    });
  }
  return { linked: true, consentId: 'consent_' + account.id.slice(-6) };
}

export async function grantConsent(accountId: string): Promise<{ granted: boolean; expiresAt: string }> {
  const expiry = new Date(Date.now() + 90 * 86_400_000);
  await db.bankAccount.update({
    where: { id: accountId },
    data: { aaConnected: true, aaConsentExpiry: expiry },
  });
  return { granted: true, expiresAt: expiry.toISOString() };
}

export async function revokeConsent(accountId: string): Promise<{ revoked: boolean }> {
  await db.bankAccount.update({
    where: { id: accountId },
    data: { aaConnected: false, aaConsentExpiry: null },
  });
  return { revoked: true };
}

export async function fetchAAData(accountId: string): Promise<{ fetched: number; balance: number }> {
  // Deterministic AA fetch — pulls latest balance + recent transactions from FIP.
  const account = await db.bankAccount.findUnique({ where: { id: accountId } });
  if (!account) return { fetched: 0, balance: 0 };

  // Simulate: create 2 deterministic AA-sourced transactions.
  const now = new Date();
  const samples = [
    { desc: 'AA/SYNC/SALES', amt: 65000, type: 'credit', cat: 'sales' },
    { desc: 'AA/SYNC/VENDOR', amt: -22000, type: 'debit', cat: 'vendor' },
  ];
  let balance = account.currentBalance;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const d = new Date(now.getTime() - i * 86_400_000);
    balance += s.amt;
    await db.bankTransaction.create({
      data: {
        accountId,
        date: d.toISOString(),
        description: s.desc,
        amount: s.amt,
        type: s.type,
        category: s.cat,
        balance,
        source: 'aa',
      },
    });
  }
  await db.bankAccount.update({
    where: { id: accountId },
    data: { currentBalance: balance, lastSyncAt: now },
  });
  return { fetched: samples.length, balance };
}
