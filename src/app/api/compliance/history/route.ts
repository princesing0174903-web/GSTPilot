// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/history
// Compliance history feed — returns the last 100 audit-trail entries (chronological).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { getAuditEntries, withComplianceApi } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/history',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => getAuditEntries({ limit: 100 }),
  });
}
