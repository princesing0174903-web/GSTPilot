// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/audits
// Returns ComplianceAuditTrail entries. Optional filters:
//   ?entityType=filing   ?limit=50   ?actionType=filing_approved
//   ?country=IN          ?orgId=...
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { getAuditEntries, withComplianceApi } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/audits',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const sp = req.nextUrl.searchParams;
      const entityType = sp.get('entityType') ?? undefined;
      const actionType = sp.get('actionType') ?? undefined;
      const entityId = sp.get('entityId') ?? undefined;
      const organizationId = sp.get('orgId') ?? undefined;
      const countryIso = sp.get('country') ?? undefined;
      const limitStr = sp.get('limit');
      const limit = limitStr ? parseInt(limitStr, 10) : 50;
      return getAuditEntries({
        entityType: entityType ?? undefined,
        actionType: actionType ?? undefined,
        entityId: entityId ?? undefined,
        organizationId: organizationId ?? undefined,
        countryIso: countryIso ?? undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
      });
    },
  });
}
