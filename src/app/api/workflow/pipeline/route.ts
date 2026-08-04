// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workflow/pipeline
//
// Returns the live Business Workflow Pipeline state:
//   Invoice Created → Customer Pays → Bank Detects → Auto-Match →
//     GST Updates → Oracle Reviews → User Approves → Done
//
// Every count comes from real Prisma data. 30-second server cache.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getWorkflowPipeline } from '@/lib/workflow/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || searchParams.get('firmId') || 'local';
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    const pipeline = await getWorkflowPipeline(organizationId, { forceRefresh });

    return NextResponse.json(pipeline, {
      headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' },
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load workflow pipeline');
  }
}
