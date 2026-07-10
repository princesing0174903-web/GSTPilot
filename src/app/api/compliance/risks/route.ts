// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/risks
// Runs risk detection and returns detected + persisted risks. Optional filters:
//   ?status=open          ?severity=critical
//   ?riskType=late_filing ?country=IN
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { detectRisks, withComplianceApi } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/risks',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const sp = req.nextUrl.searchParams;
      const status = sp.get('status') ?? undefined;
      const severity = sp.get('severity') ?? undefined;
      const riskType = sp.get('riskType') ?? undefined;
      const country = sp.get('country') ?? undefined;
      return detectRisks({
        status: status ?? undefined,
        severity: severity ?? undefined,
        riskType: riskType ?? undefined,
        countryIso: country ?? undefined,
      });
    },
  });
}
