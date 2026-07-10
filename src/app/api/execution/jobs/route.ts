// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET /api/execution/jobs
// Returns the unified ExecutionJob stream. Supports ?module=, ?status=,
// ?priority=, ?limit= (default 100, max 500), ?offset= filters. Returns { jobs, total }.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { buildUnifiedJobStream, withExecutionApi } from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/jobs',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const sp = req.nextUrl.searchParams;
      const moduleFilter = sp.get('module') ?? undefined;
      const status = sp.get('status') ?? undefined;
      const priority = sp.get('priority') ?? undefined;
      const limit = Math.min(Math.max(parseInt(sp.get('limit') ?? '100', 10) || 100, 1), 500);
      const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0);

      let jobs = await buildUnifiedJobStream(db);
      if (moduleFilter) jobs = jobs.filter((j) => j.module === moduleFilter);
      if (status) jobs = jobs.filter((j) => j.status === status);
      if (priority) jobs = jobs.filter((j) => j.priority === priority);

      const total = jobs.length;
      jobs = jobs.slice(offset, offset + limit);

      return { jobs, total };
    },
  });
}
