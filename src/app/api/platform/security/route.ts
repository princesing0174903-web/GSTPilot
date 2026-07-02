// GET /api/platform/security — security posture + audit events
import { NextResponse } from 'next/server';
import { getSecuritySummary, getRbacRoles, getAbacPolicies } from '@/lib/platform/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = await getSecuritySummary();
    return NextResponse.json(
      { ...summary, rbacRoles: getRbacRoles(), abacPolicies: getAbacPolicies() },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute security summary', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
