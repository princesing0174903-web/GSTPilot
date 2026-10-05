// ═══════════════════════════════════════════════════════════════════════════════
// banks.ts — Bank adapter (Account Aggregator pattern)
//
// Provider: NO direct bank API. Each Indian bank (HDFC, ICICI, Axis, SBI, ...)
// has its own API with different auth flows and shapes. To unify them we use
// the RBI-regulated Account Aggregator (AA) framework (Anubhav, OneMoney,
// Setu, Finvu, etc.). The AA exposes a single consent-based API to pull
// transactions and balances from any linked bank account.
//
// Docs:
//   • Sahamati (AA industry body): https://sahamati.org.in/
//   • Setu AA: https://docs.setu.co/data/account-aggregator
//   • Finvu: https://docs.finvu.in/
//
// STATUS: PLACEHOLDER. Method signatures + types defined. Throws
// IntegrationNotConfiguredError without creds. Throws Error('Banks adapter
// requires a live Account Aggregator partner...') with creds but unwired AA
// API. NO fake data.
//
// To make this adapter live:
//   1. Sign up with an AA (Anubhav / OneMoney / Setu / Finvu).
//   2. Configure `aggregatorName` + `apiKey` + `apiSecret` in the Connection.
//   3. Implement the consent + fetch flow against the AA's API.
//   4. Map each AA transaction into ParsedBankTransaction.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  asCredentials,
  IntegrationNotConfiguredError,
  type BanksCredentials,
  type ConnectionRecord,
  type DecryptedCredentials,
  type ParsedBankAccount,
  type ParsedBankTransaction,
} from './types'
import { decryptCredentials } from './crypto'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface BankAccountRow {
  accountId: string // AA-side account id
  bankName: string
  accountNumberMasked: string // "XXXX1234"
  ifsc?: string
  accountType?: string
  accountHolder?: string
  currentBalance?: number
  availableBalance?: number
  currency?: string
}

export interface BankTransactionRow {
  txnId: string
  date: string // ISO
  description?: string
  amount: number // signed: +credit, -debit
  direction: 'in' | 'out'
  balanceAfter?: number
  referenceNo?: string
  counterparty?: string
  counterpartyAccount?: string
  counterpartyIfsc?: string
  raw: Record<string, unknown>
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function loadCredentials(conn: ConnectionRecord): BanksCredentials {
  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError('banks')
  }
  let raw: DecryptedCredentials
  try {
    raw = decryptCredentials(conn.credentialsEnc)
  } catch {
    throw new IntegrationNotConfiguredError(
      'banks',
      'Bank credentials are present but could not be decrypted. Re-configure the integration.',
    )
  }
  const creds = asCredentials('banks', raw)
  if (!creds.aggregatorName || !creds.apiKey || !creds.apiSecret) {
    throw new IntegrationNotConfiguredError(
      'banks',
      'Bank credentials are incomplete. Required: aggregatorName, apiKey, apiSecret. (Each bank has its own API — we use Account Aggregator for unified access.)',
    )
  }
  return creds
}

function requireAggregatorEnv(): {
  aaBaseUrl: string
} {
  const aaBaseUrl = process.env.BANK_AA_BASE_URL
  if (!aaBaseUrl) {
    throw new Error(
      'Banks adapter requires a live Account Aggregator partner — configure BANK_AA_BASE_URL env var (Anubhav, OneMoney, Setu, Finvu). Each bank has its own API (HDFC, ICICI, Axis, SBI); the AA framework unifies them under a single consent-based API.',
    )
  }
  return { aaBaseUrl }
}

// ─── Public adapter methods ─────────────────────────────────────────────────────

/**
 * List the bank accounts linked to this Connection via the AA. The AA returns
 * masked account numbers only ("XXXX1234") — the full number is never stored.
 */
export async function listAccounts(
  conn: ConnectionRecord,
): Promise<BankAccountRow[]> {
  const creds = loadCredentials(conn)
  const { aaBaseUrl } = requireAggregatorEnv()
  void creds
  void aaBaseUrl
  // TODO: const res = await fetch(`${aaBaseUrl}/accounts`, { headers: { 'x-aa-api-key': creds.apiKey, 'x-aa-api-secret': creds.apiSecret } })
  throw new Error(
    'Banks listAccounts() is not yet implemented. Wire the live GET to the Account Aggregator /accounts endpoint.',
  )
}

/**
 * Fetch the current balance for a single linked account.
 */
export async function getBalance(
  conn: ConnectionRecord,
  accountId: string,
): Promise<{ currentBalance: number; availableBalance: number }> {
  const creds = loadCredentials(conn)
  const { aaBaseUrl } = requireAggregatorEnv()
  void creds
  void aaBaseUrl
  void accountId
  throw new Error(
    'Banks getBalance() is not yet implemented. Wire the live GET to the AA /accounts/{id}/balance endpoint.',
  )
}

/**
 * Fetch transactions for an account in a date range. Returns signed amounts
 * (+ credit, - debit) and the running balance after each txn.
 */
export async function getTransactions(
  conn: ConnectionRecord,
  accountId: string,
  from: Date,
  to: Date,
): Promise<BankTransactionRow[]> {
  const creds = loadCredentials(conn)
  const { aaBaseUrl } = requireAggregatorEnv()
  void creds
  void aaBaseUrl
  void accountId
  void from
  void to
  throw new Error(
    'Banks getTransactions() is not yet implemented. Wire the live GET to the AA /accounts/{id}/transactions endpoint.',
  )
}

/**
 * Convenience — pulls all accounts + their recent transactions and returns
 * them in the parsed shapes the sync orchestrator expects.
 */
export async function pullAccountsAndTransactions(
  conn: ConnectionRecord,
  from: Date,
  to: Date,
): Promise<{ accounts: ParsedBankAccount[]; transactions: ParsedBankTransaction[] }> {
  const accounts = await listAccounts(conn)
  const parsedAccounts: ParsedBankAccount[] = accounts.map((a) => ({
    bankName: a.bankName,
    accountNumber: a.accountNumberMasked,
    accountNumberMasked: a.accountNumberMasked,
    ifsc: a.ifsc,
    accountType: a.accountType,
    accountHolder: a.accountHolder,
    currentBalance: a.currentBalance,
    availableBalance: a.availableBalance,
    currency: a.currency ?? 'INR',
  }))

  const parsedTxns: ParsedBankTransaction[] = []
  for (const a of accounts) {
    const txns = await getTransactions(conn, a.accountId, from, to)
    for (const t of txns) {
      parsedTxns.push({
        date: t.date,
        description: t.description,
        amount: t.amount,
        direction: t.direction,
        balanceAfter: t.balanceAfter,
        referenceNo: t.referenceNo,
        counterparty: t.counterparty,
        counterpartyAccount: t.counterpartyAccount,
        counterpartyIfsc: t.counterpartyIfsc,
        rawPayload: t.raw,
      })
    }
  }
  return { accounts: parsedAccounts, transactions: parsedTxns }
}
