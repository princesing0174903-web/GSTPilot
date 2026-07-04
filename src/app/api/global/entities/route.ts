// GET /api/global/entities — Global Organization Engine™
// Returns all legal entities (operating/holding/branch/subsidiary/jv/rep_office)
// with rich tree structure (parent-child, bank accounts, revenue, profit).

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getRichEntityTree, getEntityStats, listEntities } from '@/lib/global-enterprise/entities';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/entities',
    method: 'GET',
    req,
    handler: async ({ auth, query }) => {
      const firmId = query.get('firmId') ?? auth.firmId;
      const countryIso = query.get('countryIso') ?? undefined;
      const view = query.get('view') ?? 'tree';

      if (view === 'stats') {
        return getEntityStats(firmId);
      }
      if (view === 'flat') {
        return listEntities(firmId, countryIso);
      }
      // Default: tree
      return getRichEntityTree(firmId);
    },
  });
}
