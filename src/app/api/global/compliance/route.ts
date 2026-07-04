// GET /api/global/compliance — Global Compliance Engine™
// Returns compliance status across every jurisdiction: filing deadlines, audit
// requirements, labor/corporate/financial/privacy regulations, scores, upcoming.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import {
  getGlobalComplianceReport,
  getComplianceStatus,
  getUpcomingDeadlinesGlobally,
  getComplianceDeadlines,
} from '@/lib/global-enterprise/compliance';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/compliance',
    method: 'GET',
    req,
    handler: async ({ query }) => {
      const countryIso = query.get('countryIso');
      const daysAhead = Number(query.get('daysAhead') ?? '30');
      const view = query.get('view') ?? 'global';

      if (view === 'upcoming') {
        return { upcoming: await getUpcomingDeadlinesGlobally(daysAhead) };
      }
      if (countryIso) {
        const status = await getComplianceStatus(countryIso.toUpperCase());
        const deadlines = await getComplianceDeadlines(countryIso.toUpperCase());
        return { status, deadlines };
      }
      // Default: global report across all jurisdictions
      return getGlobalComplianceReport();
    },
  });
}
