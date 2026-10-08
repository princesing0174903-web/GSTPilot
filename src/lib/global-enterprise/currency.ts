// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Global Enterprise Operating System™
// Multi-Currency Engine™ — Live + historical FX rates, multi-currency conversion,
// consolidated multi-currency reporting. Base currency = INR (VEYRO is India-rooted).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { BASE_CURRENCY, BOOTSTRAP_FX_RATES } from './registry';
import { cacheGet, cacheSet, TTL_PRESETS, buildKey } from './cache';
import type {
  CurrencyRateRecord,
  CurrencyConversionResult,
  MultiCurrencySummary,
} from './types';

// ─── Date helper ─────────────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Live FX rate fetcher (exchangerate.host — free, no API key) ─────────────

interface FetchedRate {
  base: string;
  date: string;
  rates: Record<string, number>;
}

async function fetchLiveRates(base: string): Promise<FetchedRate | null> {
  try {
    const url = `https://api.exchangerate.host/latest?base=${base}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as FetchedRate;
    if (!json?.rates || typeof json.rates !== 'object') return null;
    return json;
  } catch {
    return null;
  }
}

// ─── Persist FX rate (idempotent via unique constraint) ──────────────────────

async function persistRate(base: string, quote: string, rate: number, asOf: string, source: string): Promise<void> {
  if (rate <= 0 || !isFinite(rate)) return;
  const inverse = 1 / rate;
  try {
    await db.currencyRate.upsert({
      where: { baseCurrency_quoteCurrency_asOfDate: { baseCurrency: base, quoteCurrency: quote, asOfDate: asOf } },
      create: { baseCurrency: base, quoteCurrency: quote, rate, inverseRate: inverse, asOfDate: asOf, source },
      update: { rate, inverseRate: inverse, source },
    });
  } catch {
    // ignore — best-effort persistence
  }
}

// ─── Get FX rate (live → cached DB → bootstrap fallback) ─────────────────────

export interface RateFetchOptions {
  asOf?: string;            // YYYY-MM-DD; default today
  useLive?: boolean;        // fetch live if possible (default true)
  forceRefresh?: boolean;   // bypass cache
}

export async function getFxRate(quoteCurrency: string, opts: RateFetchOptions = {}): Promise<CurrencyRateRecord> {
  const base = BASE_CURRENCY;
  const quote = quoteCurrency.toUpperCase();
  const asOf = opts.asOf ?? todayISO();
  if (quote === base) {
    return { baseCurrency: base, quoteCurrency: quote, rate: 1, inverseRate: 1, asOfDate: asOf, source: 'identity' };
  }

  // 1. Cache hit
  const cacheKey = buildKey('fx-rate', { base, quote, asOf });
  if (!opts.forceRefresh) {
    const cached = cacheGet<CurrencyRateRecord>(cacheKey);
    if (cached) return cached.value;
  }

  // 2. DB hit (historical or persisted today)
  const dbRow = await db.currencyRate.findUnique({
    where: { baseCurrency_quoteCurrency_asOfDate: { baseCurrency: base, quoteCurrency: quote, asOfDate: asOf } },
  });
  if (dbRow) {
    const rec: CurrencyRateRecord = {
      baseCurrency: dbRow.baseCurrency,
      quoteCurrency: dbRow.quoteCurrency,
      rate: dbRow.rate,
      inverseRate: dbRow.inverseRate,
      asOfDate: dbRow.asOfDate,
      source: dbRow.source,
    };
    cacheSet(cacheKey, rec, TTL_PRESETS.FROZEN);
    return rec;
  }

  // 3. Live fetch
  if (opts.useLive !== false) {
    const live = await fetchLiveRates(base);
    if (live && typeof live.rates[quote] === 'number') {
      const rate = live.rates[quote];
      await persistRate(base, quote, rate, live.date || asOf, 'exchangerate.host');
      // Also persist a batch of major quotes for free historical reuse
      const major = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'CHF', 'JPY', 'CNY'];
      for (const q of major) {
        if (q !== quote && typeof live.rates[q] === 'number') {
          await persistRate(base, q, live.rates[q], live.date || asOf, 'exchangerate.host');
        }
      }
      const rec: CurrencyRateRecord = {
        baseCurrency: base,
        quoteCurrency: quote,
        rate,
        inverseRate: 1 / rate,
        asOfDate: live.date || asOf,
        source: 'exchangerate.host',
      };
      cacheSet(cacheKey, rec, TTL_PRESETS.FROZEN);
      return rec;
    }
  }

  // 4. Latest DB fallback (most recent ≤ asOf)
  const latest = await db.currencyRate.findFirst({
    where: { baseCurrency: base, quoteCurrency: quote, asOfDate: { lte: asOf } },
    orderBy: { asOfDate: 'desc' },
  });
  if (latest) {
    const rec: CurrencyRateRecord = {
      baseCurrency: latest.baseCurrency,
      quoteCurrency: latest.quoteCurrency,
      rate: latest.rate,
      inverseRate: latest.inverseRate,
      asOfDate: latest.asOfDate,
      source: latest.source,
    };
    cacheSet(cacheKey, rec, TTL_PRESETS.HOT);
    return rec;
  }

  // 5. Bootstrap fallback (canonical reference rates)
  const boot = BOOTSTRAP_FX_RATES[quote];
  if (boot) {
    const rec: CurrencyRateRecord = {
      baseCurrency: base,
      quoteCurrency: quote,
      rate: boot.rate,
      inverseRate: boot.inverse,
      asOfDate: asOf,
      source: 'bootstrap',
    };
    // Persist bootstrap rate so subsequent reads hit DB
    await persistRate(base, quote, boot.rate, asOf, 'bootstrap');
    cacheSet(cacheKey, rec, TTL_PRESETS.WARM);
    return rec;
  }

  // 6. Identity fallback (should never reach here for known currencies)
  return { baseCurrency: base, quoteCurrency: quote, rate: 1, inverseRate: 1, asOfDate: asOf, source: 'fallback-identity' };
}

// ─── Convert amount between any two currencies ───────────────────────────────

export async function convertCurrency(
  fromAmount: number,
  fromCurrency: string,
  toCurrency: string,
  opts?: RateFetchOptions
): Promise<CurrencyConversionResult> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return {
      fromAmount,
      fromCurrency: fromCurrency.toUpperCase(),
      toAmount: fromAmount,
      toCurrency: toCurrency.toUpperCase(),
      rateUsed: 1,
      asOfDate: opts?.asOf ?? todayISO(),
      source: 'identity',
    };
  }
  const base = BASE_CURRENCY;
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Get rates vs base
  const [fromRate, toRate] = await Promise.all([
    getFxRate(from, opts),
    getFxRate(to, opts),
  ]);

  // fromAmount in `from` → base → to
  const baseAmount = fromAmount / fromRate.rate;   // fromAmount * (1 / rateFromBase)
  const toAmount = baseAmount * toRate.rate;        // baseAmount * rateToBase

  const crossRate = toAmount / fromAmount;

  return {
    fromAmount,
    fromCurrency: from,
    toAmount,
    toCurrency: to,
    rateUsed: crossRate,
    asOfDate: toRate.asOfDate,
    source: `${fromRate.source}+${toRate.source}`,
  };
}

// ─── Convert to base (INR) ───────────────────────────────────────────────────

export async function convertToBase(
  amountLocal: number,
  localCurrency: string,
  opts?: RateFetchOptions
): Promise<{ baseAmount: number; rate: number; asOfDate: string; source: string }> {
  if (localCurrency.toUpperCase() === BASE_CURRENCY) {
    return { baseAmount: amountLocal, rate: 1, asOfDate: opts?.asOf ?? todayISO(), source: 'identity' };
  }
  const rec = await getFxRate(localCurrency, opts);
  // 1 quote = inverseRate base, so amountLocal quote = amountLocal * inverseRate base
  // BUT our `rate` = "1 base = rate quote" so 1 quote = 1/rate base = inverseRate base
  const baseAmount = amountLocal * rec.inverseRate;
  return { baseAmount, rate: rec.inverseRate, asOfDate: rec.asOfDate, source: rec.source };
}

// ─── Multi-currency summary (used by treasury + dashboard) ───────────────────

export async function buildMultiCurrencySummary(
  positions: Array<{ currency: string; localAmount: number }>,
  opts?: RateFetchOptions
): Promise<MultiCurrencySummary> {
  if (positions.length === 0) {
    return {
      totalBase: 0,
      byCurrency: [],
      fxExposureUsd: 0,
      baseCurrency: BASE_CURRENCY,
      asOfDate: opts?.asOf ?? todayISO(),
    };
  }
  const currencies = Array.from(new Set(positions.map((p) => p.currency.toUpperCase())));
  const rateMap = new Map<string, { rate: number; inverse: number; asOf: string; source: string }>();
  await Promise.all(
    currencies.map(async (cur) => {
      const rec = await getFxRate(cur, opts);
      rateMap.set(cur, { rate: rec.rate, inverse: rec.inverseRate, asOf: rec.asOfDate, source: rec.source });
    })
  );

  let totalBase = 0;
  const byCurrency: MultiCurrencySummary['byCurrency'] = [];
  for (const cur of currencies) {
    const localSum = positions
      .filter((p) => p.currency.toUpperCase() === cur)
      .reduce((s, p) => s + p.localAmount, 0);
    const r = rateMap.get(cur)!;
    const baseAmount = cur === BASE_CURRENCY ? localSum : localSum * r.inverse;
    totalBase += baseAmount;
    byCurrency.push({
      currency: cur,
      localAmount: localSum,
      baseAmount,
      fxRate: r.inverse,
      fxAsOf: r.asOf,
      pctOfTotal: 0, // set below
    });
  }
  // fill pctOfTotal
  for (const item of byCurrency) item.pctOfTotal = totalBase > 0 ? (item.baseAmount / totalBase) * 100 : 0;
  byCurrency.sort((a, b) => b.baseAmount - a.baseAmount);

  // FX exposure in USD = sum of non-base positions converted to USD
  let fxExposureUsd = 0;
  const usdRate = rateMap.get('USD');
  if (usdRate) {
    fxExposureUsd = byCurrency
      .filter((b) => b.currency !== BASE_CURRENCY)
      .reduce((sum, b) => {
        // baseAmount (INR) → USD: baseAmount * usdRate.rate (since rate = "1 INR = rate USD")
        return sum + b.baseAmount * usdRate.rate;
      }, 0);
  }

  return {
    totalBase,
    byCurrency,
    fxExposureUsd,
    baseCurrency: BASE_CURRENCY,
    asOfDate: opts?.asOf ?? todayISO(),
  };
}

// ─── Historical FX (last N days) ─────────────────────────────────────────────

export async function getHistoricalRate(quoteCurrency: string, asOf: string): Promise<CurrencyRateRecord | null> {
  const base = BASE_CURRENCY;
  const quote = quoteCurrency.toUpperCase();
  if (quote === base) {
    return { baseCurrency: base, quoteCurrency: quote, rate: 1, inverseRate: 1, asOfDate: asOf, source: 'identity' };
  }
  const exact = await db.currencyRate.findUnique({
    where: { baseCurrency_quoteCurrency_asOfDate: { baseCurrency: base, quoteCurrency: quote, asOfDate: asOf } },
  });
  if (exact) {
    return { baseCurrency: exact.baseCurrency, quoteCurrency: exact.quoteCurrency, rate: exact.rate, inverseRate: exact.inverseRate, asOfDate: exact.asOfDate, source: exact.source };
  }
  const latest = await db.currencyRate.findFirst({
    where: { baseCurrency: base, quoteCurrency: quote, asOfDate: { lte: asOf } },
    orderBy: { asOfDate: 'desc' },
  });
  if (latest) {
    return { baseCurrency: latest.baseCurrency, quoteCurrency: latest.quoteCurrency, rate: latest.rate, inverseRate: latest.inverseRate, asOfDate: latest.asOfDate, source: latest.source };
  }
  return null;
}

// ─── FX rate history (last N days for chart) ─────────────────────────────────

export async function getFxRateHistory(quoteCurrency: string, days = 30): Promise<CurrencyRateRecord[]> {
  const base = BASE_CURRENCY;
  const quote = quoteCurrency.toUpperCase();
  if (quote === base) return [];
  const rows = await db.currencyRate.findMany({
    where: { baseCurrency: base, quoteCurrency: quote },
    orderBy: { asOfDate: 'desc' },
    take: Math.min(days, 365),
  });
  return rows
    .map((r) => ({
      baseCurrency: r.baseCurrency,
      quoteCurrency: r.quoteCurrency,
      rate: r.rate,
      inverseRate: r.inverseRate,
      asOfDate: r.asOfDate,
      source: r.source,
    }))
    .reverse();
}
