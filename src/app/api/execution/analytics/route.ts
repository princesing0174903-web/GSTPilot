// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET /api/execution/analytics
// Returns the Execution Analytics summary: throughput, success rate, durations,
// failure causes, real INR cost model, ROI, by-module & by-hour breakdowns.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { buildUnifiedJobStream, computeAnalytics, withExecutionApi } from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/analytics',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const jobs = await buildUnifiedJobStream(db);
      return computeAnalytics(jobs);
    },
  });
}
