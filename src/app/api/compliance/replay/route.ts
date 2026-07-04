// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL COMPLIANCE CLOUD™ — Executive API™ — POST /api/compliance/replay
// Loads an audit entry by replayToken, reconstructs the before/after state.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import {
  replayFiling, withComplianceApi, parseComplianceBody,
} from '@/lib/compliance-cloud';
import type { ReplayRequest } from '@/lib/compliance-cloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withComplianceApi(req, {
    endpoint: '/api/compliance/replay',
    method: 'POST',
    requiredAction: 'replay',
    auditActionType: 'replay_requested',
    auditEntityType: 'filing',
    handler: async () => {
      const body = await parseComplianceBody<ReplayRequest>(req);
      if (!body) throw new Error('Request body is required');
      if (!body.replayToken) throw new Error('replayToken is required');
      return replayFiling(body);
    },
  });
}
