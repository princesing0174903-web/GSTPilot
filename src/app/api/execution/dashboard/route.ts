// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 12: Executive APIs™ — GET /api/execution/dashboard
// Returns the full ExecutionDashboard payload (composed from all 14 subsystems).
// This is the main payload the Mission Control UI renders.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getExecutionDashboard, withExecutionApi } from '@/lib/execution-cloud';

export async function GET(req: NextRequest) {
  return withExecutionApi(req, {
    endpoint: '/api/execution/dashboard',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => getExecutionDashboard(db),
  });
}
