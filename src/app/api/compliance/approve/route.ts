// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — POST /api/compliance/approve
// Validates the policy chain, marks the filing approved, records audit entry.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  approveFiling, withComplianceApi, parseComplianceBody,
} from '@/lib/compliance-cloud';
import type { ApproveRequest } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/approve',
    method: 'POST',
    requiredAction: 'approve',
    auditActionType: 'filing_approved',
    auditEntityType: 'filing',
    handler: async () => {
      const body = await parseComplianceBody<ApproveRequest>(req);
      if (!body) throw new Error('Request body is required');
      if (!body.filingId) throw new Error('filingId is required');
      if (!body.approvedBy) throw new Error('approvedBy is required');
      return approveFiling(body);
    },
  });
}
