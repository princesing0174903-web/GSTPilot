// POST /api/network/connect
// Create an org-to-org connection request (pending) between two known network nodes.

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
    const fromNodeName: string | undefined = body.fromNodeName;
    const toNodeName: string | undefined = body.toNodeName;

    if (!toOrgId || !fromNodeName || !toNodeName) {
      return NextResponse.json(
        { error: 'toOrgId, fromNodeName and toNodeName are required' },
        { status: 400 },
      );
    }

    const { orgId: fromOrgId, hostNodeName } = await resolveOrgId(body.fromOrgId);

    const connection = await createConnection({
      fromOrgId,
      toOrgId,
      fromNodeName,
      toNodeName,
      relationshipType: body.relationshipType,
      message: body.message,
      initiatedBy: body.initiatedBy ?? hostNodeName,
    });

    invalidateNetworkCache();

    return NextResponse.json(
      { success: true, connection },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
      },
    );
  } catch (error) {
    console.error('[Network connect] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create connection', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
