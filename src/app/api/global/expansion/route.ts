// GET /api/global/expansion — Expansion Opportunities
// Returns ranked target countries for expansion: market attractiveness, regulatory
// complexity, tax burden, ease of doing business, setup cost, recommended structure.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getExpansionOpportunities, getExpansionOpportunity, getOperatingFootprint } from '@/lib/global-enterprise/expansion';
import type { Region } from '@/lib/global-enterprise/types';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/expansion',
    method: 'GET',
    req,
    handler: async ({ auth, query }) => {
      const firmId = query.get('firmId') ?? auth.firmId;
      const limit = Number(query.get('limit') ?? '15');
      const region = (query.get('region') ?? undefined) as Region | undefined;
      const excludeOperating = query.get('excludeOperating') === 'true';
      const countryIso = query.get('countryIso');

      if (countryIso) {
        const opportunity = await getExpansionOpportunity(countryIso.toUpperCase());
        if (!opportunity) throw new Error(`No expansion data for country: ${countryIso}`);
        return opportunity;
      }

      const view = query.get('view') ?? 'opportunities';
      if (view === 'footprint') {
        return getOperatingFootprint(firmId);
      }

      const opportunities = await getExpansionOpportunities({
        firmId,
        limit,
        region,
        excludeOperating,
      });
      return {
        total: opportunities.length,
        operatingFootprint: await getOperatingFootprint(firmId),
        opportunities,
      };
    },
  });
}
