// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — GET /api/compliance/score
// Returns overall Global Compliance Score™ + dimension breakdown. Optional:
//   ?scope=country   ?id=IN   → per-scope score record
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  computeScore, getOverallScore, getScoreBreakdown, withComplianceApi,
} from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/score',
    method: 'GET',
    requiredAction: 'read',
    handler: async () => {
      const sp = req.nextUrl.searchParams;
      const scope = sp.get('scope');
      const id = sp.get('id');
      if (scope && id) {
        const validScopes = ['organization', 'department', 'country', 'entity', 'vendor', 'employee'] as const;
        if (validScopes.includes(scope as typeof validScopes[number])) {
          const score = await computeScore(scope as typeof validScopes[number], id);
          return {
            score,
            breakdown: {
              tax: score.taxScore,
              payroll: score.payrollScore,
              corporate: score.corporateScore,
              banking: score.bankingScore,
              legal: score.legalScore,
            },
          };
        }
      }
      const overall = await getOverallScore();
      const breakdown = await getScoreBreakdown();
      return { overallScore: overall, breakdown };
    },
  });
}
