// POST /api/network/invite
// Send an invitation to an external organisation to join the Global Enterprise
// Network™. Creates a pending connection where the recipient is not yet a node.

import { NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/network/organizations';
import { createConnection } from '@/lib/network/enterprise-network';
import { invalidateNetworkCache } from '@/lib/network/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `org-${Date.now()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const toOrgName: string | undefined = body.toOrgName;
    const toOrgEmail: string | undefined = body.toOrgEmail;

    if (!toOrgName || !toOrgEmail) {
      return NextResponse.json(
        { error: 'toOrgName and toOrgEmail are required' },
        { status: 400 },
      );
    }

    const { orgId: fromOrgId, hostNodeName } = await resolveOrgId(body.fromOrgId);

    // Use the invitee email as toOrgId if it looks like a stable identifier,
    // otherwise fall back to a slug generated from the org name.
    const toOrgId = toOrgEmail.includes('@') ? toOrgEmail : slugify(toOrgName);

    const connection = await createConnection({
      fromOrgId,
      toOrgId,
      fromNodeName: hostNodeName,
      toNodeName: toOrgName,
      relationshipType: body.relationshipType ?? 'partner',
      message: body.message ?? `Invitation to join the GSTPilot Global Enterprise Network™`,
      initiatedBy: hostNodeName,
    });

    invalidateNetworkCache();

    return NextResponse.json(
      { success: true, connection, message: 'Invitation sent' },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
      },
    );
  } catch (error) {
    console.error('[Network invite] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
