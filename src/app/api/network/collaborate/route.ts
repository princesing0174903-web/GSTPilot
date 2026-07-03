// POST /api/network/collaborate
// Open (or re-affirm) a collaboration with another organisation. Creates a
// partner relationship with the collaboration type + description captured in
// the message field, plus an optional workflowId reference.

import { NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/network/organizations';
import { createConnection } from '@/lib/network/enterprise-network';
import { invalidateNetworkCache } from '@/lib/network/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const toOrgId: string | undefined = body.toOrgId;
    const collaborationType: string | undefined = body.collaborationType;
    const description: string | undefined = body.description;

    if (!toOrgId || !collaborationType || !description) {
      return NextResponse.json(
        { error: 'toOrgId, collaborationType and description are required' },
        { status: 400 },
      );
    }

    const { orgId: fromOrgId, hostNodeName } = await resolveOrgId(body.fromOrgId);

    let message = `Collaboration: ${collaborationType} — ${description}`;
    if (body.workflowId) {
      message += ` (workflow: ${body.workflowId})`;
    }

    const connection = await createConnection({
      fromOrgId,
      toOrgId,
      fromNodeName: hostNodeName,
      toNodeName: toOrgId,
      relationshipType: 'partner',
      message,
      initiatedBy: hostNodeName,
    });

    invalidateNetworkCache();

    return NextResponse.json(
      { success: true, connection, collaborationType },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
      },
    );
  } catch (error) {
    console.error('[Network collaborate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start collaboration', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
