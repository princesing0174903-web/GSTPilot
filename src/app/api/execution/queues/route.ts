// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET /api/execution/queues
// Returns the Smart Execution Queue — entries + per-queue summaries, derived
// from the unified job stream + the ExecutionQueue table. Returns { entries, summaries }.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { buildUnifiedJobStream, buildQueues, withExecutionApi } from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/queues',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const jobs = await buildUnifiedJobStream(db);
      const { entries, summaries } = await buildQueues(db, jobs);
      return { entries, summaries };
    },
  });
}
