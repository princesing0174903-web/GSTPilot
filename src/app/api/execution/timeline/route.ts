// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET /api/execution/timeline
// Unified execution timeline derived from the unified job stream. Supports
// optional ?module=, ?status=, ?limit= filters. Returns TimelineSummary.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { buildUnifiedJobStream, buildTimeline, withExecutionApi } from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/timeline',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const sp = req.nextUrl.searchParams;
      const moduleFilter = sp.get('module') ?? undefined;
      const status = sp.get('status') ?? undefined;
      const limitRaw = sp.get('limit');
      const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 100, 1), 500) : undefined;

      let jobs = await buildUnifiedJobStream(db);
      if (moduleFilter) jobs = jobs.filter((j) => j.module === moduleFilter);
      if (status) jobs = jobs.filter((j) => j.status === status);
      if (limit) jobs = jobs.slice(0, limit);

      return buildTimeline(jobs);
    },
  });
}
