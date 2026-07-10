// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET /api/execution/alerts
// Returns the Global Alert Center summary: open alerts, severity breakdown,
// recent alerts with proposed Oracle fixes. Auto-detects failures from the
// unified job stream + explicit ExecutionAlert rows. Returns AlertCenterSummary.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { buildUnifiedJobStream, buildAlerts, withExecutionApi } from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/alerts',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const jobs = await buildUnifiedJobStream(db);
      const queuedCount = jobs.filter((j) => j.status === 'queued').length;
      return buildAlerts(db, jobs, queuedCount);
    },
  });
}
