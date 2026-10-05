// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — POST /api/compliance/prepare
// Full pipeline: gather real data → compute summary → twin → detect risks →
// evaluate policy → persist ComplianceFiling → record audit entry → Oracle
// recommendation. Returns the filing + audit + recommendation.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  prepareFiling, withComplianceApi, parseComplianceBody,
} from '@/lib/compliance-cloud';
import type { PrepareRequest } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/prepare',
    method: 'POST',
    requiredAction: 'prepare',
    auditActionType: 'filing_prepared',
    auditEntityType: 'filing',
    handler: async () => {
      const body = await parseComplianceBody<PrepareRequest>(req);
      if (!body) throw new Error('Request body is required');
      if (!body.filingType) throw new Error('filingType is required');
      if (!body.period) throw new Error('period is required');
      if (!body.countryIso) throw new Error('countryIso is required');
      return prepareFiling(body);
    },
  });
}
