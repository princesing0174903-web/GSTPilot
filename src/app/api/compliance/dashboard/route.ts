// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/dashboard
// Returns the unified ComplianceDashboard payload (60s in-memory cache).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { getComplianceDashboard, withComplianceApi } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/dashboard',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => getComplianceDashboard(),
  });
}
