// GET /api/global/treasury — Global Banking Engine™
// Returns worldwide banking: SWIFT/IBAN/local rails/international transfers,
// treasury management, cash pooling, multi-currency balances.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getTreasurySummary, listBankAccounts, simulateIntlTransfer, optimizeCashPool } from '@/lib/global-enterprise/banking';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/treasury',
    method: 'GET',
    req,
    handler: async ({ query }) => {
      const action = query.get('action') ?? 'summary';

      // /api/global/treasury?action=accounts&entityId=xxx
      if (action === 'accounts') {
        const entityId = query.get('entityId') ?? undefined;
        const countryIso = query.get('countryIso') ?? undefined;
        const accounts = await listBankAccounts(entityId, countryIso);
        return { total: accounts.length, accounts };
      }

      // /api/global/treasury?action=transfer&fromCurrency=USD&toCurrency=INR&amount=1000&rail=swift
      if (action === 'transfer') {
        const fromCurrency = query.get('fromCurrency');
        const toCurrency = query.get('toCurrency');
        const amount = Number(query.get('amount') ?? '0');
        const rail = (query.get('rail') ?? 'swift') as 'swift' | 'iban_sepa' | 'local_rails' | 'wise';
        if (!fromCurrency || !toCurrency || !amount) {
          throw new Error('`fromCurrency`, `toCurrency`, and `amount` query parameters required');
        }
        const result = await simulateIntlTransfer({
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          amount,
          rail,
        });
        return { transfer: result };
      }

      // /api/global/treasury?action=pool&poolId=xxx
      if (action === 'pool') {
        const poolId = query.get('poolId');
        if (!poolId) throw new Error('`poolId` parameter required');
        const result = await optimizeCashPool(poolId);
        return { pool: result };
      }

      // Default: treasury summary
      const summary = await getTreasurySummary();
      return summary;
    },
  });
}
