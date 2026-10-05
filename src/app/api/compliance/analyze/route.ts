// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — POST /api/compliance/analyze
// Runs a full analysis (gather real data → twin → risks) WITHOUT persisting a
// submitted state. Returns draft filing + twin + risks + Oracle recommendation.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  analyzeFiling, withComplianceApi, parseComplianceBody,
} from '@/lib/compliance-cloud';
import type { AnalyzeRequest } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/analyze',
    method: 'POST',
    requiredAction: 'read',
    auditActionType: 'twin_simulated',
    auditEntityType: 'filing',
    handler: async () => {
      const body = await parseComplianceBody<AnalyzeRequest>(req);
      if (!body) throw new Error('Request body is required');
      if (!body.filingType) throw new Error('filingType is required');
      if (!body.period) throw new Error('period is required');
      if (!body.countryIso) throw new Error('countryIso is required');
      return analyzeFiling(body);
    },
  });
}
