// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE AI PLATFORM™ — ORG RESOLVER
// Resolves the active organization for a request. POST endpoints accept an
// explicit organizationId; if absent, we default to the anchor (host) org so
// the platform is usable out-of-the-box against real data.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';

export async function resolveOrgId(explicit?: string): Promise<string> {
  await ensurePlatformOrganizationsSeeded();
  if (explicit && explicit.length > 0) {
    const exists = await db.platformOrganization.findUnique({ where: { id: explicit } });
    if (exists) return exists.id;
  }
  const anchor = await db.platformOrganization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (anchor) return anchor.id;
  // Should never happen after seeding, but guard anyway
  const created = await db.platformOrganization.create({
    data: {
      name: 'VEYRO Anchor Org',
      slug: 'gstpilot-anchor',
      domain: 'gstpilot.ai',
      legalName: 'VEYRO Anchor Org',
      country: 'IN',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      organizationType: 'standalone',
      plan: 'enterprise',
      planStatus: 'active',
      status: 'active',
      industry: 'Technology',
      employeeCount: 1,
      monthlyRevenue: 0,
      seatsUsed: 1,
      seatsLimit: 250,
      storageUsedMb: 0,
      storageLimitMb: 10240,
      apiCallsMonth: 0,
      aiCreditsUsed: 0,
      aiCreditsLimit: 100000,
      // Health/risk scores set to 0 — no real metrics available for a freshly
      // provisioned anchor org. The platform dashboard will display the empty
      // state until real signals (sync runs, invoices, filings) exist.
      healthScore: 0,
      churnRisk: 0,
      branding: JSON.stringify({}),
      settings: JSON.stringify({ isolatedTenant: true, agiInstance: 'enterprise', region: 'ap-south-1' }),
      provisioningState: 'provisioned',
      provisionedAt: new Date(),
    },
  });
  return created.id;
}
