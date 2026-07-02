// POST /api/platform/provision — provision tenant infrastructure (AGI, devops env)
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';
import { provisionEnvironment } from '@/lib/platform/devops';
import { createApiKey } from '@/lib/platform/api-platform';
import { invalidatePlatformCache } from '@/lib/platform/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await ensurePlatformOrganizationsSeeded();
    const body = await request.json().catch(() => ({}));
    const organizationId: string = body.organizationId;
    const provisionType: string = body.provisionType ?? 'environment';
    const region: string = body.region ?? 'ap-south-1';
    const provisionedBy: string = body.provisionedBy ?? 'oracle';
    const name: string = body.name ?? 'preview';
    const environmentType: string = body.environmentType ?? 'preview';

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const org = await db.platformOrganization.findUnique({ where: { id: organizationId } });
    if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

    const results: Record<string, unknown> = { organizationId, organizationName: org.name };

    if (provisionType === 'environment' || provisionType === 'all') {
      const env = await provisionEnvironment(
        organizationId, name,
        environmentType as 'production' | 'staging' | 'development' | 'sandbox' | 'preview',
        region, provisionedBy,
      );
      results.environment = env;
    }

    if (provisionType === 'api_key' || provisionType === 'all') {
      const keyName: string = body.keyName ?? `${name} API Key`;
      const scopes: string[] = body.scopes ?? ['read', 'write'];
      const apiKey = await createApiKey(organizationId, keyName, scopes, provisionedBy);
      results.apiKey = { ...apiKey, fullKeyPreview: apiKey.keyPrefix + '••••' };
    }

    if (provisionType === 'agi' || provisionType === 'all') {
      // Provision AGI instance — update org settings
      await db.platformOrganization.update({
        where: { id: organizationId },
        data: {
          settings: JSON.stringify({ isolatedTenant: true, agiInstance: 'provisioned', region, provisionedAt: new Date().toISOString() }),
        },
      });
      await db.platformAuditEvent.create({
        data: {
          organizationId, actor: provisionedBy, action: 'agi.provisioned',
          category: 'config', severity: 'info',
          details: JSON.stringify({ region, instance: 'agi' }),
        },
      });
      results.agi = { status: 'provisioned', region };
    }

    invalidatePlatformCache();

    return NextResponse.json(
      { success: true, provisionType, ...results },
      { status: 201, headers: { 'X-Platform': 'true' } },
    );
  } catch (error) {
    console.error('[Platform provision] Error:', error);
    return NextResponse.json(
      { error: 'Failed to provision', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
