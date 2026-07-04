// POST /api/global/consolidate — Manual consolidation trigger
// Forces re-extraction of REAL Prisma data into ConsolidationEntry rows for a
// given period. Useful for backfilling or refreshing data outside the cache TTL.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getConsolidationReport, persistEntityMetricsForPeriod, currentPeriod } from '@/lib/global-enterprise/consolidation';
import { db } from '@/lib/db';
import { cacheInvalidate } from '@/lib/global-enterprise/cache';

interface ConsolidateBody {
  period?: string;        // YYYY-MM, defaults to current
  entityId?: string;      // optional: only one entity
  firmId?: string;
}

export async function POST(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/consolidate',
    method: 'POST',
    req,
    handler: async ({ auth, body }) => {
      const b = (body ?? {}) as ConsolidateBody;
      const period = b.period ?? currentPeriod();
      const firmId = b.firmId ?? auth.firmId;

      // If entityId provided, only persist for that one entity
      if (b.entityId) {
        await persistEntityMetricsForPeriod(b.entityId, period);
        cacheInvalidate('consolidation-report');
        cacheInvalidate('global-executive-dashboard');
        return { ok: true, period, entityId: b.entityId, message: 'Metrics persisted for entity.' };
      }

      // Otherwise: persist for all consolidated entities, then return fresh report
      const entities = await db.globalEntity.findMany({
        where: { consolidated: true, ...(firmId ? { firmId } : {}), status: { not: 'divested' } },
        select: { id: true },
      });
      const persistedCount = await Promise.all(
        entities.map(async (e) => {
          try {
            await persistEntityMetricsForPeriod(e.id, period);
            return true;
          } catch {
            return false;
          }
        })
      );
      const successCount = persistedCount.filter(Boolean).length;
      cacheInvalidate('consolidation-report');
      cacheInvalidate('global-executive-dashboard');
      const report = await getConsolidationReport(period, firmId);
      return {
        ok: true,
        period,
        entitiesProcessed: entities.length,
        entitiesSucceeded: successCount,
        report,
      };
    },
  });
}
