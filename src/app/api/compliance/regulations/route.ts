// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/regulations
// Returns the Global Regulation Knowledge Graph™. Optional filters:
//   ?country=IN   ?type=gst   ?authority=CBIC   ?q=...
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  getRegulations, searchRegulations, withComplianceApi,
} from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/regulations',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const sp = req.nextUrl.searchParams;
      const country = sp.get('country') ?? undefined;
      const type = sp.get('type') ?? undefined;
      const authority = sp.get('authority') ?? undefined;
      const q = sp.get('q');
      if (q && q.trim().length > 0) {
        return searchRegulations(q);
      }
      return getRegulations({
        countryIso: country ?? undefined,
        regulationType: type ?? undefined,
        authority: authority ?? undefined,
      });
    },
  });
}
