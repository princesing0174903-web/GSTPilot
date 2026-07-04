// GET /api/global/currency — Multi-Currency Engine™
// Returns live exchange rates, historical rates, multi-currency exposure, FX conversion.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import {
  getFxRate,
  getFxRateHistory,
  getHistoricalRate,
  convertCurrency,
  buildMultiCurrencySummary,
  todayISO,
} from '@/lib/global-enterprise/currency';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/currency',
    method: 'GET',
    req,
    handler: async ({ query }) => {
      const action = query.get('action') ?? 'rates';

      // /api/global/currency?action=convert&from=USD&to=INR&amount=1000
      if (action === 'convert') {
        const from = query.get('from');
        const to = query.get('to');
        const amount = Number(query.get('amount') ?? '0');
        if (!from || !to) throw new Error('`from` and `to` currency codes required');
        const result = await convertCurrency(amount, from.toUpperCase(), to.toUpperCase());
        return { conversion: result };
      }

      // /api/global/currency?action=history&currency=USD&days=30
      if (action === 'history') {
        const currency = query.get('currency');
        const days = Number(query.get('days') ?? '30');
        if (!currency) throw new Error('`currency` parameter required');
        const history = await getFxRateHistory(currency.toUpperCase(), days);
        return { currency: currency.toUpperCase(), days, history };
      }

      // /api/global/currency?action=historical&currency=USD&date=2024-01-15
      if (action === 'historical') {
        const currency = query.get('currency');
        const date = query.get('date');
        if (!currency || !date) throw new Error('`currency` and `date` parameters required');
        const rate = await getHistoricalRate(currency.toUpperCase(), date);
        return { currency: currency.toUpperCase(), date, rate };
      }

      // /api/global/currency?action=exposure&positions=USD:1000,EUR:500,AED:2000
      if (action === 'exposure') {
        const positionsParam = query.get('positions') ?? '';
        const positions = positionsParam
          .split(',')
          .filter(Boolean)
          .map((p) => {
            const [currency, amount] = p.split(':');
            return { currency: currency.toUpperCase(), localAmount: Number(amount) };
          });
        if (positions.length === 0) {
          return { exposure: { totalBase: 0, byCurrency: [], fxExposureUsd: 0, baseCurrency: 'INR', asOfDate: todayISO() } };
        }
        const summary = await buildMultiCurrencySummary(positions);
        return { exposure: summary };
      }

      // Default: live rates for major currencies
      const currencies = (query.get('currencies') ?? 'USD,EUR,GBP,AED,SGD,AUD,CAD,JPY,CHF').split(',').filter(Boolean);
      const rates = await Promise.all(
        currencies.map(async (c) => {
          try {
            return await getFxRate(c.toUpperCase());
          } catch (err) {
            return { baseCurrency: 'INR', quoteCurrency: c.toUpperCase(), rate: 0, inverseRate: 0, asOfDate: todayISO(), source: 'error', error: (err as Error).message };
          }
        })
      );
      return {
        baseCurrency: 'INR',
        asOfDate: todayISO(),
        rates,
      };
    },
  });
}
