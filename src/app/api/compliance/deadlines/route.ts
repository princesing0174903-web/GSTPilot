// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/deadlines
// Returns global upcoming deadlines (default 30 days). Optional filters:
//   ?country=IN  → per-country deadlines
//   ?days=60     → horizon in days
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  getGlobalDeadlines, getDeadlinesByCountry, withComplianceApi,
} from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/deadlines',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const sp = req.nextUrl.searchParams;
      const country = sp.get('country');
      const days = parseInt(sp.get('days') ?? '30', 10);
      const horizon = Number.isFinite(days) && days > 0 ? days : 30;
      if (country) {
        return getDeadlinesByCountry(country);
      }
      return getGlobalDeadlines(horizon);
    },
  });
}
