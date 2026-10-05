// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET /api/execution/workers
// Returns the Enterprise Worker roster with utilization stats, derived from the
// unified job stream + the ExecutionWorker table. Returns { roster, total, active, avgUtilizationPct }.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { buildUnifiedJobStream, buildWorkers, withExecutionApi } from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/workers',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const jobs = await buildUnifiedJobStream(db);
      const { roster, total, active, avgUtilizationPct } = await buildWorkers(db, jobs);
      return { roster, total, active, avgUtilizationPct };
    },
  });
}
