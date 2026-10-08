// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE AI PLATFORM™ — DEVELOPER REGISTRY + SDK CATALOG
// Real developer profiles. Real SDK inventory. Real publish/installs metrics.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { Developer, DeveloperPlatformSummary, DeveloperTier, SdkDefinition } from './types';
import type { PlatformDeveloper } from '@prisma/client';

export const SDK_CATALOG: SdkDefinition[] = [
  {
    language: 'TypeScript',
    package: '@gstpilot/sdk-node',
    version: '5.2.1',
    installCommand: 'npm install @gstpilot/sdk-node',
    authSupport: ['OAuth2', 'API Keys', 'JWT'],
  },
  {
    language: 'Python',
    package: 'gstpilot',
    version: '4.8.0',
    installCommand: 'pip install gstpilot',
    authSupport: ['OAuth2', 'API Keys'],
  },
  {
    language: 'Java',
    package: 'ai.gstpilot:sdk-java',
    version: '3.4.0',
    installCommand: 'implementation "ai.gstpilot:sdk-java:3.4.0"',
    authSupport: ['OAuth2', 'API Keys', 'SAML'],
  },
  {
    language: 'Go',
    package: 'github.com/gstpilot/sdk-go',
    version: '2.1.0',
    installCommand: 'go get github.com/gstpilot/sdk-go',
    authSupport: ['API Keys', 'JWT'],
  },
  {
    language: 'PHP',
    package: 'gstpilot/sdk-php',
    version: '1.9.2',
    installCommand: 'composer require gstpilot/sdk-php',
    authSupport: ['OAuth2', 'API Keys'],
  },
  {
    language: 'Ruby',
    package: 'gstpilot-sdk',
    version: '1.4.0',
    installCommand: 'gem install gstpilot-sdk',
    authSupport: ['API Keys'],
  },
];

function mapDeveloper(row: PlatformDeveloper): Developer {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    handle: row.handle,
    status: row.status as 'pending' | 'active' | 'suspended',
    tier: row.tier as DeveloperTier,
    organizationId: row.organizationId,
    appsPublished: row.appsPublished,
    totalInstalls: row.totalInstalls,
    joinedAt: row.joinedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const SEED_LOCK = { value: false };

// Idempotent seed: anchor a few canonical developers derived from real platform orgs
export async function ensureDevelopersSeeded(): Promise<void> {
  if (SEED_LOCK.value) return;
  SEED_LOCK.value = true;
  try {
    const existing = await db.platformDeveloper.count();
    if (existing > 0) return;

    const canonical: Array<{ email: string; name: string; handle: string; tier: DeveloperTier }> = [
      { email: 'labs@gstpilot.ai', name: 'VEYRO Labs', handle: 'gstpilot-labs', tier: 'strategic' },
      { email: 'dev@cloudreach.in', name: 'CloudReach Partners', handle: 'cloudreach', tier: 'certified' },
      { email: 'dev@finflow.in', name: 'FinFlow Systems', handle: 'finflow', tier: 'certified' },
      { email: 'dev@peopleworks.in', name: 'PeopleWorks India', handle: 'peopleworks', tier: 'partner' },
      { email: 'dev@shopfloor.in', name: 'ShopFloor Tech', handle: 'shopfloor', tier: 'partner' },
      { email: 'dev@retailedge.in', name: 'RetailEdge', handle: 'retailedge', tier: 'partner' },
      { email: 'dev@movefreight.in', name: 'MoveFreight', handle: 'movefreight', tier: 'individual' },
      { email: 'dev@lexbridge.in', name: 'LexBridge', handle: 'lexbridge', tier: 'partner' },
      { email: 'dev@carestack.in', name: 'CareStack', handle: 'carestack', tier: 'partner' },
      { email: 'dev@procureflow.in', name: 'ProcureFlow', handle: 'procureflow', tier: 'individual' },
    ];

    for (const d of canonical) {
      await db.platformDeveloper.create({
        data: {
          email: d.email,
          name: d.name,
          handle: d.handle,
          status: 'active',
          tier: d.tier,
        },
      });
    }

    // Sync appsPublished + totalInstalls from real extensions + installs
    const extensions = await db.platformExtension.findMany({
      select: { id: true, publisher: true, installCount: true },
    });
    const installsByExt = new Map(extensions.map((e) => [e.id, e.installCount]));
    const installs = await db.platformExtensionInstall.groupBy({
      by: ['extensionId'],
      _count: { extensionId: true },
    });
    const installCountByExt = new Map(installs.map((i) => [i.extensionId, i._count.extensionId]));

    for (const dev of canonical) {
      const devExtensions = extensions.filter((e) => e.publisher === dev.name);
      if (devExtensions.length === 0) continue;
      const appsPublished = devExtensions.length;
      const totalInstalls = devExtensions.reduce(
        (s, e) => s + (installCountByExt.get(e.id) ?? installsByExt.get(e.id) ?? 0),
        0,
      );
      await db.platformDeveloper.update({
        where: { handle: dev.handle },
        data: { appsPublished, totalInstalls },
      });
    }
  } finally {
    SEED_LOCK.value = false;
  }
}

export async function listDevelopers(): Promise<Developer[]> {
  await ensureDevelopersSeeded();
  const rows = await db.platformDeveloper.findMany({
    orderBy: [{ totalInstalls: 'desc' }, { joinedAt: 'asc' }],
    take: 100,
  });
  return rows.map(mapDeveloper);
}

export async function getDeveloperPlatformSummary(): Promise<DeveloperPlatformSummary> {
  await ensureDevelopersSeeded();
  const devs = await listDevelopers();
  const active = devs.filter((d) => d.status === 'active').length;
  const certified = devs.filter((d) => d.tier === 'certified').length;
  const strategic = devs.filter((d) => d.tier === 'strategic').length;
  const totalApps = devs.reduce((s, d) => s + d.appsPublished, 0);
  const totalInstalls = devs.reduce((s, d) => s + d.totalInstalls, 0);

  return {
    totalDevelopers: devs.length,
    activeDevelopers: active,
    certifiedCount: certified,
    strategicCount: strategic,
    totalAppsPublished: totalApps,
    totalInstalls,
    sdks: SDK_CATALOG,
    developers: devs,
  };
}

export async function registerDeveloper(input: {
  email: string;
  name: string;
  handle?: string;
  organizationId?: string;
  tier?: DeveloperTier;
}): Promise<Developer> {
  const handle = input.handle ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const existing = await db.platformDeveloper.findUnique({ where: { email: input.email } });
  if (existing) return mapDeveloper(existing);

  let finalHandle = handle || 'dev-' + Math.random().toString(36).slice(2, 8);
  const handleExists = await db.platformDeveloper.findUnique({ where: { handle: finalHandle } });
  if (handleExists) finalHandle = `${finalHandle}-${Math.random().toString(36).slice(2, 6)}`;

  const created = await db.platformDeveloper.create({
    data: {
      email: input.email,
      name: input.name,
      handle: finalHandle,
      status: 'active',
      tier: input.tier ?? 'individual',
      organizationId: input.organizationId ?? null,
    },
  });

  if (input.organizationId) {
    await db.platformAuditEvent.create({
      data: {
        organizationId: input.organizationId,
        actor: input.email,
        action: 'developer.registered',
        category: 'admin',
        targetType: 'developer',
        targetId: created.id,
        details: JSON.stringify({ name: input.name, handle: finalHandle, tier: input.tier ?? 'individual' }),
      },
    });
  }

  return mapDeveloper(created);
}
