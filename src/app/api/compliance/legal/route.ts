// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/legal
// Returns the AI Legal Command Center™ summary — contracts, obligations,
// filing status, litigation risks, director responsibilities, Oracle narrative.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { getLegalSummary, withComplianceApi } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/legal',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => getLegalSummary(),
  });
}
