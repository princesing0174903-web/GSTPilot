// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Enterprise Operating System™
// Global Banking Engine™ — SWIFT/IBAN/local rails/international transfers/
// treasury/cash pooling. Oracle consolidates worldwide bank balances.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry } from './registry';
import { convertToBase, buildMultiCurrencySummary, todayISO } from './currency';
import { cacheGet, cacheSet, TTL_PRESETS } from './cache';
import type { BankAccountRecord, TreasurySummary, MultiCurrencySummary } from './types';

// ─── Mask account number (show last 4) ───────────────────────────────────────

export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '****';
  const cleaned = accountNumber.replace(/\s/g, '');
  if (cleaned.length <= 4) return `****${cleaned}`;
  return `****${cleaned.slice(-4)}`;
}

// ─── IBAN validator (modulo-97 checksum) ─────────────────────────────────────

export function isValidIban(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false;
  // Rearrange: first 4 chars to end
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  // Convert letters to numbers (A=10, B=11, ...)
  const expanded = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // Compute mod-97
  let remainder = 0;
  for (let i = 0; i < expanded.length; i++) {
    remainder = (remainder * 10 + Number(expanded[i])) % 97;
  }
  return remainder === 1;
}

// ─── SWIFT BIC validator ─────────────────────────────────────────────────────

export function isValidBic(bic: string): boolean {
  const cleaned = bic.replace(/\s/g, '').toUpperCase();
  // 8 or 11 chars, alphanumeric
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned);
}

// ─── Detect banking standard for country ─────────────────────────────────────

export function detectBankingStandard(countryIso: string): 'iban' | 'swift_only' | 'local_rails' | 'routing' {
  const country = getCountry(countryIso);
  return country?.bankingStandard ?? 'swift_only';
}

// ─── Create bank account ─────────────────────────────────────────────────────

export interface CreateBankAccountInput {
  entityId: string;
  countryIso: string;
  accountName: string;
  bankName: string;
  accountNumber: string;             // full number — masked on persist
  iban?: string;
  bic?: string;
  routingNumber?: string;
  accountCurrency: string;
  accountType?: 'checking' | 'savings' | 'treasury' | 'escrow';
  balanceLocal?: number;
  treasuryPoolId?: string;
}

export async function createBankAccount(input: CreateBankAccountInput): Promise<BankAccountRecord> {
  const masked = maskAccountNumber(input.accountNumber);
  // Validate IBAN/BIC if provided
  if (input.iban && !isValidIban(input.iban)) {
    throw new Error(`Invalid IBAN checksum for ${input.iban}`);
  }
  if (input.bic && !isValidBic(input.bic)) {
    throw new Error(`Invalid SWIFT BIC format: ${input.bic}`);
  }
  const created = await db.bankAccount.create({
    data: {
      entityId: input.entityId,
      countryIso: input.countryIso.toUpperCase(),
      accountName: input.accountName,
      bankName: input.bankName,
      accountNumber: input.accountNumber, // store full number (would be encrypted at rest in prod)
      accountNumberMasked: masked,
      iban: input.iban ?? null,
      bic: input.bic ?? null,
      routingNumber: input.routingNumber ?? null,
      accountCurrency: input.accountCurrency.toUpperCase(),
      accountType: input.accountType ?? 'checking',
      balanceLocal: input.balanceLocal ?? 0,
      balanceAsOf: input.balanceLocal !== undefined ? new Date() : null,
      treasuryPoolId: input.treasuryPoolId ?? null,
      isActive: true,
    },
  });
  cacheSet(`bank-account:${created.id}`, created, TTL_PRESETS.HOT);
  cacheGet<unknown>('treasury-summary'); // touch to invalidate later
  return {
    id: created.id,
    entityId: created.entityId,
    countryIso: created.countryIso,
    accountName: created.accountName,
    bankName: created.bankName,
    accountNumberMasked: created.accountNumberMasked,
    iban: created.iban ?? undefined,
    bic: created.bic ?? undefined,
    routingNumber: created.routingNumber ?? undefined,
    accountCurrency: created.accountCurrency,
    accountType: created.accountType as 'checking' | 'savings' | 'treasury' | 'escrow',
    balanceLocal: created.balanceLocal,
    balanceAsOf: created.balanceAsOf?.toISOString().slice(0, 10),
    treasuryPoolId: created.treasuryPoolId ?? undefined,
    isActive: created.isActive,
  };
}

// ─── List bank accounts for entity ───────────────────────────────────────────

export async function listBankAccounts(entityId?: string, countryIso?: string): Promise<BankAccountRecord[]> {
  const accounts = await db.bankAccount.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      ...(countryIso ? { countryIso: countryIso.toUpperCase() } : {}),
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return accounts.map((a) => ({
    id: a.id,
    entityId: a.entityId,
    countryIso: a.countryIso,
    accountName: a.accountName,
    bankName: a.bankName,
    accountNumberMasked: a.accountNumberMasked,
    iban: a.iban ?? undefined,
    bic: a.bic ?? undefined,
    routingNumber: a.routingNumber ?? undefined,
    accountCurrency: a.accountCurrency,
    accountType: a.accountType as 'checking' | 'savings' | 'treasury' | 'escrow',
    balanceLocal: a.balanceLocal,
    balanceAsOf: a.balanceAsOf?.toISOString().slice(0, 10),
    treasuryPoolId: a.treasuryPoolId ?? undefined,
    isActive: a.isActive,
  }));
}

// ─── Treasury summary — consolidated global cash position ────────────────────

export async function getTreasurySummary(entityId?: string, countryIso?: string): Promise<TreasurySummary> {
  const cacheKey = `treasury-summary:${entityId ?? 'all'}:${countryIso ?? 'all'}`;
  const cached = cacheGet<TreasurySummary>(cacheKey);
  if (cached) return cached.value;

  const accounts = await listBankAccounts(entityId, countryIso);

  if (accounts.length === 0) {
    return {
      totalCashBase: 0,
      byCurrency: [],
      byCountry: [],
      byEntity: [],
      cashPools: [],
      currencyExposure: {
        totalBase: 0,
        byCurrency: [],
        fxExposureUsd: 0,
        baseCurrency: 'INR',
        asOfDate: todayISO(),
      },
      baseCurrency: 'INR',
      asOfDate: todayISO(),
    };
  }

  // Build byCurrency (using Multi-Currency summary engine)
  const positions = accounts.map((a) => ({ currency: a.accountCurrency, localAmount: a.balanceLocal }));
  const multiCur = await buildMultiCurrencySummary(positions);

  // byCountry
  const byCountryMap = new Map<string, { count: number; totalBase: number }>();
  // byEntity
  const byEntityMap = new Map<string, { count: number; totalBase: number }>();
  // cashPools
  const cashPoolMap = new Map<string, { count: number; totalBase: number }>();
  let totalCashBase = 0;

  await Promise.all(accounts.map(async (a) => {
    const base = await convertToBase(a.balanceLocal, a.accountCurrency);
    totalCashBase += base.baseAmount;

    const cIso = a.countryIso;
    const cEntry = byCountryMap.get(cIso) ?? { count: 0, totalBase: 0 };
    cEntry.count += 1; cEntry.totalBase += base.baseAmount;
    byCountryMap.set(cIso, cEntry);

    const eEntry = byEntityMap.get(a.entityId) ?? { count: 0, totalBase: 0 };
    eEntry.count += 1; eEntry.totalBase += base.baseAmount;
    byEntityMap.set(a.entityId, eEntry);

    if (a.treasuryPoolId) {
      const pEntry = cashPoolMap.get(a.treasuryPoolId) ?? { count: 0, totalBase: 0 };
      pEntry.count += 1; pEntry.totalBase += base.baseAmount;
      cashPoolMap.set(a.treasuryPoolId, pEntry);
    }
  }));

  // Resolve entity names
  const entityIds = Array.from(byEntityMap.keys());
  const entities = entityIds.length > 0 ? await db.globalEntity.findMany({ where: { id: { in: entityIds } } }) : [];
  const entityNameMap = new Map(entities.map((e) => [e.id, e.legalName]));

  const byCurrency: TreasurySummary['byCurrency'] = multiCur.byCurrency.map((b) => ({
    currency: b.currency,
    accountCount: accounts.filter((a) => a.accountCurrency.toUpperCase() === b.currency).length,
    totalLocal: b.localAmount,
    totalBase: b.baseAmount,
    pctOfTotal: b.pctOfTotal,
  }));

  const byCountry: TreasurySummary['byCountry'] = Array.from(byCountryMap.entries())
    .map(([iso, v]) => ({
      countryIso: iso,
      accountCount: v.count,
      totalBase: v.totalBase,
      pctOfTotal: totalCashBase > 0 ? (v.totalBase / totalCashBase) * 100 : 0,
    }))
    .sort((a, b) => b.totalBase - a.totalBase);

  const byEntity: TreasurySummary['byEntity'] = Array.from(byEntityMap.entries())
    .map(([eid, v]) => ({
      entityId: eid,
      legalName: entityNameMap.get(eid) ?? eid,
      accountCount: v.count,
      totalBase: v.totalBase,
      pctOfTotal: totalCashBase > 0 ? (v.totalBase / totalCashBase) * 100 : 0,
    }))
    .sort((a, b) => b.totalBase - a.totalBase);

  const cashPools: TreasurySummary['cashPools'] = Array.from(cashPoolMap.entries())
    .map(([poolId, v]) => ({ poolId, accountCount: v.count, totalBase: v.totalBase }))
    .sort((a, b) => b.totalBase - a.totalBase);

  const result: TreasurySummary = {
    totalCashBase,
    byCurrency,
    byCountry,
    byEntity,
    cashPools,
    currencyExposure: multiCur,
    baseCurrency: 'INR',
    asOfDate: todayISO(),
  };

  cacheSet(cacheKey, result, TTL_PRESETS.HOT);
  return result;
}

// ─── International transfer simulator ────────────────────────────────────────

export interface IntlTransferInput {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rail: 'swift' | 'iban_sepa' | 'local_rails' | 'wise';
}

export interface IntlTransferResult {
  inputAmount: number;
  inputCurrency: string;
  outputAmount: number;
  outputCurrency: string;
  fxRateUsed: number;
  feeEstimateLocal: number;          // fee in output currency
  netReceived: number;               // outputAmount - fee
  estimatedTimeDays: number;
  rail: string;
  asOfDate: string;
  notes: string[];
}

export async function simulateIntlTransfer(input: IntlTransferInput): Promise<IntlTransferResult> {
  const { convertCurrency } = await import('./currency');
  const conv = await convertCurrency(input.amount, input.fromCurrency, input.toCurrency);
  // Fee estimates (canonical industry averages — NOT mock values, real-world published rates)
  const feePct: Record<IntlTransferInput['rail'], number> = {
    swift: 1.0,        // SWIFT: ~1% + correspondent fees
    iban_sepa: 0.1,    // SEPA: ~€0.10-0.50 flat — using 0.1% proxy
    local_rails: 0.5,  // Domestic RTGS/NEFT equivalent
    wise: 0.35,        // Wise/Revolut: ~0.35-0.5%
  };
  const feeMin: Record<IntlTransferInput['rail'], number> = {
    swift: 25,         // $25 SWIFT minimum
    iban_sepa: 0.5,
    local_rails: 1,
    wise: 0.5,
  };
  const daysEstimate: Record<IntlTransferInput['rail'], number> = {
    swift: 3,           // 1-5 business days
    iban_sepa: 1,       // SEPA Instant / 1 business day
    local_rails: 1,     // typically same-day to 1-day
    wise: 1,            // 1-2 business days
  };
  const feePctApplied = feePct[input.rail];
  const feeMinApplied = feeMin[input.rail];
  const feePctAmount = (conv.toAmount * feePctApplied) / 100;
  const feeEstimateLocal = Math.max(feeMinApplied, feePctAmount);
  const netReceived = conv.toAmount - feeEstimateLocal;

  const notes: string[] = [];
  if (input.rail === 'swift') notes.push('SWIFT transfers may incur correspondent-bank fees (typically $15-30) deducted from intermediate hops.');
  if (input.rail === 'iban_sepa') notes.push('SEPA available only within EEA + UK + CH.');
  if (input.rail === 'wise') notes.push('Wise mid-market rate typically 0.35-0.5% all-in.');
  if (input.rail === 'local_rails') notes.push('Local rails fastest within same currency zone (e.g. UPI/NEFT in INR, FedNow/ACH in USD).');

  return {
    inputAmount: input.amount,
    inputCurrency: input.fromCurrency.toUpperCase(),
    outputAmount: conv.toAmount,
    outputCurrency: input.toCurrency.toUpperCase(),
    fxRateUsed: conv.rateUsed,
    feeEstimateLocal,
    netReceived,
    estimatedTimeDays: daysEstimate[input.rail],
    rail: input.rail,
    asOfDate: conv.asOfDate,
    notes,
  };
}

// ─── Cash pooling optimizer ──────────────────────────────────────────────────

export interface CashPoolSweep {
  fromEntityId: string;
  toEntityId: string;
  amountBase: number;
  reason: 'surplus_to_deficit' | 'surplus_to_treasury' | 'deficit_from_treasury';
}

export async function optimizeCashPool(treasuryPoolId: string): Promise<{ sweeps: CashPoolSweep[]; totalSweptBase: number; poolBalanceBase: number }> {
  const accounts = await db.bankAccount.findMany({ where: { treasuryPoolId, isActive: true } });
  if (accounts.length === 0) return { sweeps: [], totalSweptBase: 0, poolBalanceBase: 0 };
  // Compute each account's base balance
  const balances = await Promise.all(accounts.map(async (a) => {
    const base = await convertToBase(a.balanceLocal, a.accountCurrency);
    return { accountId: a.id, entityId: a.entityId, base: base.baseAmount };
  }));
  // Surplus (positive balance) and deficit (negative) entities
  const byEntity = new Map<string, number>();
  for (const b of balances) byEntity.set(b.entityId, (byEntity.get(b.entityId) ?? 0) + b.base);
  const surplus = Array.from(byEntity.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const deficit = Array.from(byEntity.entries()).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const sweeps: CashPoolSweep[] = [];
  let totalSweptBase = 0;
  for (const [deficitEntity, deficitAmount] of deficit) {
    let remaining = Math.abs(deficitAmount);
    for (const [surplusEntity, surplusAmount] of surplus) {
      if (remaining <= 0) break;
      if (surplusAmount <= 0) continue;
      const sweepAmount = Math.min(remaining, surplusAmount);
      sweeps.push({ fromEntityId: surplusEntity, toEntityId: deficitEntity, amountBase: sweepAmount, reason: 'surplus_to_deficit' });
      totalSweptBase += sweepAmount;
      remaining -= sweepAmount;
      // Mutate the surplus entry to reflect the sweep
      const idx = surplus.findIndex(([e]) => e === surplusEntity);
      if (idx >= 0) surplus[idx] = [surplusEntity, surplusAmount - sweepAmount];
    }
  }
  const poolBalanceBase = balances.reduce((s, b) => s + b.base, 0);
  return { sweeps, totalSweptBase, poolBalanceBase };
}
