// GET /api/global/consolidation — Global Consolidation Engine™
// Returns consolidated revenue/expense/profit/tax/payroll/cash flow/assets/
// liabilities across every company and every country, with FX conversion.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getConsolidationReport, listConsolidationEntries, currentPeriod } from '@/lib/global-enterprise/consolidation';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/consolidation',
    method: 'GET',
    req,
    handler: async ({ auth, query }) => {
      const period = query.get('period') ?? currentPeriod();
      const firmId = query.get('firmId') ?? auth.firmId;
      const view = query.get('view') ?? 'report';

      // /api/global/consolidation?view=entries&entityId=xxx&metric=revenue
      if (view === 'entries') {
        const entityId = query.get('entityId') ?? undefined;
        const metric = query.get('metric') ?? undefined;
        const entries = await listConsolidationEntries(entityId, period, metric as Parameters<typeof listConsolidationEntries>[2]);
        return { period, entries };
      }

      // Default: full consolidation report
      const report = await getConsolidationReport(period, firmId);
      return report;
    },
  });
}
