// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — POST /api/compliance/submit
// Marks a filing submitted, generates ackReference (simulated gov portal ack),
// records audit entry. Filing must be in 'approved' status.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  submitFiling, withComplianceApi, parseComplianceBody,
} from '@/lib/compliance-cloud';
import type { SubmitRequest } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/submit',
    method: 'POST',
    requiredAction: 'submit',
    auditActionType: 'filing_submitted',
    auditEntityType: 'filing',
    handler: async () => {
      const body = await parseComplianceBody<SubmitRequest>(req);
      if (!body) throw new Error('Request body is required');
      if (!body.filingId) throw new Error('filingId is required');
      if (!body.submittedBy) throw new Error('submittedBy is required');
      return submitFiling(body);
    },
  });
}
