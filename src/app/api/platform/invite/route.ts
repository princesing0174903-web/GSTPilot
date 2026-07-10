// POST /api/platform/invite — invite a user to an organisation
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';
import { invalidatePlatformCache } from '@/lib/platform/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await ensurePlatformOrganizationsSeeded();
    const body = await request.json().catch(() => ({}));
    const organizationId: string = body.organizationId;
    const email: string = body.email;
    const name: string = body.name ?? email.split('@')[0];
    const role: string = body.role ?? 'member';
    const invitedBy: string = body.invitedBy ?? 'admin@gstpilot.ai';

    if (!organizationId || !email) {
      return NextResponse.json({ error: 'organizationId and email are required' }, { status: 400 });
    }

    const org = await db.platformOrganization.findUnique({ where: { id: organizationId } });
    if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

    const existing = await db.platformTenantUser.findFirst({ where: { organizationId, email } });
    if (existing) {
      return NextResponse.json({ success: true, message: 'User already invited', userId: existing.id });
    }

    const user = await db.platformTenantUser.create({
      data: {
        organizationId, email, name, role: role as 'member', status: 'invited',
        mfaEnabled: false,
      },
    });

    await db.platformAuditEvent.create({
      data: {
        organizationId, actor: invitedBy, action: 'user.invited',
        category: 'auth', severity: 'info',
        details: JSON.stringify({ email, name, role, userId: user.id }),
      },
    });

    invalidatePlatformCache();

    return NextResponse.json(
      { success: true, userId: user.id, status: 'invited', email, role },
      { status: 201, headers: { 'X-Platform': 'true' } },
    );
  } catch (error) {
    console.error('[Platform invite] Error:', error);
    return NextResponse.json(
      { error: 'Failed to invite user', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
